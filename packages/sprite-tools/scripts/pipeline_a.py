#!/usr/bin/env python3
"""
Complete sprite extraction pipeline.

Usage:
  python sprite_pipeline.py <input_video_or_frames_dir> <output_dir> [options]

Steps:
  1. Extract frames from video (if video input)
  2. Crop letterbox (optional)
  3. Remove background via Replicate rembg API
  4. Threshold alpha to remove artifacts
  5. Generate QC face grid for review
  6. Create ProRes 4444 video

Requirements:
  pip install aiohttp pillow

Examples:
  # From video
  python sprite_pipeline.py ./video.mp4 ./output --crop 90 90 --concurrency 5

  # From frame directory  
  python sprite_pipeline.py ./frames/ ./output --concurrency 5
"""

import asyncio
import aiohttp
import base64
import argparse
import subprocess
import os
import sys
from pathlib import Path
from PIL import Image
import io

# Config
REPLICATE_TOKEN = os.environ.get("REPLICATE_API_TOKEN")
if not REPLICATE_TOKEN:
    raise ValueError("REPLICATE_API_TOKEN environment variable required")
MODEL_VERSION = "fb8af171cfa1616ddcf1242c093f9c46bcada5ad4cf6f2fbe8b81b330ec5c003"
API_URL = "https://api.replicate.com/v1/predictions"


def extract_frames(video_path: Path, output_dir: Path) -> int:
    """Extract frames from video using ffmpeg."""
    output_dir.mkdir(parents=True, exist_ok=True)
    cmd = [
        "ffmpeg", "-y", "-i", str(video_path),
        "-vsync", "0", str(output_dir / "frame-%03d.png")
    ]
    subprocess.run(cmd, capture_output=True)
    return len(list(output_dir.glob("*.png")))


def crop_frame(img: Image.Image, crop_top: int, crop_bottom: int) -> Image.Image:
    """Crop letterbox from frame."""
    w, h = img.size
    return img.crop((0, crop_top, w, h - crop_bottom))


def threshold_alpha(img: Image.Image, threshold: int = 128) -> Image.Image:
    """Threshold alpha channel to remove semi-transparent artifacts."""
    if img.mode != 'RGBA':
        return img
    r, g, b, a = img.split()
    a_thresh = a.point(lambda x: 0 if x < threshold else 255)
    return Image.merge('RGBA', (r, g, b, a_thresh))


def apply_alpha_to_original(rembg_img: Image.Image, original_img: Image.Image, 
                            crop_top: int = 0, crop_bottom: int = 0,
                            threshold: int = 128) -> Image.Image:
    """Use rembg's alpha mask but keep original colors (prevents color artifacts)."""
    # Crop original to match rembg output
    if crop_top or crop_bottom:
        w, h = original_img.size
        original_img = original_img.crop((0, crop_top, w, h - crop_bottom))
    
    # Get alpha from rembg, RGB from original
    orig_r, orig_g, orig_b, _ = original_img.convert('RGBA').split()
    _, _, _, rembg_a = rembg_img.convert('RGBA').split()
    
    # Threshold the alpha
    a_thresh = rembg_a.point(lambda x: 0 if x < threshold else 255)
    
    # Combine: original colors + rembg alpha
    return Image.merge('RGBA', (orig_r, orig_g, orig_b, a_thresh))


async def create_prediction(session: aiohttp.ClientSession, image_data: bytes) -> str:
    """Create a Replicate prediction."""
    b64 = base64.b64encode(image_data).decode()
    data_uri = f"data:image/png;base64,{b64}"
    
    async with session.post(
        API_URL,
        json={"version": MODEL_VERSION, "input": {"image": data_uri}},
        headers={"Authorization": f"Token {REPLICATE_TOKEN}", "Content-Type": "application/json"}
    ) as resp:
        result = await resp.json()
        if "id" not in result:
            if result.get("status") == 429:
                raise Exception("Rate limited - wait and retry")
            raise Exception(f"API error: {result}")
        return result["id"]


async def poll_prediction(session: aiohttp.ClientSession, pred_id: str) -> str:
    """Poll until prediction completes."""
    url = f"{API_URL}/{pred_id}"
    for _ in range(60):
        async with session.get(url, headers={"Authorization": f"Token {REPLICATE_TOKEN}"}) as resp:
            result = await resp.json()
            if result.get("status") == "succeeded":
                return result.get("output")
            elif result.get("status") == "failed":
                raise Exception(f"Failed: {result.get('error')}")
        await asyncio.sleep(2)
    raise Exception("Timeout")


async def download_result(session: aiohttp.ClientSession, url: str) -> bytes:
    """Download result image."""
    async with session.get(url) as resp:
        return await resp.read()


