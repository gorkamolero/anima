#!/usr/bin/env python3
# /// script
# requires-python = ">=3.10"
# dependencies = ["requests", "pillow", "click", "numpy", "opencv-python"]
# ///
"""
Pipeline A: Sprite extraction via Replicate rembg API.

Usage:
  python pipeline_a.py <input_video_or_frames_dir> <output_dir> [options]

Steps:
  1. Detect loop in video (optional, with --detect-loop)
  2. Extract frames from video (if video input)
  3. Remove background via Replicate rembg API
  4. Fix alpha using original comparison
  5. Generate QC grid + ProRes video

Requirements:
  pip install requests pillow click numpy opencv-python
"""

import requests
import base64
import argparse
import subprocess
import os
import sys
import json
import time
from pathlib import Path
from PIL import Image
import io
from concurrent.futures import ThreadPoolExecutor, as_completed

# Config
MODEL_VERSION = "fb8af171cfa1616ddcf1242c093f9c46bcada5ad4cf6f2fbe8b81b330ec5c003"
API_URL = "https://api.replicate.com/v1/predictions"

# LoopyCut integration
SCRIPTS_DIR = Path(__file__).parent
LOOPYCUT_DIR = SCRIPTS_DIR.parent / "tools" / "loopycut"
LOOPYCUT_VENV = LOOPYCUT_DIR / ".venv" / "bin" / "python"
LOOPYCUT_PYTHON = str(LOOPYCUT_VENV) if LOOPYCUT_VENV.exists() else sys.executable


def run_loopycut(video: Path, output_dir: Path) -> dict:
    """Run loopycut to detect loop and return metadata. Required step."""
    loop_video = output_dir / "loop.mp4"
    metadata_file = output_dir / "loop.json"
    loopycut_cli = LOOPYCUT_DIR / "cli.py"

    cmd = [
        LOOPYCUT_PYTHON, str(loopycut_cli),
        str(video), str(loop_video),
        "--save-metadata",
        "--no-audio"
    ]

    print(f"\n{'='*60}")
    print(f"STEP: LoopyCut (Detect Loop)")
    print(f"{'='*60}")
    print(f"$ {' '.join(cmd)}\n")

    result = subprocess.run(cmd)
    if result.returncode != 0:
        print(f"\n✗ LoopyCut failed (exit {result.returncode})")
        return None

    if not metadata_file.exists():
        print(f"\n✗ LoopyCut metadata not found: {metadata_file}")
        return None

    print(f"\n✓ LoopyCut complete")
    with open(metadata_file) as f:
        return json.load(f)

def get_replicate_token():
    token = os.environ.get("REPLICATE_API_TOKEN")
    if not token:
        raise ValueError("REPLICATE_API_TOKEN environment variable required")
    return token


