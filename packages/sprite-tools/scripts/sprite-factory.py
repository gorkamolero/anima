#!/usr/bin/env python3
# /// script
# requires-python = ">=3.10"
# dependencies = ["requests", "pillow", "click", "numpy", "opencv-python", "google-generativeai"]
# ///
"""Sprite Factory: clean AI video to Phaser-ready spritesheets."""

import os
import sys
import json
import click
import subprocess
from pathlib import Path
from PIL import Image
import tempfile
import shutil
import math
from datetime import datetime, timezone

SCRIPTS_DIR = Path(__file__).parent
LOOPYCUT_CLI = SCRIPTS_DIR.parent / "tools" / "loopycut" / "cli.py"

PRESETS = {
    "gray": {
        "bg": "130,130,130",
        "tolerance": 15.0,
        "min_brightness": 100.0,
    },
    "white-veo": {
        "bg": "255,255,255",
        "tolerance": 42.0,
        "min_brightness": 190.0,
    },
    "magenta-fal": {
        "bg": "255,0,255",
        "tolerance": 38.0,
        "min_brightness": 0.0,
    },
}


def extract_video_frames(video: Path, frames_dir: Path, fps: int | None, limit: int | None) -> list[Path]:
    """Extract frames from a video with ffmpeg."""
    frames_dir.mkdir(parents=True, exist_ok=True)
    pattern = frames_dir / "frame-%03d.png"
    cmd = ["ffmpeg", "-y", "-i", str(video)]
    if fps:
        cmd.extend(["-vf", f"fps={fps}"])
    if limit:
        cmd.extend(["-frames:v", str(limit)])
    cmd.append(str(pattern))
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise click.ClickException(result.stderr.strip() or "ffmpeg frame extraction failed")
    return sorted(frames_dir.glob("frame-*.png"))


def extract_alpha_video_frames(video: Path, frames_dir: Path, fps: int | None, limit: int | None) -> list[Path]:
    """Extract RGBA PNG frames from a video that already contains alpha."""
    frames_dir.mkdir(parents=True, exist_ok=True)
    pattern = frames_dir / "frame-%03d.png"
    filters = []
    if fps:
        filters.append(f"fps={fps}")
    filters.append("format=rgba")
    cmd = ["ffmpeg", "-y"]
    if video.suffix.lower() == ".webm":
        # ffmpeg's native VP9 decoder can flatten alpha even when alpha_mode=1.
        cmd.extend(["-c:v", "libvpx-vp9"])
    cmd.extend(["-i", str(video), "-vf", ",".join(filters), "-pix_fmt", "rgba"])
    if limit:
        cmd.extend(["-frames:v", str(limit)])
    cmd.append(str(pattern))
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise click.ClickException(result.stderr.strip() or "ffmpeg alpha frame extraction failed")
    return sorted(frames_dir.glob("frame-*.png"))


def chroma_key_frame(
    input_path: Path,
    output_path: Path,
    bg_rgb: tuple[int, int, int],
    tolerance: float,
    min_brightness: float,
    edge_tolerance: float,
) -> None:
    """Remove a flat grey background while preserving dark clothing."""
    import numpy as np

    image = Image.open(input_path).convert("RGB")
    rgb = np.array(image)
    channels = rgb.astype(float)
    r, g, b = channels[:, :, 0], channels[:, :, 1], channels[:, :, 2]

    grey_dist = np.sqrt(
        (r - bg_rgb[0]) ** 2 + (g - bg_rgb[1]) ** 2 + (b - bg_rgb[2]) ** 2
    )
    black_dist = np.sqrt(r**2 + g**2 + b**2)
    brightness = (r + g + b) / 3

    is_grey_bg = (grey_dist <= tolerance) & (brightness >= min_brightness)
    is_black_bar = black_dist <= 10
    alpha = (~(is_grey_bg | is_black_bar)).astype(np.uint8) * 255

    if edge_tolerance > tolerance:
        edge = (grey_dist > tolerance) & (grey_dist <= edge_tolerance)
        edge_alpha = np.clip(
            ((grey_dist - tolerance) / (edge_tolerance - tolerance)) * 255,
            0,
            255,
        ).astype(np.uint8)
        alpha = np.where(edge & (brightness >= min_brightness), edge_alpha, alpha)

    result = Image.fromarray(np.dstack([rgb, alpha]))
    result.save(output_path)


