#!/usr/bin/env python3
"""
Automated Sprite QC - Detects artifacts without human review.

Checks:
1. Semi-transparent pixels in face region (should be 0 or 255, not in between)
2. Dark pixels in skin areas (artifact detection)
3. Edge fringing (dark pixels at alpha boundaries)

Returns: exit code 0 if all pass, 1 if any fail. Lists bad frames.

Usage:
  python auto_qc.py <frames_dir> [--face-region X Y W H] [--skin-threshold N]

Examples:
  python auto_qc.py ./transparent
  python auto_qc.py ./transparent --strict
"""

import argparse
from pathlib import Path
from PIL import Image
import sys

# Default face region (adjust per character)
DEFAULT_FACE_REGION = (250, 80, 470, 320)  # x1, y1, x2, y2

# Thresholds
SEMI_TRANS_THRESHOLD = 100  # Max allowed semi-transparent pixels in face
DARK_PIXEL_THRESHOLD = 80   # Brightness below this = dark
DARK_PIXEL_COUNT_MAX = 50   # Max allowed dark pixels in face
EDGE_DARK_THRESHOLD = 100   # Brightness threshold for edge fringing


def analyze_frame(img_path: Path, face_region: tuple, strict: bool = False) -> dict:
    """Analyze a single frame for artifacts."""
    img = Image.open(img_path)
    if img.mode != 'RGBA':
        return {"path": img_path, "ok": True, "issues": []}
    
    issues = []
    r, g, b, a = img.split()
    
    # Convert to pixel data
    r_data = list(r.getdata())
    g_data = list(g.getdata())
    b_data = list(b.getdata())
    a_data = list(a.getdata())
    
    width, height = img.size
    x1, y1, x2, y2 = face_region
    
    # 1. Check semi-transparent pixels in face region
    semi_trans_count = 0
    dark_in_face = 0
    
    for y in range(max(0, y1), min(height, y2)):
        for x in range(max(0, x1), min(width, x2)):
            idx = y * width + x
            alpha = a_data[idx]
            
            # Semi-transparent (not fully transparent or opaque)
            if 10 < alpha < 245:
                semi_trans_count += 1
            
            # Dark pixel with alpha (potential artifact)
            if alpha > 128:
                brightness = (r_data[idx] + g_data[idx] + b_data[idx]) / 3
                if brightness < DARK_PIXEL_THRESHOLD:
                    dark_in_face += 1
    
    if semi_trans_count > SEMI_TRANS_THRESHOLD:
        issues.append(f"semi-transparent pixels in face: {semi_trans_count}")
    
    if dark_in_face > DARK_PIXEL_COUNT_MAX:
        issues.append(f"dark pixels in face region: {dark_in_face}")
    
    # 2. Check edge fringing (dark pixels adjacent to transparent)
    edge_dark = 0
    for y in range(1, height - 1):
        for x in range(1, width - 1):
            idx = y * width + x
            alpha = a_data[idx]
            
            if alpha > 200:  # Opaque pixel
                # Check if adjacent to transparent
                neighbors = [
                    a_data[(y-1) * width + x],
                    a_data[(y+1) * width + x],
                    a_data[y * width + (x-1)],
                    a_data[y * width + (x+1)],
                ]
                if any(n < 50 for n in neighbors):
                    # This is an edge pixel - check if dark
                    brightness = (r_data[idx] + g_data[idx] + b_data[idx]) / 3
                    if brightness < EDGE_DARK_THRESHOLD:
                        edge_dark += 1
    
    edge_threshold = 500 if strict else 1000
    if edge_dark > edge_threshold:
        issues.append(f"dark edge fringing: {edge_dark} pixels")
    
    return {
        "path": img_path,
        "ok": len(issues) == 0,
        "issues": issues,
        "stats": {
            "semi_trans": semi_trans_count,
            "dark_face": dark_in_face,
            "edge_dark": edge_dark
        }
    }


def main(args):
    frames_dir = Path(args.frames_dir)
    frames = sorted(frames_dir.glob("*.png"))
    
    if not frames:
        print(f"No PNG files found in {frames_dir}")
        return 1
    
    face_region = tuple(args.face_region) if args.face_region else DEFAULT_FACE_REGION
    
    print(f"Auto QC: {len(frames)} frames")
    print(f"Face region: {face_region}")
    print(f"Mode: {'strict' if args.strict else 'normal'}")
    print()
    
    failed = []
    passed = 0
    
    for f in frames:
        result = analyze_frame(f, face_region, args.strict)
        if result["ok"]:
            passed += 1
            if args.verbose:
                print(f"  ✓ {f.name}")
        else:
            failed.append(result)
            print(f"  ✗ {f.name}: {', '.join(result['issues'])}")
    
    print()
    print(f"Results: {passed}/{len(frames)} passed")
    
    if failed:
        print(f"\nFailed frames ({len(failed)}):")
        for r in failed:
            print(f"  - {r['path'].name}: {r['issues']}")
        return 1
    else:
        print("✓ All frames passed QC")
        return 0


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Automated Sprite QC")
    parser.add_argument("frames_dir", help="Directory of transparent PNG frames")
    parser.add_argument("--face-region", nargs=4, type=int, metavar=("X1", "Y1", "X2", "Y2"),
                        help="Face region for artifact detection")
    parser.add_argument("--strict", action="store_true", help="Stricter thresholds")
    parser.add_argument("--verbose", "-v", action="store_true", help="Show all results")
    
    args = parser.parse_args()
    sys.exit(main(args))
