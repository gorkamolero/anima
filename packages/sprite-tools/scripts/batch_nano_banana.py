#!/usr/bin/env python3
# /// script
# requires-python = ">=3.10"
# dependencies = ["pillow", "google-generativeai"]
# ///
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
import logging
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timedelta
from pathlib import Path
from PIL import Image

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    datefmt='%H:%M:%S'
)
log = logging.getLogger("batch_nano")


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


def run_nano_banana(input_path: Path, output_path: Path, prompt: str, resolution: str = "4K", api_key: str = None, call_timeout: int = 300) -> bool:
    """Run Nano Banana edit on a single image with timing and stall detection."""
    cmd = [
        "uv", "run", str(NANO_BANANA_SCRIPT),
        "--input-image", str(input_path),
        "--prompt", prompt,
        "--filename", str(output_path),
        "--resolution", resolution
    ]
    
    if api_key:
        cmd.extend(["--api-key", api_key])
    
    start = time.monotonic()
    variant = "white" if "WHITE" in prompt else "black"
    log.info(f"API call started: {input_path.name} → {variant} (timeout: {call_timeout}s)")
    
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=call_timeout)
        elapsed = time.monotonic() - start
        
        if result.returncode != 0:
            log.error(f"API call FAILED after {elapsed:.1f}s: {result.stderr[:200]}")
            return False
        
        if output_path.exists():
            size_mb = output_path.stat().st_size / (1024 * 1024)
            log.info(f"API call OK: {elapsed:.1f}s, {size_mb:.1f} MB → {output_path.name}")
            if elapsed > 120:
                log.warning(f"Slow call: {elapsed:.1f}s (>{120}s threshold)")
            return True
        else:
            log.error(f"API call returned OK but no output file after {elapsed:.1f}s")
            return False
            
    except subprocess.TimeoutExpired:
        elapsed = time.monotonic() - start
        log.error(f"TIMEOUT: {input_path.name} → {variant} after {elapsed:.1f}s — killing subprocess")
        return False
    except Exception as e:
        elapsed = time.monotonic() - start
        log.error(f"EXCEPTION after {elapsed:.1f}s: {e}")
        return False


def process_single_grid(grid_path: Path, output_dir: Path, delay: float, api_key: str, max_retries: int = 3, call_timeout: int = 300) -> dict:
    """Process a single grid with retry logic and logging."""
    grid_name = grid_path.name
    base_name = grid_name.replace("-gray.png", "")
    grid_start = time.monotonic()
    
    for attempt in range(max_retries):
        if attempt > 0:
            log.info(f"↻ Retry {attempt}/{max_retries-1} for {grid_name}")
        
        # Generate WHITE version
        white_path = output_dir / f"{base_name}-white.png"
        white_ok = run_nano_banana(grid_path, white_path, PROMPT_WHITE, api_key=api_key, call_timeout=call_timeout)
        if not white_ok:
            white_path = None
        
        time.sleep(delay)
        
        # Generate BLACK version
        black_path = output_dir / f"{base_name}-black.png"
        black_ok = run_nano_banana(grid_path, black_path, PROMPT_BLACK, api_key=api_key, call_timeout=call_timeout)
        if not black_ok:
            black_path = None
        
        # Evaluate backgrounds
        eval_result = eval_background(white_path, black_path)
        grid_elapsed = time.monotonic() - grid_start
        
        if eval_result["pass"]:
            log.info(f"✓ {grid_name} PASSED eval (attempt {attempt+1}, {grid_elapsed:.1f}s total)")
            return {
                "grid": grid_name,
                "white": str(white_path.name) if white_path and white_path.exists() else None,
                "black": str(black_path.name) if black_path and black_path.exists() else None,
                "eval_pass": True,
                "eval_issues": [],
                "attempts": attempt + 1,
                "elapsed_s": round(grid_elapsed, 1)
            }
        else:
            log.warning(f"✗ {grid_name} FAILED eval: {', '.join(eval_result['issues'])} (attempt {attempt+1})")
        
        if attempt < max_retries - 1:
            time.sleep(delay)
    
    # All retries exhausted
    grid_elapsed = time.monotonic() - grid_start
    log.error(f"✗ {grid_name} EXHAUSTED {max_retries} retries ({grid_elapsed:.1f}s total)")
    return {
        "grid": grid_name,
        "white": str(white_path.name) if white_path and white_path.exists() else None,
        "black": str(black_path.name) if black_path and black_path.exists() else None,
        "eval_pass": False,
        "eval_issues": eval_result["issues"],
        "attempts": max_retries,
        "elapsed_s": round(grid_elapsed, 1)
    }


