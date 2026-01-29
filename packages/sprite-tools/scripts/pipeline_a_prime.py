#!/usr/bin/env python3
# /// script
# requires-python = ">=3.10"
# dependencies = ["requests", "pillow", "click", "numpy", "opencv-python"]
# ///
"""
Pipeline A' (A-Prime): Sprite extraction via Replicate rembg API using grids.

Like Pipeline A but sends whole grids to rembg instead of individual frames,
reducing API calls by ~6x (for 3x2 grids).

Usage:
  python pipeline_a_prime.py <input_video> <output_dir> [options]

Steps:
  0. LoopyCut          — Detect loop (same as A)
  1. Extract frames    — From loop video with letterbox crop (same as A)
  2. Create grids      — Pack frames into 4K grids (via create_grids.py, same as B)
  3. rembg on grids    — Send each grid to Replicate rembg API
  4. Split grids       — Extract individual frames from rembg'd grids
  5. Fix alpha         — Compare each frame to original (same as A)
  6. QC + ProRes       — Generate QC grid, ProRes 4444, preview video
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

# Paths
SCRIPTS_DIR = Path(__file__).parent
LOOPYCUT_DIR = SCRIPTS_DIR.parent / "tools" / "loopycut"
LOOPYCUT_VENV = LOOPYCUT_DIR / ".venv" / "bin" / "python"
LOOPYCUT_PYTHON = str(LOOPYCUT_VENV) if LOOPYCUT_VENV.exists() else sys.executable


# ─── Helpers ──────────────────────────────────────────────────────────────────

def get_replicate_token():
    token = os.environ.get("REPLICATE_API_TOKEN")
    if not token:
        raise ValueError("REPLICATE_API_TOKEN environment variable required")
    return token


# ─── Step 0: LoopyCut ────────────────────────────────────────────────────────

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
    print(f"STEP 0: LoopyCut (Detect Loop)")
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


# ─── Step 1: Extract frames ──────────────────────────────────────────────────

def detect_letterbox(video_path: Path) -> tuple[int, int]:
    """Auto-detect letterbox black bars."""
    result = subprocess.run(
        ["ffmpeg", "-i", str(video_path), "-vf", "select=eq(n\\,0)",
         "-vframes", "1", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"],
        capture_output=True
    )
    if result.returncode != 0:
        return 0, 0

    probe = subprocess.run(
        ["ffprobe", "-v", "error", "-select_streams", "v:0",
         "-show_entries", "stream=width,height", "-of", "csv=p=0", str(video_path)],
        capture_output=True, text=True
    )
    width, height = map(int, probe.stdout.strip().split(','))

    data = result.stdout
    if len(data) != width * height * 3:
        return 0, 0

    crop_top = 0
    for y in range(height):
        row_start = y * width * 3
        row = data[row_start:row_start + width * 3]
        if max(row) > 16:
            crop_top = y
            break

    crop_bottom = 0
    for y in range(height - 1, -1, -1):
        row_start = y * width * 3
        row = data[row_start:row_start + width * 3]
        if max(row) > 16:
            crop_bottom = height - y - 1
            break

    return crop_top, crop_bottom


def extract_frames(video_path: Path, output_dir: Path,
                   crop_top: int = None, crop_bottom: int = None,
                   auto_crop: bool = True) -> tuple[int, int, int]:
    """Extract frames from video using ffmpeg with optional crop.

    Returns: (frame_count, crop_top_used, crop_bottom_used)
    """
    output_dir.mkdir(parents=True, exist_ok=True)

    if auto_crop and crop_top is None and crop_bottom is None:
        crop_top, crop_bottom = detect_letterbox(video_path)
        if crop_top > 0 or crop_bottom > 0:
            print(f"  Auto-detected letterbox: {crop_top}px top, {crop_bottom}px bottom")

    crop_top = crop_top or 0
    crop_bottom = crop_bottom or 0

    cmd = ["ffmpeg", "-y", "-i", str(video_path)]

    if crop_top > 0 or crop_bottom > 0:
        probe = subprocess.run(
            ["ffprobe", "-v", "error", "-select_streams", "v:0",
             "-show_entries", "stream=width,height", "-of", "csv=p=0", str(video_path)],
            capture_output=True, text=True
        )
        width, height = map(int, probe.stdout.strip().split(','))
        new_height = height - crop_top - crop_bottom
        cmd.extend(["-vf", f"crop={width}:{new_height}:0:{crop_top}"])

    cmd.extend(["-vsync", "0", str(output_dir / "frame-%03d.png")])
    subprocess.run(cmd, capture_output=True)

    return len(list(output_dir.glob("*.png"))), crop_top, crop_bottom


# ─── Step 2: Create grids (via create_grids.py subprocess) ───────────────────

def create_grids(video_path: Path, grids_dir: Path, frame_count: int) -> Path:
    """Call create_grids.py as subprocess to pack frames into 4K grids."""
    cmd = [
        sys.executable, str(SCRIPTS_DIR / "create_grids.py"),
        str(video_path),
        "-o", str(grids_dir),
        "--frames", str(frame_count)
    ]

    print(f"\n{'='*60}")
    print(f"STEP 2: Create Grids (Frames → 4K Grids)")
    print(f"{'='*60}")
    print(f"$ {' '.join(cmd)}\n")

    result = subprocess.run(cmd)
    if result.returncode != 0:
        print(f"\n✗ Grid creation failed (exit {result.returncode})")
        return None

    metadata_path = grids_dir / "metadata.json"
    if not metadata_path.exists():
        print(f"\n✗ Grid metadata not found: {metadata_path}")
        return None

    print(f"\n✓ Grids created")
    return metadata_path


# ─── Step 3: rembg on grids ──────────────────────────────────────────────────

def process_grid(input_path: Path, output_path: Path, alpha_threshold: int = 128) -> bool:
    """Process a single grid image via Replicate rembg API."""
    try:
        with open(input_path, 'rb') as f:
            image_data = f.read()
        b64 = base64.b64encode(image_data).decode()
        data_uri = f"data:image/png;base64,{b64}"

        headers = {
            "Authorization": f"Token {get_replicate_token()}",
            "Content-Type": "application/json"
        }
        resp = requests.post(
            API_URL,
            json={"version": MODEL_VERSION, "input": {"image": data_uri}},
            headers=headers,
            timeout=60
        )
        result = resp.json()

        if "id" not in result:
            raise Exception(f"API error: {result}")

        pred_id = result["id"]

        # Poll for completion (grids are larger, allow more time)
        poll_url = f"{API_URL}/{pred_id}"
        for _ in range(120):
            resp = requests.get(poll_url, headers=headers, timeout=10)
            result = resp.json()

            if result.get("status") == "succeeded":
                output_url = result.get("output")
                break
            elif result.get("status") == "failed":
                raise Exception(f"Failed: {result.get('error')}")

            time.sleep(3)
        else:
            raise Exception("Timeout waiting for prediction")

        # Download result
        resp = requests.get(output_url, timeout=60)
        rembg_img = Image.open(io.BytesIO(resp.content)).convert('RGBA')

        # Threshold alpha
        if alpha_threshold > 0:
            r, g, b, a = rembg_img.split()
            a_thresh = a.point(lambda x: 0 if x < alpha_threshold else 255)
            rembg_img = Image.merge('RGBA', (r, g, b, a_thresh))

        rembg_img.save(output_path)
        print(f"  ✓ {input_path.name}")
        return True

    except Exception as e:
        print(f"  ✗ {input_path.name}: {e}")
        return False


def rembg_grids(grids_dir: Path, rembg_dir: Path, metadata: dict,
                concurrency: int = 3, alpha_threshold: int = 128) -> int:
    """Send all grids to rembg API and return count of successes."""
    rembg_dir.mkdir(parents=True, exist_ok=True)

    grid_files = []
    for grid_name in metadata["output"]["grids"]:
        grid_path = grids_dir / grid_name
        if grid_path.exists():
            grid_files.append(grid_path)

    print(f"\n{'='*60}")
    print(f"STEP 3: rembg on Grids ({len(grid_files)} grids)")
    print(f"{'='*60}")
    print(f"Concurrency: {concurrency}\n")

    success = 0
    with ThreadPoolExecutor(max_workers=concurrency) as executor:
        futures = {
            executor.submit(
                process_grid,
                gf,
                rembg_dir / gf.name,
                alpha_threshold
            ): gf for gf in grid_files
        }
        for future in as_completed(futures):
            if future.result():
                success += 1

    print(f"\n✓ rembg'd: {success}/{len(grid_files)} grids")
    return success


# ─── Step 4: Split grids back into frames ────────────────────────────────────

def split_grids(rembg_dir: Path, frames_dir: Path, metadata: dict,
                orig_frames_dir: Path) -> int:
    """Split rembg'd grids back into individual frames using metadata.

    Reads cell positions from metadata.json, crops each cell from the
    rembg'd grid, and resizes to match original frame dimensions.

    Returns count of extracted frames.
    """
    frames_dir.mkdir(parents=True, exist_ok=True)

    grid_info = metadata["grid"]
    cell_w, cell_h = grid_info["cell_size"]
    frame_map = metadata["frame_map"]

    # Get original frame size from a sample frame in frames-raw
    orig_frames = sorted(orig_frames_dir.glob("*.png"))
    if orig_frames:
        sample = Image.open(orig_frames[0])
        orig_w, orig_h = sample.size
    else:
        # Fallback: use cell size
        orig_w, orig_h = cell_w, cell_h

    print(f"\n{'='*60}")
    print(f"STEP 4: Split Grids → Individual Frames")
    print(f"{'='*60}")
    print(f"Cell size: {cell_w}x{cell_h}")
    print(f"Original frame size: {orig_w}x{orig_h}")
    print(f"Restoring to original size: {'yes' if (orig_w, orig_h) != (cell_w, cell_h) else 'no (same size)'}\n")

    count = 0
    for grid_entry in frame_map:
        grid_name = grid_entry["grid"]
        rembg_grid_path = rembg_dir / grid_name
        if not rembg_grid_path.exists():
            print(f"  ✗ Missing rembg'd grid: {grid_name}")
            continue

        grid_img = Image.open(rembg_grid_path).convert('RGBA')

        for frame_info in grid_entry["frames"]:
            frame_idx = frame_info["frame_index"]
            cx = frame_info["cell_x"]
            cy = frame_info["cell_y"]

            # Crop cell from grid
            cell = grid_img.crop((cx, cy, cx + cell_w, cy + cell_h))

            # Resize back to original frame dimensions if different
            if (cell.width, cell.height) != (orig_w, orig_h):
                cell = cell.resize((orig_w, orig_h), Image.LANCZOS)

            # Name to match frames-raw convention (frame-001.png, 1-indexed)
            out_name = f"frame-{frame_idx + 1:03d}.png"
            cell.save(frames_dir / out_name)
            count += 1

        print(f"  ✓ {grid_name}: extracted {len(grid_entry['frames'])} frames")

    print(f"\n✓ Split {count} frames from grids")
    return count


# ─── Step 5: Fix alpha ───────────────────────────────────────────────────────

def fix_frame_alpha(rembg_path: Path, orig_path: Path, output_path: Path,
                    bg_color: tuple = (130, 130, 130), bg_tolerance: int = 15) -> int:
    """Fix alpha by comparing to original source.

    Problem: rembg confuses skin shadows (~130-140 RGB) with gray background,
    making skin pixels transparent.

    Solution: If original pixel ≠ background gray → force alpha=255
    Uses ORIGINAL colors (not rembg's modified colors) + fixed alpha.

    Returns count of fixed pixels.
    """
    rembg_img = Image.open(rembg_path).convert('RGBA')
    orig_img = Image.open(orig_path).convert('RGBA')

    if orig_img.size != rembg_img.size:
        orig_img = orig_img.resize(rembg_img.size, Image.LANCZOS)

    width, height = rembg_img.size

    orig_r, orig_g, orig_b, _ = [list(c.getdata()) for c in orig_img.split()]
    proc_r, proc_g, proc_b, proc_a = [list(c.getdata()) for c in rembg_img.split()]

    bg_r, bg_g, bg_b = bg_color
    fixed_count = 0
    new_a = proc_a.copy()

    for i in range(len(proc_a)):
        is_bg = (abs(orig_r[i] - bg_r) < bg_tolerance and
                 abs(orig_g[i] - bg_g) < bg_tolerance and
                 abs(orig_b[i] - bg_b) < bg_tolerance)

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


# ─── Step 6: QC + ProRes + Preview ───────────────────────────────────────────

def create_qc_grid(frames_dir: Path, output_path: Path,
                   region: tuple = (200, 50, 520, 370)):
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
    probe = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "default=noprint_wrappers=1:nokey=1", str(prores_path)],
        capture_output=True, text=True
    )
    duration = probe.stdout.strip() or "10"
    cmd = [
        "ffmpeg", "-y",
        "-f", "lavfi", "-t", duration,
        "-i", f"color=c=magenta:s=1920x1080:r=24",
        "-i", str(prores_path),
        "-filter_complex",
        "[1:v]scale=iw:ih[fg];[0:v]scale=iw:ih[bg];[bg][fg]overlay=(W-w)/2:(H-h)/2:format=auto",
        "-c:v", "libx264", "-crf", "18", "-pix_fmt", "yuv420p",
        "-shortest", str(output_path)
    ]
    subprocess.run(cmd, capture_output=True)
    print(f"Preview saved: {output_path}")


# ─── Main ─────────────────────────────────────────────────────────────────────

def main(args):
    input_path = Path(args.input)
    output_dir = Path(args.output)
    output_dir.mkdir(parents=True, exist_ok=True)

    print(f"""
╔══════════════════════════════════════════════════════════╗
║              PIPELINE A' (A-PRIME)                       ║
║       rembg via Grids — Fewer API calls, same quality    ║
╚══════════════════════════════════════════════════════════╝

Input:  {input_path}
Output: {output_dir}
""")

    # ── Step 0: LoopyCut ──────────────────────────────────────────────────
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

        loop_video = output_dir / "loop.mp4"
        if loop_video.exists():
            source_video = loop_video

    # ── Step 1: Extract frames (for alpha fix later) ─────────────────────
    print(f"\n{'='*60}")
    print(f"STEP 1: Extract Frames (for alpha comparison)")
    print(f"{'='*60}")

    frames_raw_dir = output_dir / "frames-raw"
    count, crop_top, crop_bottom = extract_frames(
        source_video, frames_raw_dir,
        args.crop_top, args.crop_bottom,
        auto_crop=not args.no_auto_crop
    )
    if crop_top > 0 or crop_bottom > 0:
        print(f"  Cropped: {crop_top}px top, {crop_bottom}px bottom")
    print(f"  Extracted {count} frames")

    # Apply frame limit to raw frames
    raw_frames = sorted(frames_raw_dir.glob("*.png"))
    if frame_limit and len(raw_frames) > frame_limit:
        print(f"  Limiting to first {frame_limit} frames (loop)")
        for f in raw_frames[frame_limit:]:
            f.unlink()
        raw_frames = raw_frames[:frame_limit]

    total_frames = len(raw_frames)
    print(f"\n→ {total_frames} frames to process")

    # ── Step 2: Create grids ─────────────────────────────────────────────
    grids_dir = output_dir / "grids"
    metadata_path = create_grids(source_video, grids_dir, total_frames)
    if not metadata_path:
        print("\n✗ Grid creation failed — cannot continue")
        sys.exit(1)

    with open(metadata_path) as f:
        metadata = json.load(f)

    num_grids = metadata["output"]["num_grids"]
    print(f"→ {total_frames} frames packed into {num_grids} grids")
    print(f"→ API calls: {num_grids} (vs {total_frames} in Pipeline A)")

    # ── Step 3: rembg on grids ───────────────────────────────────────────
    rembg_dir = output_dir / "grids-rembg"
    success = rembg_grids(grids_dir, rembg_dir, metadata,
                          concurrency=args.concurrency,
                          alpha_threshold=args.alpha_threshold)
    if success == 0:
        print("\n✗ No grids processed successfully!")
        sys.exit(1)

    # ── Step 4: Split grids back into frames ─────────────────────────────
    frames_rembg_dir = output_dir / "frames-rembg"
    split_count = split_grids(rembg_dir, frames_rembg_dir, metadata, frames_raw_dir)
    if split_count == 0:
        print("\n✗ No frames extracted from grids!")
        sys.exit(1)

    # ── Step 5: Fix alpha using original comparison ──────────────────────
    print(f"\n{'='*60}")
    print(f"STEP 5: Fix Alpha (compare to originals)")
    print(f"{'='*60}\n")

    final_dir = output_dir / "final"
    final_dir.mkdir(exist_ok=True)

    total_fixed = 0
    rembg_frames = sorted(frames_rembg_dir.glob("*.png"))
    for rf in rembg_frames:
        orig_path = frames_raw_dir / rf.name
        if orig_path.exists():
            fixed = fix_frame_alpha(rf, orig_path, final_dir / rf.name,
                                    bg_tolerance=args.bg_tolerance)
            total_fixed += fixed
            print(f"  ✓ {rf.name}: fixed {fixed} pixels")
        else:
            # No original? Copy rembg output as-is
            Image.open(rf).save(final_dir / rf.name)
            print(f"  ? {rf.name}: no original, copied as-is")

    print(f"\n✓ Fixed {total_fixed} total pixels across {len(rembg_frames)} frames")

    # ── Step 6: QC + ProRes + Preview ────────────────────────────────────
    print(f"\n{'='*60}")
    print(f"STEP 6: QC Grid + ProRes + Preview")
    print(f"{'='*60}\n")

    print("Generating QC grid...")
    create_qc_grid(final_dir, output_dir / "qc-faces.png")

    print("Creating ProRes video...")
    create_prores(final_dir, output_dir / "output.mov", args.fps)

    print("Creating preview video...")
    create_preview(output_dir / "output.mov", output_dir / "preview_magenta.mp4")

    # ── Summary ──────────────────────────────────────────────────────────
    print(f"""
╔══════════════════════════════════════════════════════════╗
║              PIPELINE A' COMPLETE                        ║
╚══════════════════════════════════════════════════════════╝

Output:     {output_dir}
Frames:     {total_frames}
Grids:      {num_grids}
API calls:  {num_grids} (saved {total_frames - num_grids} vs Pipeline A)
Fixed px:   {total_fixed}

Files:
  final/          — Transparent PNGs (alpha-fixed)
  output.mov      — ProRes 4444 with alpha
  preview_magenta.mp4 — Preview on magenta background
  qc-faces.png    — QC face grid
  grids/          — Source grids + metadata
  grids-rembg/    — rembg'd grids
  frames-raw/     — Original extracted frames
  frames-rembg/   — Split frames from rembg'd grids
""")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Pipeline A' (A-Prime): rembg sprite extraction via grids"
    )
    parser.add_argument("input", help="Input video file")
    parser.add_argument("output", help="Output directory")
    parser.add_argument("--concurrency", type=int, default=3,
                        help="Concurrent API calls for grids (default: 3)")
    parser.add_argument("--fps", type=int, default=24,
                        help="Output video FPS (default: 24)")
    parser.add_argument("--alpha-threshold", type=int, default=128,
                        help="Alpha threshold (default: 128)")
    parser.add_argument("--crop-top", type=int, default=None,
                        help="Pixels to crop from top (auto-detected if not set)")
    parser.add_argument("--crop-bottom", type=int, default=None,
                        help="Pixels to crop from bottom (auto-detected if not set)")
    parser.add_argument("--no-auto-crop", action="store_true",
                        help="Disable auto letterbox detection")
    parser.add_argument("--bg-tolerance", type=int, default=15,
                        help="Background color tolerance for alpha fix (default: 15)")
    parser.add_argument("--skip-loopycut", action="store_true",
                        help="Skip LoopyCut loop detection (use all frames)")
    parser.add_argument("--frames", type=int, default=None,
                        help="Limit to N frames")

    args = parser.parse_args()
    main(args)
