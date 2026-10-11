#!/usr/bin/env python3
# /// script
# dependencies = ["pillow", "click"]
# ///
"""Match a directional sheet to a reference canvas and median visible height.

Apply after sprite-factory.py process-alpha. Uses one constant transform across
all frames, preserving the foot travel and body bob needed for a walk cycle.
"""
import argparse
import importlib.util
import json
import statistics
import tempfile
from pathlib import Path
from PIL import Image


def frames(base):
    meta = json.loads(base.with_suffix(".json").read_text())
    image = Image.open(base.with_suffix(".png")).convert("RGBA")
    w, h = meta["frameWidth"], meta["frameHeight"]
    return meta, [image.crop(((i % meta["cols"]) * w, (i // meta["cols"]) * h,
                             (i % meta["cols"] + 1) * w, (i // meta["cols"] + 1) * h))
                  for i in range(meta["frameCount"])]


def bounds(image):
    return image.getchannel("A").point(lambda a: 255 if a > 127 else 0).getbbox()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--sheet", required=True, type=Path, help="Input/output base without extension")
    parser.add_argument("--reference", required=True, type=Path, help="Reference sheet base")
    args = parser.parse_args()
    meta, source = frames(args.sheet)
    reference_meta, reference = frames(args.reference)
    target_height = statistics.median(bounds(im)[3] - bounds(im)[1] for im in reference)
    source_height = statistics.median(bounds(im)[3] - bounds(im)[1] for im in source)
    factor = target_height / source_height
    scaled = [im.resize((round(im.width * factor), round(im.height * factor)), Image.Resampling.LANCZOS) for im in source]
    boxes = [bounds(im) for im in scaled]
    anchor_x = (min(b[0] for b in boxes) + max(b[2] for b in boxes)) / 2
    anchor_y = max(b[3] for b in boxes)
    width, height = reference_meta["frameWidth"], reference_meta["frameHeight"]
    spec = importlib.util.spec_from_file_location("factory", Path(__file__).with_name("sprite-factory.py"))
    factory = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(factory)
    with tempfile.TemporaryDirectory() as directory:
        output_frames = []
        for index, im in enumerate(scaled):
            canvas = Image.new("RGBA", (width, height))
            canvas.alpha_composite(im, (round(width / 2 - anchor_x), height - anchor_y))
            path = Path(directory) / f"frame-{index:03}.png"
            canvas.save(path)
            output_frames.append(path)
        factory.create_phaser_sheet(output_frames, args.sheet, meta["fps"], meta["cols"])
        preview = args.sheet.with_name(args.sheet.name + "-preview-3x").with_suffix(".mp4")
        factory.write_loop_preview(output_frames, preview, fps=meta["fps"], loops=3, bg_color="magenta")
    manifest_path = args.sheet.with_suffix(".manifest.json")
    manifest = json.loads(manifest_path.read_text()) if manifest_path.exists() else {}
    manifest["normalization"] = {
        "reference": str(args.reference), "frameSize": [width, height],
        "alphaThreshold": 127, "referenceHeightMedian": target_height,
        "inputHeightMedian": source_height, "uniformScale": factor,
        "feetAnchor": [0.5, 1], "method": "one constant scale and global center/bottom anchor",
        "command": f"uv run {__file__} --sheet {args.sheet} --reference {args.reference}",
    }
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n")


if __name__ == "__main__":
    main()
