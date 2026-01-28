#!/usr/bin/env python3
# /// script
# requires-python = ">=3.10"
# dependencies = ["pillow"]
# ///
"""
Reassemble alpha grids back into video or sprite sheet.

Usage:
  # Create WebM with alpha (VP9)
  python reassemble_video.py ./grids -o output.webm

  # Create PNG sequence
  python reassemble_video.py ./grids -o ./frames --format png

  # Create sprite sheet
  python reassemble_video.py ./grids -o spritesheet.png --format sheet

  # Custom framerate
  python reassemble_video.py ./grids -o output.webm --fps 30

Process:
  1. Load metadata.json for frame mapping
  2. Split alpha grids back into individual frames
  3. Resize to original frame size
  4. Output as WebM (VP9 alpha), PNG sequence, or sprite sheet

Supported formats:
  - png: PNG sequence (lossless, editor-compatible) [RECOMMENDED]
  - sheet: Sprite sheet PNG with JSON metadata (for Phaser/games)
  - mp4: H.264 video (no alpha - composited on background color)
  - webm: VP9 with alpha (experimental, may lose alpha on some systems)
"""

import argparse
import subprocess
import json
import sys
import os
import tempfile
import shutil
from pathlib import Path
from PIL import Image


def split_grids_to_frames(grids_dir: Path, alpha_dir: Path, output_dir: Path):
    """Split alpha grids back into individual frames using metadata."""
    
    # Load original metadata
    meta_path = grids_dir / "metadata.json"
    if not meta_path.exists():
        print(f"Error: metadata.json not found in {grids_dir}")
        sys.exit(1)
    
    with open(meta_path) as f:
        meta = json.load(f)
    
    # Get dimensions
    cell_w, cell_h = meta["grid"]["cell_size"]
    orig_w, orig_h = meta["source"]["frame_size"]
    frame_map = meta["frame_map"]
    
    output_dir.mkdir(parents=True, exist_ok=True)
    
    print(f"Splitting grids → {meta['output']['total_frames']} frames")
    print(f"  Cell size: {cell_w}×{cell_h} → Original: {orig_w}×{orig_h}")
    
    frame_paths = []
    
    for grid_info in frame_map:
        grid_name = grid_info["grid"].replace("-gray.png", "-alpha.png")
        grid_path = alpha_dir / grid_name
        
        if not grid_path.exists():
            print(f"  Warning: {grid_name} not found, skipping")
            continue
        
        grid_img = Image.open(grid_path)
        
        for frame_info in grid_info["frames"]:
            idx = frame_info["frame_index"]
            x = frame_info["cell_x"]
            y = frame_info["cell_y"]
            
            # Crop cell from grid
            cell = grid_img.crop((x, y, x + cell_w, y + cell_h))
            
            # Resize to original frame size
            frame = cell.resize((orig_w, orig_h), Image.LANCZOS)
            
            # Save frame
            frame_path = output_dir / f"frame_{idx:03d}.png"
            frame.save(frame_path)
            frame_paths.append(frame_path)
    
    print(f"  Extracted {len(frame_paths)} frames")
    return frame_paths, (orig_w, orig_h)


def create_webm(frames_dir: Path, output_path: Path, fps: int = 24):
    """Create WebM with VP9 alpha from PNG frames."""
    
    cmd = [
        "ffmpeg", "-y",
        "-framerate", str(fps),
        "-i", str(frames_dir / "frame_%03d.png"),
        "-c:v", "libvpx-vp9",
        "-pix_fmt", "yuva420p",
        "-b:v", "2M",
        "-auto-alt-ref", "0",
        str(output_path)
    ]
    
    result = subprocess.run(cmd, capture_output=True, text=True)
    
    if result.returncode != 0:
        print(f"Error creating WebM: {result.stderr}")
        return False
    
    return True


def create_mp4(frames_dir: Path, output_path: Path, fps: int = 24, bg_color: str = "magenta"):
    """Create MP4 (H.264) from PNG frames with background color.
    
    Note: MP4/H.264 doesn't support alpha. Frames are composited on bg_color.
    """
    # First composite frames on background
    composited_dir = frames_dir.parent / "composited"
    composited_dir.mkdir(exist_ok=True)
    
    frame_files = sorted(frames_dir.glob("frame_*.png"))
    
    # Parse background color
    if bg_color == "magenta":
        bg = (255, 0, 255)
    elif bg_color == "green":
        bg = (0, 255, 0)
    elif bg_color == "black":
        bg = (0, 0, 0)
    elif bg_color == "white":
        bg = (255, 255, 255)
    else:
        # Try parsing as hex
        try:
            bg_color = bg_color.lstrip('#')
            bg = tuple(int(bg_color[i:i+2], 16) for i in (0, 2, 4))
        except:
            bg = (255, 0, 255)  # Default to magenta
    
    print(f"  Compositing on {bg_color} background...")
    
    for fp in frame_files:
        img = Image.open(fp).convert('RGBA')
        
        # Create background
        background = Image.new('RGBA', img.size, (*bg, 255))
        
        # Composite
        composite = Image.alpha_composite(background, img)
        
        # Save as RGB (no alpha needed for MP4)
        composite.convert('RGB').save(composited_dir / fp.name)
    
    # Create MP4
    cmd = [
        "ffmpeg", "-y",
        "-framerate", str(fps),
        "-i", str(composited_dir / "frame_%03d.png"),
        "-c:v", "libx264",
        "-pix_fmt", "yuv420p",
        "-crf", "18",
        "-preset", "medium",
        str(output_path)
    ]
    
    result = subprocess.run(cmd, capture_output=True, text=True)
    
    # Cleanup composited frames
    shutil.rmtree(composited_dir)
    
    if result.returncode != 0:
        print(f"Error creating MP4: {result.stderr}")
        return False
    
    return True