def chroma_key_frames(
    frames: list[Path],
    output_dir: Path,
    bg_rgb: tuple[int, int, int],
    tolerance: float,
    min_brightness: float,
    edge_tolerance: float,
) -> list[Path]:
    output_dir.mkdir(parents=True, exist_ok=True)
    keyed = []
    for frame in frames:
        output = output_dir / frame.name
        chroma_key_frame(
            frame,
            output,
            bg_rgb,
            tolerance,
            min_brightness,
            edge_tolerance,
        )
        keyed.append(output)
    return keyed


def global_alpha_bbox(frames: list[Path]) -> tuple[int, int, int, int]:
    bbox = None
    for frame in frames:
        image = Image.open(frame).convert("RGBA")
        frame_bbox = image.getchannel("A").getbbox()
        if frame_bbox is None:
            continue
        if bbox is None:
            bbox = frame_bbox
        else:
            bbox = (
                min(bbox[0], frame_bbox[0]),
                min(bbox[1], frame_bbox[1]),
                max(bbox[2], frame_bbox[2]),
                max(bbox[3], frame_bbox[3]),
            )
    if bbox is None:
        raise click.ClickException("All keyed frames are transparent")
    return bbox


def trim_to_global_bbox(frames: list[Path], output_dir: Path) -> tuple[list[Path], tuple[int, int, int, int]]:
    output_dir.mkdir(parents=True, exist_ok=True)
    bbox = global_alpha_bbox(frames)
    trimmed = []
    for frame in frames:
        image = Image.open(frame).convert("RGBA")
        output = output_dir / frame.name
        image.crop(bbox).save(output)
        trimmed.append(output)
    return trimmed, bbox


def bottom_padding_warnings(frames: list[Path], tolerance: int = 2) -> list[str]:
    failures = []
    for frame in frames:
        image = Image.open(frame).convert("RGBA")
        bbox = image.getchannel("A").getbbox()
        if bbox is None:
            failures.append(f"{frame.name}: blank")
            continue
        bottom_padding = image.height - bbox[3]
        if bottom_padding > tolerance:
            failures.append(f"{frame.name}: {bottom_padding}px bottom padding")
    return failures


