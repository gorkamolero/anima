#!/usr/bin/env python3
"""
Fix alpha mask by comparing to original source.

Problem: rembg confuses skin shadows (~130-140 RGB) with gray background (130,130,130),
making skin pixels transparent.

Solution: If original pixel ≠ background gray → force alpha=255

Usage:
  python fix_alpha.py <rembg_dir> <original_dir> <output_dir> [--crop TOP BOTTOM] [--bg-tolerance N]
"""

import argparse
from pathlib import Path
from PIL import Image
import sys


def fix_frame_alpha(rembg_path: Path, orig_path: Path, output_path: Path,
                    crop_top: int = 0, crop_bottom: int = 0,
                    bg_color: tuple = (130, 130, 130), bg_tolerance: int = 15) -> int:
    """Fix alpha for a single frame. Returns count of fixed pixels."""
    
    # Load images
    rembg_img = Image.open(rembg_path).convert('RGBA')
    orig_img = Image.open(orig_path).convert('RGBA')
    
    # Crop original to match rembg
    if crop_top or crop_bottom:
        w, h = orig_img.size
        orig_img = orig_img.crop((0, crop_top, w, h - crop_bottom))
    
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


def main(args):
    rembg_dir = Path(args.rembg_dir)
    orig_dir = Path(args.original_dir)
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    
    rembg_frames = sorted(rembg_dir.glob("*.png"))
    
    if not rembg_frames:
        print(f"No PNG files found in {rembg_dir}")
        return 1
    
    crop_top, crop_bottom = args.crop if args.crop else (0, 0)
    
    print(f"Fixing alpha for {len(rembg_frames)} frames")
    print(f"Background tolerance: {args.bg_tolerance}")
    if crop_top or crop_bottom:
        print(f"Crop: {crop_top}px top, {crop_bottom}px bottom")
    print()
    
    total_fixed = 0
    
    for rf in rembg_frames:
        # Find matching original
        stem = rf.stem
        if stem.startswith("frame-") and len(stem) == 8:  # frame-01 format
            orig_name = f"frame-{int(stem.split('-')[1]):03d}.png"
        else:
            orig_name = rf.name
        
        orig_path = orig_dir / orig_name
        if not orig_path.exists():
            print(f"  ? {rf.name}: original not found")
            continue
        
        fixed = fix_frame_alpha(rf, orig_path, output_dir / rf.name,
                               crop_top, crop_bottom, 
                               bg_tolerance=args.bg_tolerance)
        total_fixed += fixed
        print(f"  ✓ {rf.name}: fixed {fixed} pixels")
    
    print(f"\n✓ Complete: {total_fixed} total pixels fixed")
    return 0


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Fix alpha mask using original comparison")
    parser.add_argument("rembg_dir", help="Directory of rembg output frames")
    parser.add_argument("original_dir", help="Directory of original source frames")
    parser.add_argument("output_dir", help="Output directory for fixed frames")
    parser.add_argument("--crop", nargs=2, type=int, metavar=("TOP", "BOTTOM"),
                        help="Crop applied to originals")
    parser.add_argument("--bg-tolerance", type=int, default=15,
                        help="Background color tolerance (default: 15)")
    
    args = parser.parse_args()
    sys.exit(main(args))
