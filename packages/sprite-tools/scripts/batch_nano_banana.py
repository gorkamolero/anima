#!/usr/bin/env python3
"""
Batch process grids through Nano Banana for white/black matte extraction.

Usage:
  # Process all grids in directory
  python batch_nano_banana.py ./grids --output-dir ./processed

  # Process only first N grids (for testing)
  python batch_nano_banana.py ./grids --output-dir ./processed --limit 1

  # Custom throttle delay
  python batch_nano_banana.py ./grids --output-dir ./processed --delay 5

Process:
  1. Read metadata.json from grids directory
  2. For each grid, generate white and black versions via Nano Banana
  3. Save results with proper naming: grid-01-white.png, grid-01-black.png
  4. Update metadata with processed files
"""

import argparse
import subprocess
import os
import sys
import json
import time
from pathlib import Path
from PIL import Image


# Nano Banana script location
NANO_BANANA_SCRIPT = Path.home() / ".clawdbot/skills/nano-banana-pro/scripts/generate_image.py"

# Try to load API key from moltbot config
def get_gemini_api_key():
    """Load Gemini API key from moltbot config or environment."""
    # Check environment first
    if os.environ.get("GEMINI_API_KEY"):
        return os.environ["GEMINI_API_KEY"]
    
    # Try moltbot config
    config_path = Path.home() / ".moltbot/moltbot.json"
    if config_path.exists():
        try:
            with open(config_path) as f:
                config = json.load(f)
            return config.get("skills", {}).get("entries", {}).get("nano-banana-pro", {}).get("apiKey")
        except:
            pass
    
    return None

# Prompts for matte extraction
PROMPT_WHITE = "change the background color to pure solid WHITE #FFFFFF. keep everything else exactly the same"
PROMPT_BLACK = "change the background color to pure solid BLACK #000000. keep everything else exactly the same"


def eval_background(white_path: Path, black_path: Path, threshold: int = 5, margin: int = 20) -> dict:
    """
    Evaluate if white/black backgrounds are clean.
    Samples pixels 'margin' px from edges to avoid anti-aliasing artifacts.
    Returns dict with pass/fail status and issues.
    """
    result = {"pass": True, "white_ok": False, "black_ok": False, "issues": []}
    
    def check_image(path: Path, expect_white: bool) -> bool:
        try:
            img = Image.open(path).convert('RGB')
            w, h = img.size
            
            # Sample corners, avoiding edges
            samples = [
                img.getpixel((margin, margin)),
                img.getpixel((w - margin, margin)),
                img.getpixel((margin, h - margin)),
                img.getpixel((w - margin, h - margin)),
            ]
            
            if expect_white:
                return all(all(v >= 255 - threshold for v in c) for c in samples)
            else:
                return all(all(v <= threshold for v in c) for c in samples)
        except Exception as e:
            return False
    
    if white_path and white_path.exists():
        result["white_ok"] = check_image(white_path, expect_white=True)
        if not result["white_ok"]:
            result["issues"].append("white background not clean")
    else:
        result["issues"].append("white image missing")
    
    if black_path and black_path.exists():
        result["black_ok"] = check_image(black_path, expect_white=False)
        if not result["black_ok"]:
            result["issues"].append("black background not clean")
    else:
        result["issues"].append("black image missing")
    
    result["pass"] = result["white_ok"] and result["black_ok"]
    return result


def run_nano_banana(input_path: Path, output_path: Path, prompt: str, resolution: str = "4K", api_key: str = None) -> bool:
    """Run Nano Banana edit on a single image."""
    cmd = [
        "uv", "run", str(NANO_BANANA_SCRIPT),
        "--input-image", str(input_path),
        "--prompt", prompt,
        "--filename", str(output_path),
        "--resolution", resolution
    ]
    
    if api_key:
        cmd.extend(["--api-key", api_key])
    
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
        
        if result.returncode != 0:
            print(f"    Error: {result.stderr[:200]}")
            return False
        
        if output_path.exists():
            return True
        else:
            print(f"    Error: Output file not created")
            return False
            
    except subprocess.TimeoutExpired:
        print(f"    Error: Timeout after 5 minutes")
        return False
    except Exception as e:
        print(f"    Error: {e}")
        return False


def process_single_grid(grid_path: Path, output_dir: Path, delay: float, api_key: str, max_retries: int = 3) -> dict:
    """Process a single grid with retry logic."""
    grid_name = grid_path.name
    base_name = grid_name.replace("-gray.png", "")
    
    for attempt in range(max_retries):
        if attempt > 0:
            print(f"  ↻ Retry {attempt}/{max_retries-1}...")
        
        # Generate WHITE version
        white_path = output_dir / f"{base_name}-white.png"
        print(f"  → White...", end=" ", flush=True)
        
        if run_nano_banana(grid_path, white_path, PROMPT_WHITE, api_key=api_key):
            print("✓")
        else:
            print("✗")
            white_path = None
        
        time.sleep(delay)
        
        # Generate BLACK version
        black_path = output_dir / f"{base_name}-black.png"
        print(f"  → Black...", end=" ", flush=True)
        
        if run_nano_banana(grid_path, black_path, PROMPT_BLACK, api_key=api_key):
            print("✓")
        else:
            print("✗")
            black_path = None
        
        # Evaluate backgrounds
        eval_result = eval_background(white_path, black_path)
        eval_status = "✓ PASS" if eval_result["pass"] else f"✗ FAIL ({', '.join(eval_result['issues'])})"
        print(f"  → Eval: {eval_status}")
        
        if eval_result["pass"]:
            return {
                "grid": grid_name,
                "white": str(white_path.name) if white_path and white_path.exists() else None,
                "black": str(black_path.name) if black_path and black_path.exists() else None,
                "eval_pass": True,
                "eval_issues": [],
                "attempts": attempt + 1
            }
        
        if attempt < max_retries - 1:
            time.sleep(delay)
    
    # All retries exhausted
    return {
        "grid": grid_name,
        "white": str(white_path.name) if white_path and white_path.exists() else None,
        "black": str(black_path.name) if black_path and black_path.exists() else None,
        "eval_pass": False,
        "eval_issues": eval_result["issues"],
        "attempts": max_retries
    }


