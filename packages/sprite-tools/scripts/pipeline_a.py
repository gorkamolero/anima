#!/usr/bin/env python3
"""
Pipeline A: Sprite extraction via Replicate rembg API.

Usage:
  python pipeline_a.py <input_video_or_frames_dir> <output_dir> [options]

Steps:
  1. Extract frames from video (if video input)
  2. Remove background via Replicate rembg API
  3. Threshold alpha to clean edges
  4. Generate QC grid + ProRes video

Requirements:
  pip install requests pillow
"""

import requests
import base64
import argparse
import subprocess
import os
import time
from pathlib import Path
from PIL import Image
import io
from concurrent.futures import ThreadPoolExecutor, as_completed

# Config
REPLICATE_TOKEN = os.environ.get("REPLICATE_API_TOKEN")
if not REPLICATE_TOKEN:
    raise ValueError("REPLICATE_API_TOKEN environment variable required")
MODEL_VERSION = "fb8af171cfa1616ddcf1242c093f9c46bcada5ad4cf6f2fbe8b81b330ec5c003"
API_URL = "https://api.replicate.com/v1/predictions"


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
            "Authorization": f"Token {REPLICATE_TOKEN}",
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


def create_preview(frames_dir: Path, output_path: Path, fps: int = 24):
    """Create preview video with magenta background."""
    frames = sorted(frames_dir.glob("*.png"))
    if not frames:
        return
    
    # Get frame size from first frame
    first_img = Image.open(frames[0])
    w, h = first_img.size
    
    first = frames[0].name
    pattern = first.rsplit('-', 1)[0] + "-%03d.png" if '-' in first else "frame-%03d.png"
    
    cmd = [
        "ffmpeg", "-y",
        "-f", "lavfi", "-i", f"color=c=magenta:s={w}x{h}:r={fps}",
        "-framerate", str(fps), "-i", str(frames_dir / pattern),
        "-filter_complex", "[0:v][1:v]overlay=0:0:format=auto",
        "-c:v", "libx264", "-crf", "18", "-pix_fmt", "yuv420p",
        "-shortest", str(output_path)
    ]
    subprocess.run(cmd, capture_output=True)
    print(f"Preview saved: {output_path}")


def main(args):
    input_path = Path(args.input)
    output_dir = Path(args.output)
    output_dir.mkdir(parents=True, exist_ok=True)
    
    # Step 1: Get frames
    if input_path.is_file():
        print(f"Extracting frames from {input_path}...")
        frames_dir = output_dir / "frames-raw"
        count, crop_top, crop_bottom = extract_frames(
            input_path, frames_dir,
            args.crop_top, args.crop_bottom,
            auto_crop=not args.no_auto_crop
        )
        if crop_top > 0 or crop_bottom > 0:
            print(f"  Cropped: {crop_top}px top, {crop_bottom}px bottom")
        print(f"  Extracted {count} frames")
    else:
        frames_dir = input_path
    
    frames = sorted(frames_dir.glob("*.png"))
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
    
    # Step 3: QC grid
    print("\nGenerating QC grid...")
    create_qc_grid(transparent_dir, output_dir / "qc-faces.png")
    
    # Step 4: Videos
    print("\nCreating ProRes video...")
    create_prores(transparent_dir, output_dir / "output.mov", args.fps)
    
    print("\nCreating preview video...")
    create_preview(transparent_dir, output_dir / "preview_magenta.mp4", args.fps)
    
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
    
    args = parser.parse_args()
    main(args)