def detect_letterbox(video_path: Path) -> tuple[int, int]:
    """Auto-detect letterbox black bars."""
    import subprocess
    # Extract single frame
    result = subprocess.run(
        ["ffmpeg", "-i", str(video_path), "-vf", "select=eq(n\\,0)", "-vframes", "1", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"],
        capture_output=True
    )
    if result.returncode != 0:
        return 0, 0
    
    # Get dimensions
    probe = subprocess.run(
        ["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "csv=p=0", str(video_path)],
        capture_output=True, text=True
    )
    width, height = map(int, probe.stdout.strip().split(','))
    
    # Parse raw RGB data
    data = result.stdout
    if len(data) != width * height * 3:
        return 0, 0
    
    # Detect black rows from top
    crop_top = 0
    for y in range(height):
        row_start = y * width * 3
        row = data[row_start:row_start + width * 3]
        if max(row) > 16:  # Found non-black
            crop_top = y
            break
    
    # Detect black rows from bottom
    crop_bottom = 0
    for y in range(height - 1, -1, -1):
        row_start = y * width * 3
        row = data[row_start:row_start + width * 3]
        if max(row) > 16:
            crop_bottom = height - y - 1
            break
    
    return crop_top, crop_bottom


def extract_frames(video_path: Path, output_dir: Path, crop_top: int = None, crop_bottom: int = None, auto_crop: bool = True) -> tuple[int, int, int]:
    """Extract frames from video using ffmpeg with optional crop.
    
    Returns: (frame_count, crop_top_used, crop_bottom_used)
    """
    output_dir.mkdir(parents=True, exist_ok=True)
    
    # Auto-detect letterbox if not specified
    if auto_crop and crop_top is None and crop_bottom is None:
        crop_top, crop_bottom = detect_letterbox(video_path)
        if crop_top > 0 or crop_bottom > 0:
            print(f"  Auto-detected letterbox: {crop_top}px top, {crop_bottom}px bottom")
    
    crop_top = crop_top or 0
    crop_bottom = crop_bottom or 0
    
    # Build ffmpeg command with optional crop
    cmd = ["ffmpeg", "-y", "-i", str(video_path)]
    
    if crop_top > 0 or crop_bottom > 0:
        # Get dimensions
        probe = subprocess.run(
            ["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "csv=p=0", str(video_path)],
            capture_output=True, text=True
        )
        width, height = map(int, probe.stdout.strip().split(','))
        new_height = height - crop_top - crop_bottom
        cmd.extend(["-vf", f"crop={width}:{new_height}:0:{crop_top}"])
    
    cmd.extend(["-vsync", "0", str(output_dir / "frame-%03d.png")])
    subprocess.run(cmd, capture_output=True)
    
    return len(list(output_dir.glob("*.png"))), crop_top, crop_bottom


def threshold_alpha(img: Image.Image, threshold: int = 128) -> Image.Image:
    """Threshold alpha channel to remove semi-transparent artifacts."""
    if img.mode != 'RGBA':
        return img
    r, g, b, a = img.split()
    a_thresh = a.point(lambda x: 0 if x < threshold else 255)
    return Image.merge('RGBA', (r, g, b, a_thresh))


def fix_frame_alpha(rembg_path: Path, orig_path: Path, output_path: Path,
                    bg_color: tuple = (130, 130, 130), bg_tolerance: int = 15) -> int:
    """
    Fix alpha by comparing to original source.
    
    Problem: rembg confuses skin shadows (~130-140 RGB) with gray background,
    making skin pixels transparent.
    
    Solution: If original pixel ≠ background gray → force alpha=255
    Uses ORIGINAL colors (not rembg's modified colors) + fixed alpha.
    
    Returns count of fixed pixels.
    """
    rembg_img = Image.open(rembg_path).convert('RGBA')
    orig_img = Image.open(orig_path).convert('RGBA')
    
    # Resize original if dimensions don't match (shouldn't happen with proper crop)
    if orig_img.size != rembg_img.size:
        orig_img = orig_img.resize(rembg_img.size, Image.LANCZOS)
    
    width, height = rembg_img.size
    
    # Get pixel data
    orig_r, orig_g, orig_b, _ = [list(c.getdata()) for c in orig_img.split()]
    proc_r, proc_g, proc_b, proc_a = [list(c.getdata()) for c in rembg_img.split()]
    
    bg_r, bg_g, bg_b = bg_color
    fixed_count = 0
    new_a = proc_a.copy()
    
    for i in range(len(proc_a)):
        # Is original pixel NOT background gray?
        is_bg = (abs(orig_r[i] - bg_r) < bg_tolerance and 
                 abs(orig_g[i] - bg_g) < bg_tolerance and 
                 abs(orig_b[i] - bg_b) < bg_tolerance)
        
        # If not background but rembg made it transparent, fix it
        if not is_bg and proc_a[i] < 200:
            new_a[i] = 255
            fixed_count += 1
    
    # Rebuild image with ORIGINAL colors + fixed alpha
    new_a_img = Image.new('L', (width, height))
    new_a_img.putdata(new_a)
    
    orig_r_img = Image.new('L', (width, height)); orig_r_img.putdata(orig_r)
    orig_g_img = Image.new('L', (width, height)); orig_g_img.putdata(orig_g)
    orig_b_img = Image.new('L', (width, height)); orig_b_img.putdata(orig_b)
    
    fixed = Image.merge('RGBA', (orig_r_img, orig_g_img, orig_b_img, new_a_img))
    fixed.save(output_path)
    
    return fixed_count


def process_frame(input_path: Path, output_path: Path, alpha_threshold: int = 128) -> bool:
    """Process a single frame via Replicate rembg API."""
    try:
        # Load and encode image
        with open(input_path, 'rb') as f:
            image_data = f.read()
        b64 = base64.b64encode(image_data).decode()
        data_uri = f"data:image/png;base64,{b64}"
        
        # Create prediction
        headers = {
            "Authorization": f"Token {get_replicate_token()}",
            "Content-Type": "application/json"
        }
        resp = requests.post(
            API_URL,
            json={"version": MODEL_VERSION, "input": {"image": data_uri}},
            headers=headers,
            timeout=30
        )
        result = resp.json()
        
        if "id" not in result:
            raise Exception(f"API error: {result}")
        
        pred_id = result["id"]
        
        # Poll for completion
        poll_url = f"{API_URL}/{pred_id}"
        for _ in range(60):
            resp = requests.get(poll_url, headers=headers, timeout=10)
            result = resp.json()
            
            if result.get("status") == "succeeded":
                output_url = result.get("output")
                break
            elif result.get("status") == "failed":
                raise Exception(f"Failed: {result.get('error')}")
            
            time.sleep(2)
        else:
            raise Exception("Timeout waiting for prediction")
        
        # Download result
        resp = requests.get(output_url, timeout=30)
        rembg_img = Image.open(io.BytesIO(resp.content))
        
        # Threshold alpha
        result_img = threshold_alpha(rembg_img, alpha_threshold)
        result_img.save(output_path)
        
        print(f"  ✓ {input_path.name}")
        return True
        
    except Exception as e:
        print(f"  ✗ {input_path.name}: {e}")
        return False


def create_qc_grid(frames_dir: Path, output_path: Path, region: tuple = (200, 50, 520, 370)):
    """Create QC grid of face regions for review."""
    frames = sorted(frames_dir.glob("*.png"))
    if not frames:
        return
    
    cols = min(8, len(frames))
    rows = (len(frames) + cols - 1) // cols
    thumb_size = 160
    
    grid = Image.new('RGBA', (cols * thumb_size, rows * thumb_size), (40, 40, 40, 255))
    
    for idx, f in enumerate(frames):
        img = Image.open(f)
        face = img.crop(region)
        face = face.resize((thumb_size, thumb_size), Image.LANCZOS)
        col, row = idx % cols, idx // cols
        grid.paste(face, (col * thumb_size, row * thumb_size))
    
    grid.save(output_path)
    print(f"QC grid saved: {output_path}")


def create_prores(frames_dir: Path, output_path: Path, fps: int = 24):
    """Create ProRes 4444 video from frames."""
    frames = sorted(frames_dir.glob("*.png"))
    if not frames:
        return
    
    first = frames[0].name
    pattern = first.rsplit('-', 1)[0] + "-%03d.png" if '-' in first else "frame-%03d.png"
    
    cmd = [
        "ffmpeg", "-y", "-framerate", str(fps),
        "-i", str(frames_dir / pattern),
        "-c:v", "prores_ks", "-profile:v", "4444",
        "-pix_fmt", "yuva444p10le", str(output_path)
    ]
    subprocess.run(cmd, capture_output=True)
    print(f"ProRes saved: {output_path}")


def create_preview(prores_path: Path, output_path: Path):
    """Create preview video with magenta background from ProRes 4444."""
    # Get duration from prores to avoid infinite lavfi color input
    probe = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "default=noprint_wrappers=1:nokey=1", str(prores_path)],
        capture_output=True, text=True
    )
    duration = probe.stdout.strip() or "10"
    cmd = [
        "ffmpeg", "-y",
        "-f", "lavfi", "-t", duration, "-i", f"color=c=magenta:s=1920x1080:r=24",
        "-i", str(prores_path),
        "-filter_complex", "[1:v]scale=iw:ih[fg];[0:v]scale=iw:ih[bg];[bg][fg]overlay=(W-w)/2:(H-h)/2:format=auto",
        "-c:v", "libx264", "-crf", "18", "-pix_fmt", "yuv420p",
        "-shortest", str(output_path)
    ]
    subprocess.run(cmd, capture_output=True)
    print(f"Preview saved: {output_path}")


def main(args):
    input_path = Path(args.input)
    output_dir = Path(args.output)
    output_dir.mkdir(parents=True, exist_ok=True)
    
    # Step 0: LoopyCut (detect loop) - REQUIRED for video input
    frame_limit = args.frames
    source_video = input_path

    if input_path.is_file() and not args.skip_loopycut:
        loop_meta = run_loopycut(input_path, output_dir)
        if not loop_meta:
            print(f"\n✗ LoopyCut failed — cannot continue without loop detection")
            sys.exit(1)

        loop_info = loop_meta.get("loop_info", {})
        loop_frame_count = loop_info.get("frame_count") or loop_meta.get("frame_count")
        if loop_frame_count:
            print(f"\n→ Detected loop: {loop_frame_count} frames")
            if frame_limit is None:
                frame_limit = loop_frame_count

        # Use the trimmed loop video as source
        loop_video = output_dir / "loop.mp4"
        if loop_video.exists():
            source_video = loop_video

    # Step 1: Get frames
    if source_video.is_file():
        print(f"Extracting frames from {source_video}...")
        frames_dir = output_dir / "frames-raw"
        count, crop_top, crop_bottom = extract_frames(
            source_video, frames_dir,
            args.crop_top, args.crop_bottom,
            auto_crop=not args.no_auto_crop
        )
        if crop_top > 0 or crop_bottom > 0:
            print(f"  Cropped: {crop_top}px top, {crop_bottom}px bottom")
        print(f"  Extracted {count} frames")
    else:
        frames_dir = input_path
    
    frames = sorted(frames_dir.glob("*.png"))
    
    # Apply frame limit
    if frame_limit and len(frames) > frame_limit:
        print(f"  Limiting to first {frame_limit} frames (loop)")
        frames = frames[:frame_limit]
    
    print(f"\nProcessing {len(frames)} frames...")
    print(f"Concurrency: {args.concurrency}")
    
    # Step 2: Remove backgrounds with thread pool
    transparent_dir = output_dir / "frames"
    transparent_dir.mkdir(exist_ok=True)
    
    success = 0
    with ThreadPoolExecutor(max_workers=args.concurrency) as executor:
        futures = {
            executor.submit(
                process_frame,
                f,
                transparent_dir / f.name,
                args.alpha_threshold
            ): f for f in frames
        }
        for future in as_completed(futures):
            if future.result():
                success += 1
    
    print(f"\n✓ Processed: {success}/{len(frames)}")
    
    if success == 0:
        print("No frames processed successfully!")
        return
    
    # Step 3: Fix alpha using original comparison
    print("\nFixing alpha (comparing to originals)...")
    fixed_dir = output_dir / "frames-fixed"
    fixed_dir.mkdir(exist_ok=True)
    
    total_fixed = 0
    rembg_frames = sorted(transparent_dir.glob("*.png"))
    for rf in rembg_frames:
        orig_path = frames_dir / rf.name
        if orig_path.exists():
            fixed = fix_frame_alpha(rf, orig_path, fixed_dir / rf.name,
                                   bg_tolerance=args.bg_tolerance)
            total_fixed += fixed
            print(f"  ✓ {rf.name}: fixed {fixed} pixels")
        else:
            # No original? Copy rembg output as-is
            Image.open(rf).save(fixed_dir / rf.name)
            print(f"  ? {rf.name}: no original, copied as-is")
    
    print(f"✓ Fixed {total_fixed} total pixels")
    
    # Use fixed frames for output
    output_frames_dir = fixed_dir
    
    # Step 5: QC grid
    print("\nGenerating QC grid...")
    create_qc_grid(output_frames_dir, output_dir / "qc-faces.png")
    
    # Step 6: Videos
    print("\nCreating ProRes video...")
    create_prores(output_frames_dir, output_dir / "output.mov", args.fps)
    
    print("\nCreating preview video...")
    create_preview(output_dir / "output.mov", output_dir / "preview_magenta.mp4")
    
    print(f"\n✓ Complete! Output in {output_dir}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Pipeline A: rembg sprite extraction")
    parser.add_argument("input", help="Input video or frames directory")
    parser.add_argument("output", help="Output directory")
    parser.add_argument("--concurrency", type=int, default=3, help="Concurrent API calls (default: 3)")
    parser.add_argument("--fps", type=int, default=24, help="Output video FPS (default: 24)")
    parser.add_argument("--alpha-threshold", type=int, default=128, help="Alpha threshold (default: 128)")
    parser.add_argument("--crop-top", type=int, default=None, help="Pixels to crop from top (auto-detected if not set)")
    parser.add_argument("--crop-bottom", type=int, default=None, help="Pixels to crop from bottom (auto-detected if not set)")
    parser.add_argument("--no-auto-crop", action="store_true", help="Disable auto letterbox detection")
    parser.add_argument("--bg-tolerance", type=int, default=15, help="Background color tolerance for alpha fix (default: 15)")
    parser.add_argument("--skip-loopycut", action="store_true", help="Skip LoopyCut loop detection (use all frames)")
    parser.add_argument("--frames", type=int, default=None, help="Limit to N frames")
    
    args = parser.parse_args()
    main(args)
