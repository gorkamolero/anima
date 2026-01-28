#!/usr/bin/env python3
"""
Automated Sprite QC v2 - Compares processed vs original to detect artifacts.

Detects pixels that were DARKENED by rembg processing (true artifacts).
Ignores intentional design elements (freckles, shadows in original).

Usage:
  python auto_qc_v2.py <processed_dir> <original_dir> [options]

Examples:
  python auto_qc_v2.py ./transparent ./original --crop 90 90
"""

import argparse
from pathlib import Path
from PIL import Image
import sys

# Thresholds
BRIGHTNESS_DIFF_THRESHOLD = 15  # Min brightness change to count as artifact
ARTIFACT_COUNT_THRESHOLD = 1000  # Max allowed darkened pixels per frame


def compare_frames(proc_path: Path, orig_path: Path, crop_top: int = 0, crop_bottom: int = 0) -> dict:
    """Compare processed vs original frame, count artifacts."""
    proc = Image.open(proc_path).convert('RGBA')
    orig = Image.open(orig_path).convert('RGBA')
    
    # Crop original to match processed (if letterbox was removed)
    if crop_top or crop_bottom:
        w, h = orig.size
        orig = orig.crop((0, crop_top, w, h - crop_bottom))
    
    # Verify sizes match
    if proc.size != orig.size:
        return {"path": proc_path, "ok": False, "issues": [f"Size mismatch: {proc.size} vs {orig.size}"], "darkened": 0}
    
    proc_r, proc_g, proc_b, proc_a = [list(c.getdata()) for c in proc.split()]
    orig_r, orig_g, orig_b, _ = [list(c.getdata()) for c in orig.split()]
    
    darkened = 0
    character_pixels = 0
    
    for i in range(len(proc_a)):
        if proc_a[i] > 128:  # Character pixel
            character_pixels += 1
            orig_bright = (orig_r[i] + orig_g[i] + orig_b[i]) / 3
            proc_bright = (proc_r[i] + proc_g[i] + proc_b[i]) / 3
            
            # Pixel was darkened by processing
            if orig_bright - proc_bright > BRIGHTNESS_DIFF_THRESHOLD:
                darkened += 1
    
    issues = []
    if darkened > ARTIFACT_COUNT_THRESHOLD:
        issues.append(f"darkened pixels: {darkened}")
    
    return {
        "path": proc_path,
        "ok": len(issues) == 0,
        "issues": issues,
        "darkened": darkened,
        "character_pixels": character_pixels
    }


def main(args):
    proc_dir = Path(args.processed_dir)
    orig_dir = Path(args.original_dir)
    
    proc_frames = sorted(proc_dir.glob("*.png"))
    
    if not proc_frames:
        print(f"No PNG files found in {proc_dir}")
        return 1
    
    crop_top, crop_bottom = args.crop if args.crop else (0, 0)
    
    print(f"Auto QC v2: {len(proc_frames)} frames")
    print(f"Comparing: {proc_dir} vs {orig_dir}")
    if crop_top or crop_bottom:
        print(f"Crop: {crop_top}px top, {crop_bottom}px bottom")
    print()
    
    failed = []
    passed = 0
    all_results = []
    
    for pf in proc_frames:
        # Find matching original (handle different naming patterns)
        # frame-01.png -> frame-001.png
        stem = pf.stem
        if stem.startswith("frame-") and len(stem) == 8:  # frame-01
            orig_name = f"frame-{int(stem.split('-')[1]):03d}.png"
        else:
            orig_name = pf.name
        
        orig_path = orig_dir / orig_name
        if not orig_path.exists():
            print(f"  ? {pf.name}: original not found ({orig_name})")
            continue
        
        result = compare_frames(pf, orig_path, crop_top, crop_bottom)
        all_results.append(result)
        
        if result["ok"]:
            passed += 1
            if args.verbose:
                print(f"  ✓ {pf.name} (darkened: {result['darkened']})")
        else:
            failed.append(result)
            print(f"  ✗ {pf.name}: {', '.join(result['issues'])}")
    
    print()
    print(f"Results: {passed}/{len(all_results)} passed")
    
    if all_results:
        avg_darkened = sum(r['darkened'] for r in all_results) / len(all_results)
        max_darkened = max(r['darkened'] for r in all_results)
        print(f"Average darkened pixels: {avg_darkened:.0f}")
        print(f"Max darkened pixels: {max_darkened}")
    
    # Generate JSON report
    report = {
        "total_frames": len(all_results),
        "passed": passed,
        "failed": len(failed),
        "threshold": ARTIFACT_COUNT_THRESHOLD,
        "avg_darkened": sum(r['darkened'] for r in all_results) / len(all_results) if all_results else 0,
        "frames": [
            {
                "name": r['path'].name,
                "ok": r['ok'],
                "darkened": r['darkened'],
                "issues": r['issues']
            }
            for r in all_results
        ]
    }
    
    if args.output:
        import json
        with open(args.output, 'w') as f:
            json.dump(report, f, indent=2)
        print(f"\nReport saved: {args.output}")
    
    if failed:
        print(f"\nFailed frames ({len(failed)}):")
        for r in sorted(failed, key=lambda x: x['darkened'], reverse=True)[:10]:
            print(f"  - {r['path'].name}: {r['darkened']} darkened")
        return 1
    else:
        print("\n✓ All frames passed QC")
        return 0


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Automated Sprite QC v2")
    parser.add_argument("processed_dir", help="Directory of processed transparent frames")
    parser.add_argument("original_dir", help="Directory of original source frames")
    parser.add_argument("--crop", nargs=2, type=int, metavar=("TOP", "BOTTOM"),
                        help="Crop applied to originals")
    parser.add_argument("--threshold", type=int, default=ARTIFACT_COUNT_THRESHOLD,
                        help=f"Max darkened pixels (default: {ARTIFACT_COUNT_THRESHOLD})")
    parser.add_argument("--verbose", "-v", action="store_true", help="Show all results")
    parser.add_argument("--output", "-o", help="Output JSON report path")
    
    args = parser.parse_args()
    sys.exit(main(args))
