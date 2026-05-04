#!/usr/bin/env python3
# /// script
# requires-python = ">=3.10"
# dependencies = ["requests", "pillow", "click", "numpy", "opencv-python", "google-generativeai"]
# ///
"""
Sprite Factory: End-to-end character animation pipeline.

Combines:
  - Veo/Gemini video generation (from reference image + prompt)
  - Pipeline A/A' sprite extraction (background removal)
  - Spritesheet assembly

Usage:
  python sprite-factory.py generate --prompt "..." --reference <image> --output <path>
  python sprite-factory.py extract --video <video> --output <path>
  python sprite-factory.py sheet --frames <dir> --output <path>

Environment:
  GOOGLE_API_KEY - For Veo/Gemini video generation
  REPLICATE_API_TOKEN - For rembg background removal
"""

import os
import sys
import json
import click
import subprocess
from pathlib import Path
from PIL import Image
import tempfile
import shutil

SCRIPTS_DIR = Path(__file__).parent


def run_video_generation(prompt: str, reference: Path, output_dir: Path) -> Path:
    """Generate animation video via Veo/Gemini."""
    try:
        import google.generativeai as genai
    except ImportError:
        click.echo("Installing google-generativeai...")
        subprocess.run([sys.executable, "-m", "pip", "install", "google-generativeai", "-q"])
        import google.generativeai as genai
    
    api_key = os.environ.get("GOOGLE_API_KEY")
    if not api_key:
        raise click.ClickException("GOOGLE_API_KEY not set")
    
    genai.configure(api_key=api_key)
    
    click.echo(f"Generating video from: {reference}")
    click.echo(f"Prompt: {prompt}")
    
    # Upload reference image
    ref_file = genai.upload_file(str(reference))
    click.echo(f"Uploaded reference: {ref_file.name}")
    
    # Generate video with Veo
    model = genai.GenerativeModel("gemini-2.0-flash-exp")
    
    response = model.generate_content(
        [
            ref_file,
            f"""Generate a short looping animation video of this character.

Animation: {prompt}

Style requirements:
- Keep the exact art style from the reference
- Smooth, game-ready animation
- Grey background (#828282) for easy extraction
- Side view, walking cycle
- 2-4 seconds, seamless loop
"""
        ],
        generation_config={"response_mime_type": "video/mp4"}
    )
    
    # Save video
    output_dir.mkdir(parents=True, exist_ok=True)
    video_path = output_dir / "raw_video.mp4"
    
    # Extract video data from response
    if hasattr(response, 'candidates') and response.candidates:
        for part in response.candidates[0].content.parts:
            if hasattr(part, 'inline_data') and part.inline_data:
                with open(video_path, 'wb') as f:
                    f.write(part.inline_data.data)
                click.echo(f"Video saved: {video_path}")
                return video_path
    
    raise click.ClickException("No video generated in response")


def run_extraction(video: Path, output_dir: Path, pipeline: str = "a") -> Path:
    """Extract sprites using Pipeline A or A'."""
    pipeline_script = SCRIPTS_DIR / f"pipeline_{pipeline}.py" if pipeline == "a" else SCRIPTS_DIR / "pipeline_a_prime.py"
    
    if not pipeline_script.exists():
        raise click.ClickException(f"Pipeline script not found: {pipeline_script}")
    
    click.echo(f"Running sprite extraction (Pipeline {pipeline.upper()})...")
    
    result = subprocess.run(
        [sys.executable, str(pipeline_script), str(video), str(output_dir)],
        capture_output=True,
        text=True
    )
    
    if result.returncode != 0:
        click.echo(f"Pipeline stderr: {result.stderr}")
        raise click.ClickException(f"Pipeline failed: {result.returncode}")
    
    click.echo(result.stdout)
    
    # Find the output spritesheet
    sheet_path = output_dir / "spritesheet.png"
    if not sheet_path.exists():
        # Check for alternative names
        for pattern in ["*sheet*.png", "*sprite*.png", "*.png"]:
            matches = list(output_dir.glob(pattern))
            if matches:
                sheet_path = matches[0]
                break
    
    return sheet_path