def run_loopycut(video: Path, work_dir: Path, min_frames: int, max_frames: int) -> tuple[Path, dict]:
    if not LOOPYCUT_CLI.exists():
        raise click.ClickException(f"LoopyCut CLI not found: {LOOPYCUT_CLI}")
    output = work_dir / f"loop{video.suffix.lower() or '.mp4'}"
    cmd = [
        sys.executable,
        str(LOOPYCUT_CLI),
        str(video),
        str(output),
        "--save-metadata",
        "--no-audio",
        "--min-frames",
        str(min_frames),
        "--max-frames",
        str(max_frames),
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise click.ClickException(result.stderr.strip() or "loopycut failed")
    metadata_path = output.with_name("loop.json")
    if not metadata_path.exists():
        raise click.ClickException(f"loopycut metadata not found: {metadata_path}")
    return output, json.loads(metadata_path.read_text())


def create_phaser_sheet(frames: list[Path], output_base: Path, fps: int, cols: int | None) -> Path:
    if not frames:
        raise click.ClickException("No frames to assemble")

    first = Image.open(frames[0]).convert("RGBA")
    frame_w, frame_h = first.size
    frame_count = len(frames)
    columns = cols or frame_count
    rows = math.ceil(frame_count / columns)

    sheet = Image.new("RGBA", (frame_w * columns, frame_h * rows), (0, 0, 0, 0))
    for index, frame in enumerate(frames):
        image = Image.open(frame).convert("RGBA")
        if image.size != (frame_w, frame_h):
            raise click.ClickException(f"{frame} has inconsistent size {image.size}")
        x = (index % columns) * frame_w
        y = (index // columns) * frame_h
        sheet.alpha_composite(image, (x, y))

    output_base.parent.mkdir(parents=True, exist_ok=True)
    png_path = output_base.with_suffix(".png")
    json_path = output_base.with_suffix(".json")
    sheet.save(png_path)

    metadata = {
        "name": output_base.name,
        "image": png_path.name,
        "frameWidth": frame_w,
        "frameHeight": frame_h,
        "frameCount": frame_count,
        "cols": columns,
        "rows": rows,
        "fps": fps,
    }
    json_path.write_text(json.dumps(metadata, indent=2) + "\n")

    click.echo(f"Spritesheet saved: {png_path}")
    click.echo(f"Metadata saved: {json_path}")
    click.echo(f"Frame size: {frame_w}x{frame_h}; frames: {frame_count}; fps: {fps}")
    return png_path


def write_magenta_contact_sheet(frames: list[Path], output_path: Path, cols: int | None) -> None:
    if not frames:
        return
    first = Image.open(frames[0]).convert("RGBA")
    frame_w, frame_h = first.size
    frame_count = len(frames)
    columns = cols or min(frame_count, 8)
    rows = math.ceil(frame_count / columns)
    sheet = Image.new("RGB", (frame_w * columns, frame_h * rows), (255, 0, 255))
    for index, frame in enumerate(frames):
        image = Image.open(frame).convert("RGBA")
        background = Image.new("RGBA", image.size, (255, 0, 255, 255))
        composite = Image.alpha_composite(background, image).convert("RGB")
        x = (index % columns) * frame_w
        y = (index // columns) * frame_h
        sheet.paste(composite, (x, y))
    output_path.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(output_path)


def parse_preview_bg(color: str) -> tuple[int, int, int]:
    named = {
        "magenta": (255, 0, 255),
        "green": (0, 255, 0),
        "black": (0, 0, 0),
        "white": (255, 255, 255),
        "gray": (130, 130, 130),
    }
    if color.lower() in named:
        return named[color.lower()]
    value = color.strip().lstrip("#")
    if len(value) == 6:
        return tuple(int(value[index:index + 2], 16) for index in (0, 2, 4))
    raise click.ClickException("--preview-bg must be a named color or #RRGGBB")


def write_loop_preview(
    frames: list[Path],
    output_path: Path,
    *,
    fps: int,
    loops: int,
    bg_color: str,
) -> None:
    if loops <= 0 or not frames:
        return

    bg = parse_preview_bg(bg_color)
    work_dir = output_path.parent / f".{output_path.stem}-preview-work"
    if work_dir.exists():
        shutil.rmtree(work_dir)
    work_dir.mkdir(parents=True, exist_ok=True)

    expanded = []
    for _ in range(loops):
        expanded.extend(frames)

    for index, frame in enumerate(expanded, start=1):
        image = Image.open(frame).convert("RGBA")
        background = Image.new("RGBA", image.size, (*bg, 255))
        composite = Image.alpha_composite(background, image).convert("RGB")
        composite.save(work_dir / f"frame-{index:05d}.png")

    output_path.parent.mkdir(parents=True, exist_ok=True)
    cmd = [
        "ffmpeg",
        "-y",
        "-framerate",
        str(fps),
        "-i",
        str(work_dir / "frame-%05d.png"),
        "-vf",
        "pad=ceil(iw/2)*2:ceil(ih/2)*2",
        "-c:v",
        "libx264",
        "-pix_fmt",
        "yuv420p",
        "-crf",
        "18",
        "-preset",
        "medium",
        str(output_path),
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    shutil.rmtree(work_dir)
    if result.returncode != 0:
        raise click.ClickException(result.stderr.strip() or "ffmpeg loop preview failed")


def write_manifest(
    output_base: Path,
    *,
    video: Path,
    preset: str | None,
    fps: int,
    frame_limit: int | None,
    cols: int | None,
    bg_rgb: tuple[int, int, int],
    tolerance: float,
    min_brightness: float,
    edge_tolerance: float,
    trim_box: tuple[int, int, int, int],
    kept_work: bool,
    warnings: list[str],
    qc_path: Path | None = None,
) -> None:
    manifest = {
        "video": str(video),
        "preset": preset,
        "output": str(output_base),
        "fps": fps,
        "frameLimit": frame_limit,
        "columns": cols,
        "background": bg_rgb,
        "tolerance": tolerance,
        "minBrightness": min_brightness,
        "edgeTolerance": edge_tolerance,
        "globalTrimBox": trim_box,
        "keptWork": kept_work,
        "warnings": warnings,
        "qcMagenta": str(qc_path) if qc_path else None,
        "command": " ".join(sys.argv),
    }
    output_base.with_suffix(".manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")


def write_alpha_manifest(
    output_base: Path,
    *,
    video: Path,
    fps: int,
    frame_limit: int | None,
    cols: int | None,
    trim: bool,
    trim_box: tuple[int, int, int, int] | None,
    kept_work: bool,
    qc_path: Path,
    preview_path: Path | None,
    preview_loops: int,
) -> None:
    manifest = {
        "video": str(video),
        "pipeline": "fal-alpha-video",
        "output": str(output_base),
        "fps": fps,
        "frameLimit": frame_limit,
        "columns": cols,
        "trim": trim,
        "globalTrimBox": trim_box,
        "qcMagenta": str(qc_path),
        "loopPreview": str(preview_path) if preview_path else None,
        "previewLoops": preview_loops,
        "keptWork": kept_work,
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "command": " ".join(sys.argv),
    }
    output_base.with_suffix(".manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")


@click.group()
def cli():
    """Sprite Factory: End-to-end character animation pipeline."""
    pass


@cli.command()
@click.option("--video", required=True, type=click.Path(exists=True), help="Clean grey-background video")
@click.option("--output", required=True, type=click.Path(), help="Output base path, without extension")
@click.option("--preset", default=None, type=click.Choice(sorted(PRESETS)), help="Known chroma-key preset")
@click.option("--fps", default=24, help="Sprite animation framerate")
@click.option("--frames", default=None, type=int, help="Limit extracted frame count")
@click.option("--cols", default=None, type=int, help="Spritesheet columns; defaults to one row")
@click.option("--bg", default=None, help="RGB background color to key, e.g. 130,130,130")
@click.option("--tolerance", default=None, type=float, help="Chroma key distance tolerance")
@click.option("--edge-tolerance", default=None, type=float, help="Soft edge key distance tolerance")
@click.option("--min-brightness", default=None, type=float, help="Only key pixels above this brightness")
@click.option("--keep-work", is_flag=True, help="Keep intermediate frames next to the output")
@click.option("--strict-feet", is_flag=True, help="Fail if any frame has bottom padding")
def process(
    video: str,
    output: str,
    preset: str | None,
    fps: int,
    frames: int | None,
    cols: int | None,
    bg: str,
    tolerance: float | None,
    edge_tolerance: float | None,
    min_brightness: float | None,
    keep_work: bool,
    strict_feet: bool,
):
    """Process a fresh grey-background sprite video with chroma key."""
    preset_values = PRESETS.get(preset or "gray", {})
    bg = bg or preset_values["bg"]
    tolerance = tolerance if tolerance is not None else preset_values["tolerance"]
    edge_tolerance = (
        edge_tolerance
        if edge_tolerance is not None
        else max(tolerance + 18, tolerance * 1.8)
    )
    min_brightness = (
        min_brightness
        if min_brightness is not None
        else preset_values["min_brightness"]
    )

    bg_parts = tuple(int(part.strip()) for part in bg.split(","))
    if len(bg_parts) != 3:
        raise click.ClickException("--bg must be three comma-separated RGB values")

    output_base = Path(output)
    work_dir = output_base.parent / f".{output_base.name}-work"
    if work_dir.exists():
        shutil.rmtree(work_dir)

    raw_frames = extract_video_frames(Path(video), work_dir / "frames-raw", fps, frames)
    if not raw_frames:
        raise click.ClickException("No frames extracted")

    keyed_frames = chroma_key_frames(
        raw_frames,
        work_dir / "frames-keyed",
        bg_parts,
        tolerance,
        min_brightness,
        edge_tolerance,
    )
    trimmed_frames, bbox = trim_to_global_bbox(keyed_frames, work_dir / "frames-trimmed")
    warnings = bottom_padding_warnings(trimmed_frames)
    if warnings and strict_feet:
        raise click.ClickException(
            "Feet/bottom content is not at the frame bottom:\n" + "\n".join(warnings[:8])
        )
    for warning in warnings[:8]:
        click.echo(f"Warning: {warning}")
    create_phaser_sheet(trimmed_frames, output_base, fps, cols)
    _meta, _frames = load_sheet_frames(output_base)
    _drift = drift_report(_meta, _frames)
    if abs(_drift["worstStep"]) > _meta["frameHeight"] * 0.006:
        click.secho(
            f"WARNING: figure jumps {_drift['worstStep']:+d}px between frames {_drift['worstFrame']} "
            f"and {_drift['worstFrame'] + 1}; run `sprite-factory.py register --sheet {output_base}` before using this sheet",
            fg="red",
        )
    qc_path = output_base.with_name(f"{output_base.name}-qc-magenta").with_suffix(".png")
    write_magenta_contact_sheet(trimmed_frames, qc_path, cols)
    click.echo(f"QC magenta sheet saved: {qc_path}")
    click.echo(f"Global trim box: {bbox}")
    write_manifest(
        output_base,
        video=Path(video),
        preset=preset,
        fps=fps,
        frame_limit=frames,
        cols=cols,
        bg_rgb=bg_parts,
        tolerance=tolerance,
        min_brightness=min_brightness,
        edge_tolerance=edge_tolerance,
        trim_box=bbox,
        kept_work=keep_work,
        warnings=warnings,
        qc_path=qc_path,
    )

    if not keep_work:
        shutil.rmtree(work_dir)


@cli.command("process-alpha")
@click.option("--video", required=True, type=click.Path(exists=True), help="Transparent video, usually fal BRIA WebM VP9 alpha")
@click.option("--output", required=True, type=click.Path(), help="Output base path, without extension")
@click.option("--fps", default=24, help="Sprite animation framerate")
@click.option("--frames", default=None, type=int, help="Limit extracted frame count")
@click.option("--cols", default=None, type=int, help="Spritesheet columns; defaults to one row")
@click.option("--trim/--no-trim", default=True, help="Trim all frames to one global alpha bounding box")
@click.option("--detect-loop", is_flag=True, help="Run local LoopyCut before extracting frames")
@click.option("--loop-min-frames", default=16, type=int, help="Minimum detected loop length")
@click.option("--loop-max-frames", default=48, type=int, help="Maximum detected loop length")
@click.option("--preview-loops", default=0, type=int, help="Write an MP4 preview repeating the extracted loop N times")
@click.option("--preview-bg", default="magenta", help="Preview background: magenta/green/black/white/gray/#RRGGBB")
@click.option("--keep-work", is_flag=True, help="Keep intermediate frames next to the output")
def process_alpha(
    video: str,
    output: str,
    fps: int,
    frames: int | None,
    cols: int | None,
    trim: bool,
    detect_loop: bool,
    loop_min_frames: int,
    loop_max_frames: int,
    preview_loops: int,
    preview_bg: str,
    keep_work: bool,
):
    """Process already-transparent fal output into a Phaser spritesheet."""
    output_base = Path(output)
    work_dir = output_base.parent / f".{output_base.name}-alpha-work"
    if work_dir.exists():
        shutil.rmtree(work_dir)

    source_video = Path(video)
    loop_meta = None
    if detect_loop:
        source_video, loop_meta = run_loopycut(source_video, work_dir, loop_min_frames, loop_max_frames)
        loop_info = loop_meta.get("loop_info", {})
        click.echo(
            "Detected loop: "
            f"{loop_info.get('start_frame')}..{loop_info.get('end_frame')} "
            f"({loop_info.get('frame_count')} frames, score {loop_info.get('final_score'):.4f})"
        )
        if frames is None and loop_info.get("frame_count"):
            frames = int(loop_info["frame_count"])

    raw_frames = extract_alpha_video_frames(source_video, work_dir / "frames-rgba", fps, frames)
    if not raw_frames:
        raise click.ClickException("No frames extracted")

    trim_box = None
    sheet_frames = raw_frames
    if trim:
        sheet_frames, trim_box = trim_to_global_bbox(raw_frames, work_dir / "frames-trimmed")

    create_phaser_sheet(sheet_frames, output_base, fps, cols)
    _meta, _frames = load_sheet_frames(output_base)
    _drift = drift_report(_meta, _frames)
    if abs(_drift["worstStep"]) > _meta["frameHeight"] * 0.006:
        click.secho(
            f"WARNING: figure jumps {_drift['worstStep']:+d}px between frames {_drift['worstFrame']} "
            f"and {_drift['worstFrame'] + 1}; run `sprite-factory.py register --sheet {output_base}` before using this sheet",
            fg="red",
        )
    qc_path = output_base.with_name(f"{output_base.name}-qc-magenta").with_suffix(".png")
    write_magenta_contact_sheet(sheet_frames, qc_path, cols)
    click.echo(f"QC magenta sheet saved: {qc_path}")
    preview_path = None
    if preview_loops > 0:
        preview_path = output_base.with_name(f"{output_base.name}-preview-{preview_loops}x").with_suffix(".mp4")
        write_loop_preview(
            sheet_frames,
            preview_path,
            fps=fps,
            loops=preview_loops,
            bg_color=preview_bg,
        )
        click.echo(f"Loop preview saved: {preview_path}")
    if trim_box:
        click.echo(f"Global trim box: {trim_box}")

    write_alpha_manifest(
        output_base,
        video=Path(video),
        fps=fps,
        frame_limit=frames,
        cols=cols,
        trim=trim,
        trim_box=trim_box,
        kept_work=keep_work,
        qc_path=qc_path,
        preview_path=preview_path,
        preview_loops=preview_loops,
    )
    if loop_meta:
        manifest_path = output_base.with_suffix(".manifest.json")
        manifest = json.loads(manifest_path.read_text())
        manifest["loop"] = loop_meta
        manifest_path.write_text(json.dumps(manifest, indent=2) + "\n")

    if not keep_work:
        shutil.rmtree(work_dir)


# --- Frame registration and drift audit -------------------------------------
# Generated walk videos let the whole figure drift through a stride and snap
# back at the footfall. A sheet with that snap jerks in every scene, whatever
# the motor does, so sheets are registered here and audited before they ship.

def load_sheet_frames(base: Path) -> tuple[dict, list[Image.Image]]:
    meta = json.loads(base.with_suffix(".json").read_text())
    image = Image.open(base.with_suffix(".png")).convert("RGBA")
    w, h, cols = meta["frameWidth"], meta["frameHeight"], meta["cols"]
    return meta, [
        image.crop(((i % cols) * w, (i // cols) * h, (i % cols + 1) * w, (i // cols + 1) * h))
        for i in range(meta["frameCount"])
    ]


def figure_top(frame: Image.Image) -> int:
    bbox = frame.getchannel("A").point(lambda a: 255 if a > 40 else 0).getbbox()
    return bbox[1] if bbox else 0


def drift_report(meta: dict, frames: list[Image.Image]) -> dict:
    tops = [figure_top(f) for f in frames]
    n = len(tops)
    steps = [tops[(i + 1) % n] - tops[i] for i in range(n)]
    worst = max(range(n), key=lambda i: abs(steps[i]))
    return {
        "frameHeight": meta["frameHeight"],
        "topRange": max(tops) - min(tops),
        "worstStep": steps[worst],
        "worstFrame": worst,
        "tops": tops,
    }


@cli.command("audit-drift")
@click.option("--sheet", required=True, type=click.Path(), help="Sheet base path, without extension")
@click.option("--max-step", default=0.6, type=float, help="Allowed figure move between consecutive frames, % of frame height")
def audit_drift(sheet: str, max_step: float):
    """Fail if the figure jumps between consecutive frames of a sheet."""
    base = Path(sheet)
    meta, frames = load_sheet_frames(base)
    report = drift_report(meta, frames)
    allowed = meta["frameHeight"] * max_step / 100
    verdict = "PASS" if abs(report["worstStep"]) <= allowed else "FAIL"
    click.echo(
        f"{verdict} {base.name}: head row moves {report['worstStep']:+d}px between frames "
        f"{report['worstFrame']} and {(report['worstFrame'] + 1) % len(frames)} "
        f"(allowed {allowed:.1f}px); head row range {report['topRange']}px over the cycle"
    )
    if verdict == "FAIL":
        raise SystemExit(1)


@cli.command("register")
@click.option("--sheet", required=True, type=click.Path(), help="Sheet base path, without extension; rewritten in place")
def register(sheet: str):
    """Shift every frame so the figure's head row is constant; contacts follow."""
    base = Path(sheet)
    meta, frames = load_sheet_frames(base)
    tops = [figure_top(f) for f in frames]
    target = round(sum(tops) / len(tops))
    shifts = [target - t for t in tops]
    w, h, cols = meta["frameWidth"], meta["frameHeight"], meta["cols"]
    rows = (len(frames) + cols - 1) // cols
    # Grow the frame rather than clip: figures often touch the bottom edge.
    boxes = [f.getchannel("A").point(lambda a: 255 if a > 40 else 0).getbbox() or (0, 0, 0, 0) for f in frames]
    overflow = max(0, max(b[3] + dy - h for b, dy in zip(boxes, shifts)))
    underflow = max(0, max(-(b[1] + dy) for b, dy in zip(boxes, shifts)))
    shifts = [dy + underflow for dy in shifts]
    new_h = h + overflow + underflow
    canvas = Image.new("RGBA", (w * cols, new_h * rows))
    for i, (frame, dy) in enumerate(zip(frames, shifts)):
        tile = Image.new("RGBA", (w, new_h))
        tile.paste(frame, (0, dy))
        canvas.paste(tile, ((i % cols) * w, (i // cols) * new_h))
    meta["frameHeight"] = new_h
    for i, contact in enumerate(meta.get("contacts", [])):
        for foot in ("L", "R"):
            if foot in contact:
                contact[foot]["y"] += shifts[i]
    for group in ("switches", "swing"):
        for seed in meta.get("contactSeeds", {}).get(group, []):
            seed["point"]["y"] += shifts[seed["frame"]]
    meta["registration"] = {
        "method": "constant head row; integer vertical shift per frame; contacts shifted",
        "headRow": target + underflow,
        "shifts": shifts,
        "frameHeightBefore": h,
    }
    canvas.save(base.with_suffix(".png"))
    base.with_suffix(".json").write_text(json.dumps(meta, indent="\t") + "\n")
    click.echo(f"registered {base.name}: head row {min(tops)}..{max(tops)} -> {target}; shifts {shifts}")



if __name__ == "__main__":
    cli()
