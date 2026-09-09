#!/usr/bin/env python3
import json
import sys
from pathlib import Path
from PIL import Image, ImageDraw


def load_json(path: Path):
    with path.open("r", encoding="utf8") as file:
        return json.load(file)


def scale_box(box, sx, sy):
    return {
        "x": box["x"] * sx,
        "y": box["y"] * sy,
        "width": box["width"] * sx,
        "height": box["height"] * sy,
    }


def box_tuple(box):
    return (
        round(box["x"]),
        round(box["y"]),
        round(box["x"] + box["width"]),
        round(box["y"] + box["height"]),
    )


def frame_alpha_box(image_path: Path, metadata_path: Path, frame_index: int):
    metadata = load_json(metadata_path)
    frame_width = int(metadata["frameWidth"])
    frame_height = int(metadata["frameHeight"])
    image = Image.open(image_path).convert("RGBA")
    left = frame_index * frame_width
    frame = image.crop((left, 0, left + frame_width, frame_height))
    alpha = frame.getchannel("A")
    bbox = alpha.getbbox()
    if bbox is None:
        raise RuntimeError(f"Sprite frame {frame_index} has no visible alpha: {image_path}")
    return {
        "frameWidth": frame_width,
        "frameHeight": frame_height,
        "alphaBox": {
            "x": bbox[0],
            "y": bbox[1],
            "width": bbox[2] - bbox[0],
            "height": bbox[3] - bbox[1],
        },
    }


def visible_sprite_box(snapshot, sprite_info):
    hermes = snapshot["hermes"]
    scale = float(hermes["scale"])
    frame_width = sprite_info["frameWidth"]
    frame_height = sprite_info["frameHeight"]
    alpha = sprite_info["alphaBox"]
    frame_left = float(hermes["x"]) - (frame_width * scale) / 2
    frame_top = float(hermes["y"]) - frame_height * scale
    return {
        "x": frame_left + alpha["x"] * scale,
        "y": frame_top + alpha["y"] * scale,
        "width": alpha["width"] * scale,
        "height": alpha["height"] * scale,
    }


def draw_box(draw, box, color, label):
    xy = box_tuple(box)
    draw.rectangle(xy, outline=color, width=4)
    label_pos = (xy[0] + 6, max(8, xy[1] - 28))
    draw.rectangle((label_pos[0] - 4, label_pos[1] - 3, label_pos[0] + 260, label_pos[1] + 22), fill=(0, 0, 0, 190))
    draw.text(label_pos, label, fill=color)


def draw_foot(draw, point, color, label):
    x = round(point["x"])
    y = round(point["y"])
    draw.line((x - 18, y, x + 18, y), fill=color, width=4)
    draw.line((x, y - 18, x, y + 18), fill=color, width=4)
    draw.text((x + 8, y + 8), label, fill=color)


