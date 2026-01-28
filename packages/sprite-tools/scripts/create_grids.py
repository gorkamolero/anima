#!/usr/bin/env python3
"""
Create sprite grids from video for Nano Banana processing.

Usage:
  # Basic: create grids from video
  python create_grids.py video.mov --output-dir ./grids

  # With letterbox crop (50px top and bottom)
  python create_grids.py video.mov --output-dir ./grids --crop-top 50 --crop-bottom 50

  # Specify frame count (e.g., from LoopyCut)
  python create_grids.py video.mov --output-dir ./grids --frames 26

  # Custom grid layout and size
  python create_grids.py video.mov --output-dir ./grids --cols 3 --rows 2 --size 4096

Process:
  1. Extract frames from video (with optional crop)
  2. Take first N frames (--frames) or all
  3. Create grids at Nano Banana output size (default: 4096x4096 1:1)
  4. Output: grid-01-gray.png, grid-02-gray.png, etc.
"""

import argparse
import subprocess
import os
import sys
from pathlib import Path
from PIL import Image
import json
import tempfile
import shutil


def detect_letterbox(video_path: Path, threshold: int = 10) -> tuple[int, int]:
    """Auto-detect black letterbox bars by sampling first frame."""
    import tempfile
    
    # Extract single frame to analyze
    with tempfile.TemporaryDirectory() as tmpdir:
        tmp_frame = Path(tmpdir) / "sample.png"
        subprocess.run(
            ["ffmpeg", "-y", "-i", str(video_path), "-vframes", "1", str(tmp_frame)],
            capture_output=True
        )
        
        if not tmp_frame.exists():
            return 0, 0
        
        img = Image.open(tmp_frame)
        width, height = img.size
        pixels = img.load()
        
        def is_black_row(y):
            """Check if row is nearly black (letterbox)."""
            for x in range(0, width, max(1, width // 20)):  # Sample 20 points
                r, g, b = pixels[x, y][:3]
                if r > threshold or g > threshold or b > threshold:
                    return False
            return True
        
        # Detect top letterbox
        crop_top = 0
        for y in range(height // 4):  # Check top quarter max
            if is_black_row(y):
                crop_top = y + 1
            else:
                break
        
        # Detect bottom letterbox
        crop_bottom = 0
        for y in range(height - 1, height - height // 4, -1):  # Check bottom quarter max
            if is_black_row(y):
                crop_bottom = height - y
            else:
                break
        
        return crop_top, crop_bottom


def extract_frames(video_path: Path, output_dir: Path, crop_top: int = None, crop_bottom: int = None, auto_crop: bool = True) -> tuple[int, int, int]:
    """Extract frames from video with optional letterbox crop.
    
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
    
    # Build ffmpeg filter
    vf_filters = []
    if crop_top > 0 or crop_bottom > 0:
        # Get video dimensions first
        probe = subprocess.run(
            ["ffprobe", "-v", "error", "-select_streams", "v:0",
             "-show_entries", "stream=width,height", "-of", "csv=p=0", str(video_path)],
            capture_output=True, text=True
        )
        width, height = map(int, probe.stdout.strip().split(','))
        new_height = height - crop_top - crop_bottom
        vf_filters.append(f"crop={width}:{new_height}:0:{crop_top}")
    
    vf = ",".join(vf_filters) if vf_filters else None
    
    # Extract frames
    cmd = ["ffmpeg", "-y", "-i", str(video_path)]
    if vf:
        cmd.extend(["-vf", vf])
    cmd.extend(["-vsync", "0", str(output_dir / "frame_%03d.png")])
    
    subprocess.run(cmd, capture_output=True)
    
    # Count extracted frames
    frames = list(output_dir.glob("frame_*.png"))
    return len(frames), crop_top, crop_bottom


def create_grids(frames_dir: Path, output_dir: Path, 
                 num_frames: int = None, cols: int = 3, rows: int = 2, 
                 grid_size: int = 4096, bg_color: tuple = (130, 130, 130),
                 source_video: str = None, crop_top: int = 0, crop_bottom: int = 0):
    """Create grids from extracted frames."""
    output_dir.mkdir(parents=True, exist_ok=True)
    
    # Get frame files
    all_frames = sorted(frames_dir.glob("frame_*.png"))
    if num_frames:
        all_frames = all_frames[:num_frames]
    
    if not all_frames:
        print("Error: No frames found")
        return []
    
    # Get frame dimensions
    sample = Image.open(all_frames[0])
    frame_w, frame_h = sample.size
    
    # Grid params
    fpg = cols * rows  # frames per grid
    cell_w = grid_size // cols
    cell_h = grid_size // rows
    num_grids = (len(all_frames) + fpg - 1) // fpg
    
    print(f"Source: {len(all_frames)} frames @ {frame_w}x{frame_h}")
    print(f"Grid: {cols}x{rows} = {fpg} frames/grid, {grid_size}x{grid_size} canvas")
    print(f"Cell: {cell_w}x{cell_h}")
    print(f"Creating {num_grids} grids...")
    
    grid_files = []
    
    for g in range(num_grids):
        start = g * fpg
        end = min(start + fpg, len(all_frames))
        grid_frames = all_frames[start:end]
        
        # Create grid
        grid = Image.new('RGB', (grid_size, grid_size), bg_color)
        
        for i, fpath in enumerate(grid_frames):
            img = Image.open(fpath)
            img = img.resize((cell_w, cell_h), Image.LANCZOS)
            
            col = i % cols
            row = i // cols
            grid.paste(img, (col * cell_w, row * cell_h))
        
        out_path = output_dir / f"grid-{g+1:02d}-gray.png"
        grid.save(out_path)
        grid_files.append(out_path)
        print(f"  Grid {g+1}: frames {start+1}-{end} ({len(grid_frames)} frames)")
    
    # Calculate cell size for reverse operations
    cell_w = grid_size // cols
    cell_h = grid_size // rows
    
    # Build frame mapping for reconstruction
    frame_map = []
    for g in range(num_grids):
        start = g * fpg
        end = min(start + fpg, len(all_frames))
        grid_info = {
            "grid": f"grid-{g+1:02d}-gray.png",
            "frames": []
        }
        for i in range(end - start):
            grid_info["frames"].append({
                "frame_index": start + i,
                "cell_col": i % cols,
                "cell_row": i // cols,
                "cell_x": (i % cols) * cell_w,
                "cell_y": (i // cols) * cell_h
            })
        frame_map.append(grid_info)
    
    # Save metadata for reconstruction
    meta = {
        "source": {
            "video": source_video,
            "crop_top": crop_top,
            "crop_bottom": crop_bottom,
            "frame_size": [frame_w, frame_h]
        },
        "grid": {
            "size": grid_size,
            "cols": cols,
            "rows": rows,
            "cell_size": [cell_w, cell_h],
            "frames_per_grid": fpg,
            "bg_color": list(bg_color)
        },
        "output": {
            "total_frames": len(all_frames),
            "num_grids": num_grids,
            "grids": [str(f.name) for f in grid_files]
        },
        "frame_map": frame_map
    }
    with open(output_dir / "metadata.json", "w") as f:
        json.dump(meta, f, indent=2)
    
    print(f"\n✓ Created {num_grids} grids in {output_dir}")
    return grid_files


def main():
    parser = argparse.ArgumentParser(description="Create sprite grids from video")
    parser.add_argument("video", help="Input video file")
    parser.add_argument("--output-dir", "-o", required=True, help="Output directory for grids")
    parser.add_argument("--frames", "-n", type=int, help="Number of frames to use (e.g., from LoopyCut)")
    parser.add_argument("--crop-top", type=int, default=None, help="Pixels to crop from top (auto-detected if not set)")
    parser.add_argument("--crop-bottom", type=int, default=None, help="Pixels to crop from bottom (auto-detected if not set)")
    parser.add_argument("--no-auto-crop", action="store_true", help="Disable auto letterbox detection")
    parser.add_argument("--cols", type=int, default=3, help="Grid columns (default: 3)")
    parser.add_argument("--rows", type=int, default=2, help="Grid rows (default: 2)")
    parser.add_argument("--size", type=int, default=4096, help="Grid size in pixels (default: 4096 for 4K 1:1)")
    parser.add_argument("--keep-frames", action="store_true", help="Keep extracted frames (default: delete)")
    
    args = parser.parse_args()
    
    video_path = Path(args.video)
    output_dir = Path(args.output_dir)
    
    if not video_path.exists():
        print(f"Error: Video not found: {video_path}")
        sys.exit(1)
    
    # Create temp dir for frames
    frames_dir = output_dir / "frames"
    
    # Extract frames
    print(f"Extracting frames from {video_path.name}...")
    
    total_frames, crop_top, crop_bottom = extract_frames(
        video_path, frames_dir, 
        args.crop_top, args.crop_bottom,
        auto_crop=not args.no_auto_crop
    )
    
    if crop_top > 0 or crop_bottom > 0:
        print(f"  Cropped: {crop_top}px top, {crop_bottom}px bottom")
    print(f"  Extracted {total_frames} frames")
    
    # Create grids
    print()
    grids = create_grids(
        frames_dir, output_dir,
        num_frames=args.frames,
        cols=args.cols,
        rows=args.rows,
        grid_size=args.size,
        source_video=str(video_path),
        crop_top=crop_top,
        crop_bottom=crop_bottom
    )
    
    # Cleanup frames unless --keep-frames
    if not args.keep_frames:
        shutil.rmtree(frames_dir)
        print(f"\n(Cleaned up temp frames)")
    
    return grids


if __name__ == "__main__":
    main()
