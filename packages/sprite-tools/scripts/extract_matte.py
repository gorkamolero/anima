#!/usr/bin/env python3
"""
Extract alpha matte from white/black image pairs.

Usage:
  # Process all pairs in a batch results directory
  python extract_matte.py ./processed --output-dir ./alpha

  # Process single pair
  python extract_matte.py --white grid-01-white.png --black grid-01-black.png --output grid-01-alpha.png

Process:
  For each pixel, calculate alpha from white/black difference:
  - Identical pixels = opaque (foreground)
  - Maximum difference (255) = transparent (background)
  
  Formula: alpha = 255 - (white_avg - black_avg)
"""

import argparse
import json
import sys
from pathlib import Path
from PIL import Image


import numpy as np

# Distance between White (255,255,255) and Black (0,0,0)
# sqrt(255^2 + 255^2 + 255^2) ≈ 441.67
BG_DIST = np.sqrt(3 * 255 * 255)


def extract_alpha_matte(white_path: Path, black_path: Path, output_path: Path) -> bool:
    """
    Extract alpha using difference matting technique (numpy optimized).
    
    For each pixel, calculate Euclidean distance between white and black versions:
    - If pixel is identical in both → fully opaque (pixelDist = 0)
    - If pixel matches backgrounds exactly → fully transparent (pixelDist = bgDist)
    
    Formula: alpha = 1 - (pixelDist / bgDist)
    
    Color recovery: divide by alpha to un-premultiply (C / alpha)
    """
    white = Image.open(white_path).convert('RGB')
    black = Image.open(black_path).convert('RGB')
    
    if white.size != black.size:
        print(f"  Error: Size mismatch - white={white.size}, black={black.size}")
        return False
    
    # Convert to numpy arrays (float32 for precision)
    white_arr = np.array(white, dtype=np.float32)
    black_arr = np.array(black, dtype=np.float32)
    
    # Calculate Euclidean distance between white and black versions
    diff = white_arr - black_arr
    pixel_dist = np.sqrt(np.sum(diff ** 2, axis=2))
    
    # Alpha formula: 1 - (pixelDist / bgDist)
    alpha = 1 - (pixel_dist / BG_DIST)
    alpha = np.clip(alpha, 0, 1)
    
    # Color recovery: C / alpha (from black version)
    # Avoid division by zero
    alpha_safe = np.where(alpha > 0.01, alpha, 1)
    
    r = np.clip(black_arr[:, :, 0] / alpha_safe, 0, 255)
    g = np.clip(black_arr[:, :, 1] / alpha_safe, 0, 255)
    b = np.clip(black_arr[:, :, 2] / alpha_safe, 0, 255)
    
    # Zero out color where alpha is near zero
    mask = alpha <= 0.01
    r[mask] = 0
    g[mask] = 0
    b[mask] = 0
    
    # Combine into RGBA
    result_arr = np.zeros((white_arr.shape[0], white_arr.shape[1], 4), dtype=np.uint8)
    result_arr[:, :, 0] = r.astype(np.uint8)
    result_arr[:, :, 1] = g.astype(np.uint8)
    result_arr[:, :, 2] = b.astype(np.uint8)
    result_arr[:, :, 3] = (alpha * 255).astype(np.uint8)
    
    # Save result
    result = Image.fromarray(result_arr, 'RGBA')
    result.save(output_path)
    
    return True


def process_batch(processed_dir: Path, output_dir: Path):
    """Process all white/black pairs from batch results."""
    
    # Load batch results
    results_path = processed_dir / "batch_results.json"
    if not results_path.exists():
        print(f"Error: batch_results.json not found in {processed_dir}")
        sys.exit(1)
    
    with open(results_path) as f:
        batch = json.load(f)
    
    output_dir.mkdir(parents=True, exist_ok=True)
    
    results = batch["results"]
    print(f"Processing {len(results)} grid pairs...")
    print()
    
    alpha_files = []
    
    for i, item in enumerate(results):
        grid_name = item["grid"]
        white_name = item["white"]
        black_name = item["black"]
        
        if not white_name or not black_name:
            print(f"[{i+1}/{len(results)}] {grid_name} — SKIPPED (missing white/black)")
            continue
        
        white_path = processed_dir / white_name
        black_path = processed_dir / black_name
        
        base_name = grid_name.replace("-gray.png", "")
        alpha_path = output_dir / f"{base_name}-alpha.png"
        
        print(f"[{i+1}/{len(results)}] {grid_name}", end=" ")
        
        if extract_alpha_matte(white_path, black_path, alpha_path):
            print("→ ✓")
            alpha_files.append({
                "grid": grid_name,
                "alpha": alpha_path.name
            })
        else:
            print("→ ✗")
    
    # Save alpha results
    alpha_meta = {
        "source_batch": str(results_path),
        "alpha_files": alpha_files
    }
    
    with open(output_dir / "alpha_results.json", "w") as f:
        json.dump(alpha_meta, f, indent=2)
    
    print()
    print(f"✓ Extracted {len(alpha_files)} alpha mattes to {output_dir}")
    
    return alpha_files


def main():
    parser = argparse.ArgumentParser(description="Extract alpha matte from white/black pairs")
    
    # Batch mode
    parser.add_argument("processed_dir", nargs="?", help="Directory with batch_results.json")
    parser.add_argument("--output-dir", "-o", help="Output directory for alpha images")
    
    # Single pair mode
    parser.add_argument("--white", help="White background image")
    parser.add_argument("--black", help="Black background image")
    parser.add_argument("--output", help="Output alpha image")
    
    args = parser.parse_args()
    
    # Single pair mode
    if args.white and args.black and args.output:
        print(f"Extracting alpha matte...")
        if extract_alpha_matte(Path(args.white), Path(args.black), Path(args.output)):
            print(f"✓ Saved to {args.output}")
        else:
            sys.exit(1)
        return
    
    # Batch mode
    if args.processed_dir:
        if not args.output_dir:
            print("Error: --output-dir required for batch mode")
            sys.exit(1)
        
        process_batch(Path(args.processed_dir), Path(args.output_dir))
        return
    
    parser.print_help()


if __name__ == "__main__":
    main()