def create_spritesheet(frames_dir: Path, output: Path, cols: int = 8) -> Path:
    """Assemble frames into a spritesheet."""
    frames = sorted(frames_dir.glob("*.png"))
    if not frames:
        raise click.ClickException(f"No PNG frames in {frames_dir}")
    
    click.echo(f"Creating spritesheet from {len(frames)} frames...")
    
    # Load first frame to get dimensions
    first = Image.open(frames[0])
    w, h = first.size
    
    rows = (len(frames) + cols - 1) // cols
    sheet = Image.new("RGBA", (w * cols, h * rows), (0, 0, 0, 0))
    
    for i, frame_path in enumerate(frames):
        frame = Image.open(frame_path)
        x = (i % cols) * w
        y = (i // cols) * h
        sheet.paste(frame, (x, y))
    
    sheet.save(output)
    click.echo(f"Spritesheet saved: {output} ({cols}x{rows}, {w}x{h} per frame)")
    
    # Create JSON atlas
    atlas = {
        "frames": {},
        "meta": {
            "size": {"w": w * cols, "h": h * rows},
            "frameSize": {"w": w, "h": h}
        }
    }
    
    for i, frame_path in enumerate(frames):
        x = (i % cols) * w
        y = (i // cols) * h
        atlas["frames"][f"frame_{i:04d}"] = {
            "frame": {"x": x, "y": y, "w": w, "h": h}
        }
    
    atlas_path = output.with_suffix(".json")
    with open(atlas_path, "w") as f:
        json.dump(atlas, f, indent=2)
    
    click.echo(f"Atlas saved: {atlas_path}")
    return output


@click.group()
def cli():
    """Sprite Factory: End-to-end character animation pipeline."""
    pass


@cli.command()
@click.option("--prompt", required=True, help="Animation prompt")
@click.option("--reference", required=True, type=click.Path(exists=True), help="Reference image")
@click.option("--output", required=True, type=click.Path(), help="Output directory base")
@click.option("--pipeline", default="a_prime", help="Extraction pipeline (a, a_prime)")
@click.option("--skip-video", is_flag=True, help="Skip video generation, use existing")
def generate(prompt: str, reference: str, output: str, pipeline: str, skip_video: bool):
    """Generate animation from reference image."""
    ref_path = Path(reference)
    out_path = Path(output)
    out_path.mkdir(parents=True, exist_ok=True)
    
    video_path = out_path / "raw_video.mp4"
    
    # Step 1: Generate video (unless skipping)
    if not skip_video:
        video_path = run_video_generation(prompt, ref_path, out_path)
    elif not video_path.exists():
        raise click.ClickException(f"--skip-video requires existing video at {video_path}")
    
    # Step 2: Extract sprites
    extract_dir = out_path / "extracted"
    sheet_path = run_extraction(video_path, extract_dir, pipeline.replace("_prime", "'"))
    
    # Step 3: Copy final spritesheet to output
    final_sheet = out_path / f"{out_path.name}-sheet.png"
    if sheet_path.exists():
        shutil.copy(sheet_path, final_sheet)
        click.echo(f"\n✅ Done! Spritesheet: {final_sheet}")
    else:
        click.echo(f"\n⚠️  Extraction complete but no spritesheet found. Check {extract_dir}")


@cli.command()
@click.argument("video", type=click.Path(exists=True))
@click.argument("output_dir", type=click.Path())
@click.option("--pipeline", default="a_prime", help="Pipeline to use (a, a_prime)")
def extract(video: str, output_dir: str, pipeline: str):
    """Extract sprites from existing video."""
    run_extraction(Path(video), Path(output_dir), pipeline)


@cli.command()
@click.argument("frames_dir", type=click.Path(exists=True))
@click.argument("output", type=click.Path())
@click.option("--cols", default=8, help="Columns in spritesheet")
def sheet(frames_dir: str, output: str, cols: int):
    """Create spritesheet from frame directory."""
    create_spritesheet(Path(frames_dir), Path(output), cols)


if __name__ == "__main__":
    cli()