def process_grids(grids_dir: Path, output_dir: Path, limit: int = None, delay: float = 2.0, api_key: str = None, max_retries: int = 3, retry_failed: bool = False, call_timeout: int = 300, concurrency: int = 1):
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
    
    total = len(grids_to_process)
    effective_concurrency = min(concurrency, total) if concurrency > 1 else 1
    log.info(f"Processing {total} grids (concurrency: {effective_concurrency}, delay: {delay}s, retries: {max_retries}, timeout: {call_timeout}s/call)")
    pipeline_start = time.monotonic()
    
    results = list(existing_results)
    results_lock = threading.Lock()
    call_times = []
    completed_count = [0]  # mutable for closure
    
    def _process_grid(idx_and_name):
        idx, grid_name = idx_and_name
        grid_path = grids_dir / grid_name
        
        log.info(f"━━━ [{idx+1}/{total}] {grid_name} ━━━")
        
        result = process_single_grid(grid_path, output_dir, delay, api_key, max_retries, call_timeout)
        
        with results_lock:
            completed_count[0] += 1
            done = completed_count[0]
            
            # Track timing for ETA
            if result.get("elapsed_s"):
                call_times.append(result["elapsed_s"])
                avg_time = sum(call_times) / len(call_times)
                remaining = total - done
                eta_s = avg_time * remaining / max(effective_concurrency, 1)
                log.info(f"Progress: {done}/{total} done | avg {avg_time:.0f}s/grid | ETA: {timedelta(seconds=int(eta_s))}")
            
            # Update or add result
            existing_idx = next((j for j, r in enumerate(results) if r["grid"] == grid_name), None)
            if existing_idx is not None:
                results[existing_idx] = result
            else:
                results.append(result)
        
        return result
    
    if effective_concurrency > 1:
        with ThreadPoolExecutor(max_workers=effective_concurrency) as executor:
            futures = {
                executor.submit(_process_grid, (i, name)): name 
                for i, name in enumerate(grids_to_process)
            }
            for future in as_completed(futures):
                try:
                    future.result()
                except Exception as e:
                    grid_name = futures[future]
                    log.error(f"Grid {grid_name} raised exception: {e}")
    else:
        for i, grid_name in enumerate(grids_to_process):
            _process_grid((i, grid_name))
            if i < len(grids_to_process) - 1:
                time.sleep(delay)
    
    pipeline_elapsed = time.monotonic() - pipeline_start
    log.info(f"Pipeline complete: {timedelta(seconds=int(pipeline_elapsed))} total")
    
    # Save processing results
    results_meta = {
        "source_metadata": str(meta_path),
        "grids_processed": len(grids),
        "results": results
    }
    
    with open(output_dir / "batch_results.json", "w") as f:
        json.dump(results_meta, f, indent=2)
    
    # Summary
    successful = sum(1 for r in results if r["white"] and r["black"])
    eval_passed = sum(1 for r in results if r.get("eval_pass"))
    log.info(f"═══ SUMMARY ═══")
    log.info(f"Completed: {successful}/{len(grids)} grids processed")
    log.info(f"Eval: {eval_passed}/{len(grids)} passed background check")
    
    # List failures
    failures = [r for r in results if not r.get("eval_pass")]
    if failures:
        log.warning(f"{len(failures)} failed grids:")
        for r in failures:
            log.warning(f"  - {r['grid']}: {', '.join(r.get('eval_issues', ['unknown']))}")
    
    log.info(f"Results saved to {output_dir / 'batch_results.json'}")
    
    return results


def main():
    parser = argparse.ArgumentParser(description="Batch process grids through Nano Banana")
    parser.add_argument("grids_dir", help="Directory containing grids and metadata.json")
    parser.add_argument("--output-dir", "-o", required=True, help="Output directory for processed grids")
    parser.add_argument("--limit", "-n", type=int, help="Process only first N grids (for testing)")
    parser.add_argument("--delay", "-d", type=float, default=2.0, help="Delay between API calls in seconds (default: 2)")
    parser.add_argument("--retries", "-r", type=int, default=3, help="Max retries per grid if eval fails (default: 3)")
    parser.add_argument("--retry-failed", action="store_true", help="Only retry grids that failed in previous run")
    parser.add_argument("--timeout", "-t", type=int, default=300, help="Timeout per API call in seconds (default: 300)")
    parser.add_argument("--concurrency", "-c", type=int, default=3, help="Parallel grid processing (default: 3)")
    
    args = parser.parse_args()
    
    grids_dir = Path(args.grids_dir)
    output_dir = Path(args.output_dir)
    
    if not grids_dir.exists():
        log.error(f"Directory not found: {grids_dir}")
        sys.exit(1)
    
    if not NANO_BANANA_SCRIPT.exists():
        log.error(f"Nano Banana script not found at {NANO_BANANA_SCRIPT}")
        sys.exit(1)
    
    process_grids(grids_dir, output_dir, args.limit, args.delay, max_retries=args.retries, retry_failed=args.retry_failed, call_timeout=args.timeout, concurrency=args.concurrency)


if __name__ == "__main__":
    main()
