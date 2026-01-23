#!/usr/bin/env python3
"""
Sprite Factory - End-to-end video to spritesheet pipeline.

Usage:
    python sprite-factory.py generate --prompt "character walking" --reference image.png --output sprites/walk
    python sprite-factory.py process --video video.mp4 --output sprites/walk
    python sprite-factory.py full --prompt "..." --reference image.png --output sprites/walk

Designed for cheap agents (GLM) to run. Opus directs via prompts.
"""

import os
import sys
import json
import math
import shutil
import argparse
import subprocess
from pathlib import Path
from PIL import Image
import numpy as np

# Load .env from sprite-tools root
try:
    from dotenv import load_dotenv
    env_path = Path(__file__).parent.parent / ".env"
    load_dotenv(env_path)
except ImportError:
    pass


def generate_video(prompt: str, reference_path: str, output_path: str, duration: int = 6) -> str:
    """Generate video using Veo 3.1 via Google GenAI."""
    api_key = os.getenv("GOOGLE_API_KEY")
    if not api_key:
        raise ValueError("GOOGLE_API_KEY not found in environment")
    
    from google import genai
    from google.genai import types
    
    client = genai.Client(api_key=api_key)
    
    # Load reference image
    with open(reference_path, "rb") as f:
        ref_image_data = f.read()
    
    mime_type = "image/png" if reference_path.endswith(".png") else "image/jpeg"
    ref_image = types.Image(image_bytes=ref_image_data, mime_type=mime_type)
    
    reference = types.VideoGenerationReferenceImage(
        image=ref_image,
        reference_type="asset"
    )
    
    # Enhance prompt with required constraints
    full_prompt = f"""{prompt}

CRITICAL REQUIREMENTS:
- Plain grey background (#828282), completely solid
- NO shadows whatsoever, no ground shadow
- Character centered in frame
- Smooth loopable animation"""
    
    print(f"Generating video with Veo 3.1...")
    print(f"Prompt: {prompt[:100]}...")
    
    operation = client.models.generate_video(
        model="veo-3.1",
        prompt=full_prompt,
        reference_images=[reference],
        config=types.VideoGenerationConfig(
            duration_seconds=duration,
            aspect_ratio="9:16",
            quality="high"
        )
    )
    
    # Poll for completion
    while not operation.done:
        print(".", end="", flush=True)
        import time
        time.sleep(5)
        operation = client.operations.get(operation.name)
    
    print(" Done!")
    
    # Download video
    video = operation.result.generated_videos[0]
    video_data = client.files.download(video.video_uri)
    
    video_path = f"{output_path}_video.mp4"
    with open(video_path, "wb") as f:
        f.write(video_data)
    
    print(f"Video saved: {video_path}")
    return video_path


def extract_frames(video_path: str, output_dir: str, fps: int = 24) -> int:
    """Extract frames from video using ffmpeg."""
    os.makedirs(output_dir, exist_ok=True)
    
    cmd = [
        "ffmpeg", "-y", "-i", video_path,
        "-vf", f"fps={fps}",
        "-vsync", "0",
        f"{output_dir}/frame-%04d.png"
    ]
    
    print(f"Extracting frames at {fps}fps...")
    subprocess.run(cmd, capture_output=True, check=True)
    
    frame_count = len([f for f in os.listdir(output_dir) if f.endswith('.png')])
    print(f"Extracted {frame_count} frames")
    return frame_count


def chroma_key_frame(input_path: str, output_path: str, 
                     bg_color: tuple = (130, 130, 130),
                     grey_threshold: int = 15,
                     brightness_min: int = 100,
                     black_threshold: int = 10):
    """Remove grey background using chroma key."""
    img = Image.open(input_path).convert('RGBA')
    rgb = np.array(img)
    r, g, b = rgb[:,:,0], rgb[:,:,1], rgb[:,:,2]
    
    # Distance from grey background
    grey_dist = np.sqrt(
        (r.astype(float) - bg_color[0])**2 +
        (g.astype(float) - bg_color[1])**2 +
        (b.astype(float) - bg_color[2])**2
    )
    
    # Distance from black (for letterbox bars)
    black_dist = np.sqrt(
        r.astype(float)**2 + 
        g.astype(float)**2 + 
        b.astype(float)**2
    )
    
    # Brightness protects dark clothing
    brightness = (r.astype(float) + g.astype(float) + b.astype(float)) / 3
    
    # Background detection
    is_grey_bg = (grey_dist < grey_threshold) & (brightness > brightness_min)
    is_black_bar = black_dist < black_threshold
    is_background = is_grey_bg | is_black_bar
    
    # Create alpha channel
    alpha = (~is_background).astype(np.uint8) * 255
    
    # Combine with original RGB
    result = np.dstack([rgb[:,:,:3], alpha])
    Image.fromarray(result).save(output_path)


def process_chroma_key(input_dir: str, output_dir: str, **kwargs):
    """Batch process all frames with chroma key."""
    os.makedirs(output_dir, exist_ok=True)
    files = sorted([f for f in os.listdir(input_dir) if f.endswith('.png')])
    
    print(f"Chroma keying {len(files)} frames...")
    for i, f in enumerate(files):
        chroma_key_frame(f"{input_dir}/{f}", f"{output_dir}/{f}", **kwargs)
        if (i + 1) % 20 == 0:
            print(f"  {i + 1}/{len(files)}")
    
    print(f"Chroma key complete")


def get_content_bbox(img: Image.Image) -> tuple:
    """Get bounding box of non-transparent pixels."""
    alpha = img.split()[-1]
    return alpha.getbbox()