def process_grids(grids_dir: Path, output_dir: Path, limit: int = None, delay: float = 2.0, api_key: str = None, max_retries: int = 3, retry_failed: bool = False):
    """Process grids through Nano Banana."""
    
    # Get API key
    if not api_key:
        api_key = get_gemini_api_key()
    
    if not api_key:
        print("Error: No Gemini API key found.")
        print("Set GEMINI_API_KEY environment variable or configure in moltbot.json")
        sys.exit(1)
    
    # Load metadata
    meta_path = grids_dir / "metadata.json"
    if not meta_path.exists():
        print(f"Error: metadata.json not found in {grids_dir}")
        sys.exit(1)
    
    with open(meta_path) as f:
        meta = json.load(f)
    
    grids = meta["output"]["grids"]
    
    output_dir.mkdir(parents=True, exist_ok=True)
    
    # If retry_failed mode, only process failed grids from previous run
    existing_results = []
    grids_to_process = []
    
    if retry_failed:
        results_path = output_dir / "batch_results.json"
        if results_path.exists():
            with open(results_path) as f:
                prev_batch = json.load(f)
            
            for r in prev_batch["results"]:
                if r.get("eval_pass"):
                    existing_results.append(r)
                else:
                    grids_to_process.append(r["grid"])
            
            print(f"Retry mode: {len(grids_to_process)} failed grids to reprocess")
        else:
            print("No previous batch_results.json found, processing all grids")
            grids_to_process = grids
    else:
        grids_to_process = grids
    
    if limit:
        grids_to_process = grids_to_process[:limit]
    
    print(f"Processing {len(grids_to_process)} grids...")
    print(f"Throttle delay: {delay}s between requests")
    print(f"Max retries per grid: {max_retries}")
    print()
    
    results = list(existing_results)
    
    for i, grid_name in enumerate(grids_to_process):
        grid_path = grids_dir / grid_name
        
        print(f"[{i+1}/{len(grids_to_process)}] {grid_name}")
        
        result = process_single_grid(grid_path, output_dir, delay, api_key, max_retries)
        
        # Update or add result
        existing_idx = next((j for j, r in enumerate(results) if r["grid"] == grid_name), None)
        if existing_idx is not None:
            results[existing_idx] = result
        else:
            results.append(result)
        
        if i < len(grids_to_process) - 1:
            time.sleep(delay)
    
    # Save processing results
    results_meta = {
        "source_metadata": str(meta_path),
        "grids_processed": len(grids),
        "results": results
    }
    
    with open(output_dir / "batch_results.json", "w") as f:
        json.dump(results_meta, f, indent=2)
    
    # Summary
    print()
    successful = sum(1 for r in results if r["white"] and r["black"])
    eval_passed = sum(1 for r in results if r.get("eval_pass"))
    print(f"✓ Completed: {successful}/{len(grids)} grids processed")
    print(f"✓ Eval: {eval_passed}/{len(grids)} passed background check")
    
    # List failures
    failures = [r for r in results if not r.get("eval_pass")]
    if failures:
        print(f"\n⚠ Failed grids:")
        for r in failures:
            print(f"  - {r['grid']}: {', '.join(r.get('eval_issues', ['unknown']))}")
    
    print(f"\nResults saved to {output_dir / 'batch_results.json'}")
    
    return results


def main():
    parser = argparse.ArgumentParser(description="Batch process grids through Nano Banana")
    parser.add_argument("grids_dir", help="Directory containing grids and metadata.json")
    parser.add_argument("--output-dir", "-o", required=True, help="Output directory for processed grids")
    parser.add_argument("--limit", "-n", type=int, help="Process only first N grids (for testing)")
    parser.add_argument("--delay", "-d", type=float, default=2.0, help="Delay between API calls in seconds (default: 2)")
    parser.add_argument("--retries", "-r", type=int, default=3, help="Max retries per grid if eval fails (default: 3)")
    parser.add_argument("--retry-failed", action="store_true", help="Only retry grids that failed in previous run")
    
    args = parser.parse_args()
    
    grids_dir = Path(args.grids_dir)
    output_dir = Path(args.output_dir)
    
    if not grids_dir.exists():
        print(f"Error: Directory not found: {grids_dir}")
        sys.exit(1)
    
    if not NANO_BANANA_SCRIPT.exists():
        print(f"Error: Nano Banana script not found at {NANO_BANANA_SCRIPT}")
        sys.exit(1)
    
    process_grids(grids_dir, output_dir, args.limit, args.delay, max_retries=args.retries, retry_failed=args.retry_failed)


if __name__ == "__main__":
    main()