def main():
    if len(sys.argv) != 6:
        raise SystemExit(
            "usage: render-visual-reference-audit.py <repo-root> <manifest> <snapshot> <runtime-screenshot> <output-dir>"
        )

    repo_root = Path(sys.argv[1]).resolve()
    manifest_path = Path(sys.argv[2]).resolve()
    snapshot_path = Path(sys.argv[3]).resolve()
    runtime_screenshot_path = Path(sys.argv[4]).resolve()
    output_dir = Path(sys.argv[5]).resolve()
    output_dir.mkdir(parents=True, exist_ok=True)

    manifest = load_json(manifest_path)
    snapshot = load_json(snapshot_path)

    runtime = Image.open(runtime_screenshot_path).convert("RGBA")
    reference = Image.open(repo_root / "adventures/shadow-over-innsmouth" / manifest["referenceImage"]).convert("RGBA")
    sx = runtime.width / manifest["referenceCanvas"]["width"]
    sy = runtime.height / manifest["referenceCanvas"]["height"]
    reference_scaled = reference.resize(runtime.size)

    expected_hermes = scale_box(manifest["referenceHermesBox"], sx, sy)
    expected_kat = scale_box(manifest["referenceKatBox"], sx, sy)
    expected_foot = {
        "x": manifest["referenceFoot"]["x"] * sx,
        "y": manifest["referenceFoot"]["y"] * sy,
    }

    sprite = manifest["runtimeSprite"]
    sprite_info = frame_alpha_box(
        repo_root / "adventures/shadow-over-innsmouth" / sprite["asset"],
        repo_root / "adventures/shadow-over-innsmouth" / sprite["metadata"],
        int(sprite.get("frame", 0)),
    )
    actual_hermes = visible_sprite_box(snapshot, sprite_info)
    actual_foot = {
        "x": snapshot["hermes"]["x"],
        "y": snapshot["hermes"]["y"],
    }

    height_ratio = actual_hermes["height"] / expected_hermes["height"]
    foot_dx = actual_foot["x"] - expected_foot["x"]
    foot_dy = actual_foot["y"] - expected_foot["y"]
    tolerances = manifest["tolerances"]
    checks = [
        {
            "name": "Hermes visible height matches reference",
            "pass": abs(height_ratio - 1) <= tolerances["heightRatio"],
            "actual": round(actual_hermes["height"], 2),
            "expected": round(expected_hermes["height"], 2),
            "ratio": round(height_ratio, 4),
            "tolerance": tolerances["heightRatio"],
        },
        {
            "name": "Hermes foot x stays near reference approach",
            "pass": abs(foot_dx) <= tolerances["footX"],
            "actual": round(actual_foot["x"], 2),
            "expected": round(expected_foot["x"], 2),
            "delta": round(foot_dx, 2),
            "tolerance": tolerances["footX"],
        },
        {
            "name": "Hermes foot y stays on reference walk depth",
            "pass": abs(foot_dy) <= tolerances["footY"],
            "actual": round(actual_foot["y"], 2),
            "expected": round(expected_foot["y"], 2),
            "delta": round(foot_dy, 2),
            "tolerance": tolerances["footY"],
        },
    ]
    passed = all(check["pass"] for check in checks)

    canvas = Image.new("RGBA", (runtime.width * 2, runtime.height + 96), (18, 20, 24, 255))
    canvas.alpha_composite(reference_scaled, (0, 96))
    canvas.alpha_composite(runtime, (runtime.width, 96))
    draw = ImageDraw.Draw(canvas, "RGBA")
    draw.text((24, 22), f"{manifest['id']} reference", fill=(255, 255, 255, 255))
    draw.text((runtime.width + 24, 22), f"runtime {'PASS' if passed else 'FAIL'}", fill=(255, 255, 255, 255))
    draw.text(
        (runtime.width + 24, 50),
        f"height ratio {height_ratio:.3f}; target scale multiplier {1 / height_ratio:.3f}; foot delta {foot_dx:.1f},{foot_dy:.1f}",
        fill=(255, 220, 140, 255),
    )

    shifted_expected = {**expected_hermes, "y": expected_hermes["y"] + 96}
    shifted_kat = {**expected_kat, "y": expected_kat["y"] + 96}
    shifted_reference_foot = {"x": expected_foot["x"], "y": expected_foot["y"] + 96}
    shifted_expected_right = {**expected_hermes, "x": expected_hermes["x"] + runtime.width, "y": expected_hermes["y"] + 96}
    shifted_actual = {**actual_hermes, "x": actual_hermes["x"] + runtime.width, "y": actual_hermes["y"] + 96}
    shifted_actual_foot = {"x": actual_foot["x"] + runtime.width, "y": actual_foot["y"] + 96}

    draw_box(draw, shifted_expected, (83, 255, 134, 255), "reference Hermes")
    draw_box(draw, shifted_kat, (255, 211, 91, 255), "reference Kat")
    draw_foot(draw, shifted_reference_foot, (83, 255, 134, 255), "reference foot")
    draw_box(draw, shifted_expected_right, (83, 255, 134, 255), "expected from reference")
    draw_box(draw, shifted_actual, (255, 82, 111, 255), "actual visible Hermes")
    draw_foot(draw, shifted_actual_foot, (255, 82, 111, 255), "actual foot")

    report = {
        "id": manifest["id"],
        "passed": passed,
        "runtimeScreenshot": str(runtime_screenshot_path),
        "annotatedImage": str(output_dir / f"{manifest['id']}.png"),
        "snapshot": snapshot,
        "expectedHermesBox": expected_hermes,
        "actualHermesBox": actual_hermes,
        "expectedFoot": expected_foot,
        "actualFoot": actual_foot,
        "spriteAlpha": sprite_info,
        "checks": checks,
        "scaleRecommendation": {
            "currentScale": snapshot["hermes"]["scale"],
            "targetScale": round(snapshot["hermes"]["scale"] / height_ratio, 4),
            "currentBaseScale": snapshot["hermes"]["baseScale"],
            "targetBaseScale": round(snapshot["hermes"]["baseScale"] / height_ratio, 4),
        },
    }

    canvas.save(output_dir / f"{manifest['id']}.png")
    report_path = output_dir / f"{manifest['id']}.json"
    report_path.write_text(json.dumps(report, indent=2) + "\n", encoding="utf8")
    print(json.dumps(report, indent=2))
    if not passed:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
