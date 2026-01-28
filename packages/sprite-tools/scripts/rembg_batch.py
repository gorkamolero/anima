#!/usr/bin/env python3
"""
Batch background removal via Replicate rembg API.
Processes frames INDIVIDUALLY (not as grid) to avoid multi-subject confusion.

Usage:
  python rembg_batch.py <input_dir> <output_dir> [--concurrency N] [--crop TOP BOTTOM]

Examples:
  # Process all PNGs in a directory
  python rembg_batch.py ./intro ./intro-transparent --concurrency 5
  
  # With letterbox cropping (90px from top and bottom)
  python rembg_batch.py ./intro ./intro-transparent --crop 90 90
"""

import asyncio
import aiohttp
import base64
import os
import sys
import argparse
from pathlib import Path
from PIL import Image
import io

# Config
REPLICATE_TOKEN = os.environ.get("REPLICATE_API_TOKEN")
if not REPLICATE_TOKEN:
    raise ValueError("REPLICATE_API_TOKEN environment variable required")
MODEL_VERSION = "fb8af171cfa1616ddcf1242c093f9c46bcada5ad4cf6f2fbe8b81b330ec5c003"
API_URL = "https://api.replicate.com/v1/predictions"


async def create_prediction(session: aiohttp.ClientSession, image_data: bytes) -> str:
    """Create a prediction and return the prediction ID."""
    b64 = base64.b64encode(image_data).decode()
    data_uri = f"data:image/png;base64,{b64}"
    
    async with session.post(
        API_URL,
        json={"version": MODEL_VERSION, "input": {"image": data_uri}},
        headers={"Authorization": f"Token {REPLICATE_TOKEN}", "Content-Type": "application/json"}
    ) as resp:
        result = await resp.json()
        if "id" not in result:
            raise Exception(f"API error: {result}")
        return result["id"]


async def poll_prediction(session: aiohttp.ClientSession, pred_id: str, max_wait: int = 120) -> str:
    """Poll until prediction completes, return output URL."""
    url = f"{API_URL}/{pred_id}"
    for _ in range(max_wait // 2):
        async with session.get(url, headers={"Authorization": f"Token {REPLICATE_TOKEN}"}) as resp:
            result = await resp.json()
            status = result.get("status")
            if status == "succeeded":
                return result.get("output")
            elif status == "failed":
                raise Exception(f"Prediction {pred_id} failed: {result.get('error')}")
        await asyncio.sleep(2)
    raise Exception(f"Prediction {pred_id} timed out")


async def download_result(session: aiohttp.ClientSession, url: str) -> bytes:
    """Download the result image."""
    async with session.get(url) as resp:
        return await resp.read()


async def process_frame(
    session: aiohttp.ClientSession,
    semaphore: asyncio.Semaphore,
    input_path: Path,
    output_path: Path,
    crop_top: int = 0,
    crop_bottom: int = 0
) -> bool:
    """Process a single frame with semaphore for concurrency control."""
    async with semaphore:
        try:
            # Load and optionally crop
            img = Image.open(input_path)
            if crop_top or crop_bottom:
                w, h = img.size
                img = img.crop((0, crop_top, w, h - crop_bottom))
            
            # Convert to PNG bytes
            buf = io.BytesIO()
            img.save(buf, format='PNG')
            image_data = buf.getvalue()
            
            # Process via API
            pred_id = await create_prediction(session, image_data)
            output_url = await poll_prediction(session, pred_id)
            result_data = await download_result(session, output_url)
            
            # Save result
            with open(output_path, 'wb') as f:
                f.write(result_data)
            
            print(f"  ✓ {input_path.name}")
            return True
            
        except Exception as e:
            print(f"  ✗ {input_path.name}: {e}")
            return False


async def main(input_dir: str, output_dir: str, concurrency: int = 5, crop_top: int = 0, crop_bottom: int = 0):
    """Main processing function."""
    input_path = Path(input_dir)
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)
    
    # Find all PNG files
    frames = sorted(input_path.glob("*.png"))
    if not frames:
        print(f"No PNG files found in {input_dir}")
        return
    
    print(f"Processing {len(frames)} frames from {input_dir}")
    print(f"Output: {output_dir}")
    print(f"Concurrency: {concurrency}")
    if crop_top or crop_bottom:
        print(f"Cropping: {crop_top}px top, {crop_bottom}px bottom")
    print()
    
    semaphore = asyncio.Semaphore(concurrency)
    
    async with aiohttp.ClientSession() as session:
        tasks = [
            process_frame(
                session, semaphore,
                frame,
                output_path / frame.name,
                crop_top, crop_bottom
            )
            for frame in frames
        ]
        results = await asyncio.gather(*tasks)
    
    success = sum(results)
    print(f"\n✓ Complete: {success}/{len(frames)} frames processed")
    
    return success == len(frames)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Batch background removal via Replicate rembg")
    parser.add_argument("input_dir", help="Directory containing input PNG frames")
    parser.add_argument("output_dir", help="Directory for output transparent PNGs")
    parser.add_argument("--concurrency", type=int, default=5, help="Max concurrent API calls (default: 5)")
    parser.add_argument("--crop", nargs=2, type=int, metavar=("TOP", "BOTTOM"), 
                        help="Crop pixels from top and bottom (e.g., --crop 90 90)")
    
    args = parser.parse_args()
    
    crop_top, crop_bottom = args.crop if args.crop else (0, 0)
    
    success = asyncio.run(main(
        args.input_dir,
        args.output_dir,
        args.concurrency,
        crop_top,
        crop_bottom
    ))
    
    sys.exit(0 if success else 1)