def create_spritesheet(frames_dir: Path, output_path: Path, cols: int = None):
    """Create sprite sheet from frames."""
    
    frame_files = sorted(frames_dir.glob("frame_*.png"))
    if not frame_files:
        print("Error: No frames found")
        return False
    
    # Get frame dimensions
    sample = Image.open(frame_files[0])
    frame_w, frame_h = sample.size
    num_frames = len(frame_files)
    
    # Calculate grid layout
    if cols is None:
        # Auto: try to make roughly square
        import math
        cols = math.ceil(math.sqrt(num_frames))
    
    rows = math.ceil(num_frames / cols)
    
    # Create sheet
    sheet = Image.new('RGBA', (cols * frame_w, rows * frame_h), (0, 0, 0, 0))
    
    for i, fp in enumerate(frame_files):
        img = Image.open(fp)
        col = i % cols
        row = i // cols
        sheet.paste(img, (col * frame_w, row * frame_h))
    
    sheet.save(output_path)
    
    # Save metadata
    meta = {
        "frameWidth": frame_w,
        "frameHeight": frame_h,
        "frameCount": num_frames,
        "cols": cols,
        "rows": rows
    }
    
    meta_path = output_path.with_suffix('.json')
    with open(meta_path, 'w') as f:
        json.dump(meta, f, indent=2)
    
    print(f"  Sheet: {cols}×{rows} = {num_frames} frames @ {frame_w}×{frame_h}")
    return True


def main():
    parser = argparse.ArgumentParser(description="Reassemble alpha grids into video/sheet")
    parser.add_argument("grids_dir", help="Directory with metadata.json and alpha grids")
    parser.add_argument("--output", "-o", required=True, help="Output file or directory")
    parser.add_argument("--format", "-f", choices=["webm", "png", "sheet", "mp4"], default="png",
                        help="Output format (default: png)")
    parser.add_argument("--bg", default="magenta", 
                        help="Background color for MP4 (magenta/green/black/white/#RRGGBB)")
    parser.add_argument("--fps", type=int, default=24, help="Frame rate for video (default: 24)")
    parser.add_argument("--alpha-dir", help="Alpha grids directory (default: grids_dir/alpha)")
    parser.add_argument("--cols", type=int, help="Columns for sprite sheet (auto if not set)")
    
    args = parser.parse_args()
    
    grids_dir = Path(args.grids_dir)
    output_path = Path(args.output)
    
    # Find alpha directory
    if args.alpha_dir:
        alpha_dir = Path(args.alpha_dir)
    else:
        alpha_dir = grids_dir / "alpha"
    
    if not alpha_dir.exists():
        print(f"Error: Alpha directory not found: {alpha_dir}")
        sys.exit(1)
    
    # Create temp dir for frames
    with tempfile.TemporaryDirectory() as tmpdir:
        frames_dir = Path(tmpdir) / "frames"
        
        # Split grids to frames
        frame_paths, (frame_w, frame_h) = split_grids_to_frames(grids_dir, alpha_dir, frames_dir)
        
        if not frame_paths:
            print("Error: No frames extracted")
            sys.exit(1)
        
        print()
        
        # Generate output
        if args.format == "mp4":
            print(f"Creating MP4 ({args.fps} fps)...")
            if create_mp4(frames_dir, output_path, args.fps, args.bg):
                print(f"✓ Saved: {output_path}")
            else:
                sys.exit(1)
        
        elif args.format == "webm":
            print(f"Creating WebM ({args.fps} fps)...")
            if create_webm(frames_dir, output_path, args.fps):
                print(f"✓ Saved: {output_path}")
            else:
                sys.exit(1)
                
        elif args.format == "png":
            print(f"Copying PNG sequence...")
            output_path.mkdir(parents=True, exist_ok=True)
            for fp in frame_paths:
                shutil.copy(fp, output_path / fp.name)
            print(f"✓ Saved {len(frame_paths)} frames to {output_path}")
            
        elif args.format == "sheet":
            print("Creating sprite sheet...")
            if create_spritesheet(frames_dir, output_path, args.cols):
                print(f"✓ Saved: {output_path}")
            else:
                sys.exit(1)


if __name__ == "__main__":
    main()