def trim_frames(input_dir: str, output_dir: str):
    """Trim all frames to global bounding box."""
    os.makedirs(output_dir, exist_ok=True)
    files = sorted([f for f in os.listdir(input_dir) if f.endswith('.png')])
    
    # Pass 1: Find global bounding box
    print("Finding global bounds...")
    global_bbox = None
    for f in files:
        img = Image.open(f"{input_dir}/{f}")
        bbox = get_content_bbox(img)
        if bbox:
            if global_bbox is None:
                global_bbox = bbox
            else:
                global_bbox = (
                    min(global_bbox[0], bbox[0]),
                    min(global_bbox[1], bbox[1]),
                    max(global_bbox[2], bbox[2]),
                    max(global_bbox[3], bbox[3])
                )
    
    if not global_bbox:
        raise ValueError("No content found in frames")
    
    width = global_bbox[2] - global_bbox[0]
    height = global_bbox[3] - global_bbox[1]
    print(f"Global bounds: {global_bbox}")
    print(f"Frame size: {width}x{height}")
    
    # Pass 2: Crop all frames
    print(f"Trimming {len(files)} frames...")
    for f in files:
        img = Image.open(f"{input_dir}/{f}")
        cropped = img.crop(global_bbox)
        cropped.save(f"{output_dir}/{f}")
    
    return width, height


def create_spritesheet(input_dir: str, output_name: str, fps: int = 24):
    """Create spritesheet from frames with JSON metadata."""
    files = sorted([f for f in os.listdir(input_dir) if f.endswith('.png')])
    if not files:
        raise ValueError(f"No PNG files in {input_dir}")
    
    # Get dimensions
    sample = Image.open(f"{input_dir}/{files[0]}")
    frame_w, frame_h = sample.size
    frame_count = len(files)
    
    # Single row spritesheet
    cols = frame_count
    rows = 1
    
    print(f"Creating spritesheet: {frame_count} frames @ {frame_w}x{frame_h}")
    
    # Create spritesheet
    sheet = Image.new('RGBA', (frame_w * cols, frame_h * rows), (0, 0, 0, 0))
    for i, f in enumerate(files):
        img = Image.open(f"{input_dir}/{f}")
        x = (i % cols) * frame_w
        y = (i // cols) * frame_h
        sheet.paste(img, (x, y))
    
    # Save spritesheet
    png_path = f"{output_name}.png"
    sheet.save(png_path, optimize=True)
    
    # Save metadata
    meta = {
        "name": Path(output_name).name,
        "frameWidth": frame_w,
        "frameHeight": frame_h,
        "frameCount": frame_count,
        "cols": cols,
        "rows": rows,
        "fps": fps
    }
    json_path = f"{output_name}.json"
    with open(json_path, 'w') as f:
        json.dump(meta, f, indent=2)
    
    print(f"Saved: {png_path} ({frame_w * cols}x{frame_h * rows})")
    print(f"Saved: {json_path}")
    
    return meta


def process_video(video_path: str, output_name: str, fps: int = 24, cleanup: bool = True):
    """Full pipeline: video → spritesheet."""
    work_dir = Path(output_name).parent / f".work_{Path(output_name).stem}"
    frames_dir = work_dir / "frames"
    keyed_dir = work_dir / "keyed"
    trimmed_dir = work_dir / "trimmed"
    
    try:
        # Extract frames
        extract_frames(video_path, str(frames_dir), fps)
        
        # Chroma key
        process_chroma_key(str(frames_dir), str(keyed_dir))
        
        # Trim
        trim_frames(str(keyed_dir), str(trimmed_dir))
        
        # Create spritesheet
        meta = create_spritesheet(str(trimmed_dir), output_name, fps)
        
        return meta
        
    finally:
        if cleanup and work_dir.exists():
            shutil.rmtree(work_dir)
            print(f"Cleaned up work directory")


def main():
    parser = argparse.ArgumentParser(description="Sprite Factory - Video to Spritesheet Pipeline")
    subparsers = parser.add_subparsers(dest="command", required=True)
    
    # Generate command
    gen_parser = subparsers.add_parser("generate", help="Generate video with Veo")
    gen_parser.add_argument("--prompt", required=True, help="Animation prompt")
    gen_parser.add_argument("--reference", required=True, help="Reference image path")
    gen_parser.add_argument("--output", required=True, help="Output path (without extension)")
    gen_parser.add_argument("--duration", type=int, default=6, help="Video duration in seconds")
    
    # Process command
    proc_parser = subparsers.add_parser("process", help="Process existing video to spritesheet")
    proc_parser.add_argument("--video", required=True, help="Input video path")
    proc_parser.add_argument("--output", required=True, help="Output path (without extension)")
    proc_parser.add_argument("--fps", type=int, default=24, help="Frame rate")
    proc_parser.add_argument("--no-cleanup", action="store_true", help="Keep work directory")
    
    # Full command
    full_parser = subparsers.add_parser("full", help="Generate video and process to spritesheet")
    full_parser.add_argument("--prompt", required=True, help="Animation prompt")
    full_parser.add_argument("--reference", required=True, help="Reference image path")
    full_parser.add_argument("--output", required=True, help="Output path (without extension)")
    full_parser.add_argument("--duration", type=int, default=6, help="Video duration in seconds")
    full_parser.add_argument("--fps", type=int, default=24, help="Frame rate")
    
    args = parser.parse_args()
    
    if args.command == "generate":
        generate_video(args.prompt, args.reference, args.output, args.duration)
        
    elif args.command == "process":
        process_video(args.video, args.output, args.fps, cleanup=not args.no_cleanup)
        
    elif args.command == "full":
        video_path = generate_video(args.prompt, args.reference, args.output, args.duration)
        process_video(video_path, args.output, args.fps)


if __name__ == "__main__":
    main()