async def process_frame(
    session: aiohttp.ClientSession,
    semaphore: asyncio.Semaphore,
    input_path: Path,
    output_path: Path,
    crop_top: int = 0,
    crop_bottom: int = 0,
    alpha_threshold: int = 128,
    preserve_colors: bool = True
) -> bool:
    """Process a single frame."""
    async with semaphore:
        try:
            # Load original
            original = Image.open(input_path)
            
            # Crop for rembg processing
            if crop_top or crop_bottom:
                img = crop_frame(original, crop_top, crop_bottom)
            else:
                img = original
            
            # Convert to bytes
            buf = io.BytesIO()
            img.save(buf, format='PNG')
            
            # Remove background via API
            pred_id = await create_prediction(session, buf.getvalue())
            output_url = await poll_prediction(session, pred_id)
            result_data = await download_result(session, output_url)
            
            # Load rembg result
            rembg_img = Image.open(io.BytesIO(result_data))
            
            if preserve_colors:
                # Use rembg alpha but keep original colors (prevents color artifacts)
                result_img = apply_alpha_to_original(rembg_img, original, crop_top, crop_bottom, alpha_threshold)
            else:
                # Use rembg output directly (may have color artifacts)
                result_img = threshold_alpha(rembg_img, alpha_threshold)
            
            result_img.save(output_path)
            
            print(f"  ✓ {input_path.name}")
            return True
        except Exception as e:
            print(f"  ✗ {input_path.name}: {e}")
            return False


def create_qc_grid(frames_dir: Path, output_path: Path, region: tuple = (200, 50, 520, 370)):
    """Create QC grid of face regions for review."""
    frames = sorted(frames_dir.glob("*.png"))
    if not frames:
        return
    
    cols = min(8, len(frames))
    rows = (len(frames) + cols - 1) // cols
    thumb_size = 160
    
    grid = Image.new('RGBA', (cols * thumb_size, rows * thumb_size), (40, 40, 40, 255))
    
    for idx, f in enumerate(frames):
        img = Image.open(f)
        # Crop face region
        face = img.crop(region)
        face = face.resize((thumb_size, thumb_size), Image.LANCZOS)
        col, row = idx % cols, idx // cols
        grid.paste(face, (col * thumb_size, row * thumb_size))
    
    grid.save(output_path)
    print(f"QC grid saved: {output_path}")


def create_prores(frames_dir: Path, output_path: Path, fps: int = 24):
    """Create ProRes 4444 video from frames."""
    # Find frame pattern
    frames = sorted(frames_dir.glob("*.png"))
    if not frames:
        return
    
    # Determine pattern
    first = frames[0].name
    if '-' in first:
        pattern = first.rsplit('-', 1)[0] + "-%03d.png"
    else:
        pattern = "frame-%03d.png"
    
    cmd = [
        "ffmpeg", "-y", "-framerate", str(fps),
        "-i", str(frames_dir / pattern),
        "-c:v", "prores_ks", "-profile:v", "4444",
        "-pix_fmt", "yuva444p10le", str(output_path)
    ]
    subprocess.run(cmd, capture_output=True)
    print(f"ProRes saved: {output_path}")


async def main(args):
    input_path = Path(args.input)
    output_dir = Path(args.output)
    output_dir.mkdir(parents=True, exist_ok=True)
    
    # Step 1: Get frames
    if input_path.is_file():
        print(f"Extracting frames from {input_path}...")
        frames_dir = output_dir / "frames-raw"
        count = extract_frames(input_path, frames_dir)
        print(f"  Extracted {count} frames")
    else:
        frames_dir = input_path
    
    frames = sorted(frames_dir.glob("*.png"))
    print(f"\nProcessing {len(frames)} frames...")
    print(f"Concurrency: {args.concurrency}")
    if args.crop:
        print(f"Cropping: {args.crop[0]}px top, {args.crop[1]}px bottom")
    
    # Step 2: Remove backgrounds
    transparent_dir = output_dir / "transparent"
    transparent_dir.mkdir(exist_ok=True)
    
    semaphore = asyncio.Semaphore(args.concurrency)
    crop_top, crop_bottom = args.crop if args.crop else (0, 0)
    
    async with aiohttp.ClientSession() as session:
        tasks = [
            process_frame(
                session, semaphore, f,
                transparent_dir / f.name,
                crop_top, crop_bottom, args.alpha_threshold
            )
            for f in frames
        ]
        results = await asyncio.gather(*tasks)
    
    success = sum(results)
    print(f"\n✓ Processed: {success}/{len(frames)}")
    
    # Step 3: QC grid
    print("\nGenerating QC grid...")
    create_qc_grid(transparent_dir, output_dir / "qc-faces.png")
    
    # Step 4: ProRes video
    print("\nCreating ProRes video...")
    create_prores(transparent_dir, output_dir / "output.mov", args.fps)
    
    print(f"\n✓ Complete! Output in {output_dir}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Sprite extraction pipeline")
    parser.add_argument("input", help="Input video or frames directory")
    parser.add_argument("output", help="Output directory")
    parser.add_argument("--concurrency", type=int, default=3, help="Concurrent API calls (default: 3)")
    parser.add_argument("--crop", nargs=2, type=int, metavar=("TOP", "BOTTOM"), help="Crop letterbox")
    parser.add_argument("--fps", type=int, default=24, help="Output video FPS (default: 24)")
    parser.add_argument("--alpha-threshold", type=int, default=128, help="Alpha threshold (default: 128)")
    
    args = parser.parse_args()
    asyncio.run(main(args))
