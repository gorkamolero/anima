#!/usr/bin/env python3
"""
Pipeline B: Full sprite extraction via Nano Banana matte extraction.

Usage:
  # Full pipeline
  python pipeline_b.py video.mov -o ./output

  # Test with 1 grid only
  python pipeline_b.py video.mov -o ./output --limit 1

  # Skip steps (if already done)
  python pipeline_b.py video.mov -o ./output --skip-grids --skip-nano

Steps:
  0. loopycut             — Detect loop points (REQUIRED)
  1. create_grids.py      — Video → 4K grids
  2. batch_nano_banana.py — Grids → White/Black + Eval
  3. extract_matte.py     — White/Black → Alpha
  4. reassemble_video.py  — Alpha → Output (MP4 + spritesheet)
"""

import argparse
import subprocess
import sys
import json
from pathlib import Path

SCRIPTS_DIR = Path(__file__).parent
LOOPYCUT_DIR = SCRIPTS_DIR.parent / "tools" / "loopycut"
VENV_PYTHON = LOOPYCUT_DIR / ".venv" / "bin" / "python"

# Use venv python for all steps (has PIL, opencv, etc.)
if VENV_PYTHON.exists():
    PYTHON = str(VENV_PYTHON)
else:
    PYTHON = sys.executable


def run_step(name: str, cmd: list, check_output: Path = None, cwd: Path = None) -> bool:
    """Run a pipeline step and check for success."""
    print(f"\n{'='*60}")
    print(f"STEP: {name}")
    print(f"{'='*60}")
    print(f"$ {' '.join(str(c) for c in cmd)}\n")
    
    result = subprocess.run(cmd, cwd=cwd)
    
    if result.returncode != 0:
        print(f"\n✗ FAILED: {name}")
        return False
    
    if check_output and not check_output.exists():
        print(f"\n✗ FAILED: Expected output not found: {check_output}")
        return False
    
    print(f"\n✓ {name} complete")
    return True


def run_loopycut(video: Path, output_dir: Path) -> dict:
    """Run loopycut to detect loop and return metadata."""
    loop_video = output_dir / "loop.mp4"
    metadata_file = output_dir / "loop.json"
    
    loopycut_cli = LOOPYCUT_DIR / "cli.py"
    
    cmd = [
        PYTHON, str(loopycut_cli),
        str(video), str(loop_video),
        "--save-metadata",
        "--no-audio"
    ]
    
    if not run_step("LoopyCut (Detect Loop)", cmd, metadata_file):
        return None
    
    with open(metadata_file) as f:
        return json.load(f)


def main():
    parser = argparse.ArgumentParser(description="Pipeline B: Nano Banana matte extraction")
    parser.add_argument("video", help="Input video file")
    parser.add_argument("-o", "--output", required=True, help="Output directory")
    parser.add_argument("--limit", "-n", type=int, help="Limit number of grids to process (for testing)")
    parser.add_argument("--skip-grids", action="store_true", help="Skip grid creation (use existing)")
    parser.add_argument("--skip-nano", action="store_true", help="Skip Nano Banana (use existing white/black)")
    parser.add_argument("--skip-matte", action="store_true", help="Skip matte extraction (use existing alpha)")
    
    args = parser.parse_args()
    
    video = Path(args.video)
    output = Path(args.output)
    
    if not video.exists():
        print(f"Error: Video not found: {video}")
        sys.exit(1)
    
    # Directory structure
    grids_dir = output / "grids"
    processed_dir = output / "processed"
    alpha_dir = output / "alpha"
    
    output.mkdir(parents=True, exist_ok=True)
    
    # Step 0: LoopyCut (detect loop) - REQUIRED
    loop_meta = run_loopycut(video, output)
    if not loop_meta:
        print(f"\n✗ Loopycut failed - cannot continue without loop detection")
        sys.exit(1)
    
    loop_info = loop_meta.get("loop_info", {})
    frame_count = loop_info.get("frame_count") or loop_meta.get("frame_count", loop_meta.get("total_frames"))
    if not frame_count:
        print(f"\n✗ Loopycut metadata missing frame_count")
        sys.exit(1)
    
    loop_video = output / "loop.mp4"
    print(f"\n→ Detected loop: {frame_count} frames")
    
    print(f"""
╔══════════════════════════════════════════════════════════╗
║                    PIPELINE B                            ║
║         Nano Banana Matte Extraction                     ║
╚══════════════════════════════════════════════════════════╝

Input:  {video}
Loop:   {loop_video}
Output: {output}
Frames: {frame_count}
Limit:  {args.limit or 'all'}
""")

    # Step 1: Create grids
    if not args.skip_grids:
        cmd = [
            PYTHON, str(SCRIPTS_DIR / "create_grids.py"),
            str(loop_video),
            "-o", str(grids_dir),
            "--frames", str(frame_count)
        ]
        if not run_step("Create Grids (Video → 4K Grids)", cmd, grids_dir / "metadata.json"):
            sys.exit(1)
    else:
        print("\n[Skipping grid creation]")
    
    # Step 2: Nano Banana (white/black + eval)
    if not args.skip_nano:
        cmd = [
            PYTHON, str(SCRIPTS_DIR / "batch_nano_banana.py"),
            str(grids_dir),
            "-o", str(processed_dir)
        ]
        if args.limit:
            cmd.extend(["--limit", str(args.limit)])
        
        if not run_step("Nano Banana (Grids → White/Black + Eval)", cmd, processed_dir / "batch_results.json"):
            sys.exit(1)
        
        # Check eval results
        with open(processed_dir / "batch_results.json") as f:
            batch_results = json.load(f)
        
        failures = [r for r in batch_results["results"] if not r.get("eval_pass")]
        if failures:
            print(f"\n⚠ WARNING: {len(failures)} grid(s) failed background eval:")
            for r in failures:
                print(f"  - {r['grid']}: {', '.join(r.get('eval_issues', []))}")
            print("\nContinuing anyway (matte quality may be affected)")
    else:
        print("\n[Skipping Nano Banana]")
    
    # Step 3: Extract matte
    if not args.skip_matte:
        cmd = [
            PYTHON, str(SCRIPTS_DIR / "extract_matte.py"),
            str(processed_dir),
            "-o", str(alpha_dir)
        ]
        
        if not run_step("Extract Matte (White/Black → Alpha)", cmd):
            sys.exit(1)
    else:
        print("\n[Skipping matte extraction]")
    
    # Step 4: Reassemble
    cmd = [
        PYTHON, str(SCRIPTS_DIR / "reassemble_video.py"),
        str(grids_dir),
        "--alpha-dir", str(alpha_dir),
        "-o", str(output / "final")
    ]
    if not run_step("Reassemble (Alpha → Output)", cmd):
        sys.exit(1)
    
    # Summary
    print(f"""
╔══════════════════════════════════════════════════════════╗
║                    PIPELINE COMPLETE                     ║
╚══════════════════════════════════════════════════════════╝

Output directory: {output / 'final'}

Check for:
  - spritesheet.png (for game engines)
  - preview.mp4 (for review)
  - metadata.json (frame info)
""")


if __name__ == "__main__":
    main()
