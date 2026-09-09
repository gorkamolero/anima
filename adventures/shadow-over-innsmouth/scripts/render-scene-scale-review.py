#!/usr/bin/env python3
import json
import math
import sys
from pathlib import Path
from PIL import Image, ImageDraw


def load_json(path: Path):
    with path.open("r", encoding="utf8") as file:
        return json.load(file)


def frame_alpha_box(image_path: Path, metadata_path: Path, frame_index: int):
    metadata = load_json(metadata_path)
    frame_width = int(metadata["frameWidth"])
    frame_height = int(metadata["frameHeight"])
    image = Image.open(image_path).convert("RGBA")
    left = frame_index * frame_width
    frame = image.crop((left, 0, left + frame_width, frame_height))
    bbox = frame.getchannel("A").getbbox()
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
    alpha = sprite_info["alphaBox"]
    frame_left = float(hermes["x"]) - (sprite_info["frameWidth"] * scale) / 2
    frame_top = float(hermes["y"]) - sprite_info["frameHeight"] * scale
    return {
        "x": frame_left + alpha["x"] * scale,
        "y": frame_top + alpha["y"] * scale,
        "width": alpha["width"] * scale,
        "height": alpha["height"] * scale,
    }


def draw_label(draw, xy, text, fill=(255, 255, 255, 255)):
    x, y = xy
    lines = text.split("\n")
    width = max(len(line) for line in lines) * 7 + 12
    height = len(lines) * 14 + 10
    draw.rectangle((x, y, x + width, y + height), fill=(0, 0, 0, 190))
    draw.multiline_text((x + 6, y + 5), text, fill=fill, spacing=2)


def runtime_box(snapshot):
    bounds = snapshot["hermes"].get("bounds")
    if not bounds:
        return None
    return {
        "x": float(bounds["x"]),
        "y": float(bounds["y"]),
        "width": float(bounds["width"]),
        "height": float(bounds["height"]),
    }


def box_tuple(box):
    return (
        round(box["x"]),
        round(box["y"]),
        round(box["x"] + box["width"]),
        round(box["y"] + box["height"]),
    )


def draw_runtime_overlay(image, item):
    output = image.copy()
    draw = ImageDraw.Draw(output, "RGBA")
    snapshot = item["snapshot"]
    hermes = snapshot["hermes"]
    bounds = runtime_box(snapshot)
    if bounds:
        draw.rectangle(box_tuple(bounds), outline=(0, 255, 95, 255), width=8)

    foot_x = round(hermes["x"])
    foot_y = round(hermes["y"])
    draw.line((foot_x - 34, foot_y, foot_x + 34, foot_y), fill=(255, 38, 83, 255), width=7)
    draw.line((foot_x, foot_y - 34, foot_x, foot_y + 34), fill=(255, 38, 83, 255), width=7)

    points = snapshot.get("groundLine", [])
    if len(points) > 1:
        for start, end in zip(points, points[1:]):
            draw.line((start["x"], start["y"], end["x"], end["y"]), fill=(0, 220, 255, 230), width=5)
        for point in points:
            x = round(point["x"])
            y = round(point["y"])
            draw.ellipse((x - 8, y - 8, x + 8, y + 8), fill=(255, 209, 102, 255), outline=(0, 0, 0, 220), width=2)

    route_label = " ROUTE ONLY" if item.get("routeOnly") else ""
    draw_label(
        draw,
        (22, 72),
        f"{item['id']}  {item.get('zone', '')}{route_label}\n"
        f"Phaser getBounds: {hermes.get('bounds')}\n"
        f"foot {hermes['x']},{hermes['y']}  scale {hermes['scale']:.4f}  displayH {hermes['displayHeight']}\n"
        f"visible alpha H {item['visibleHeight']}  state {hermes['motionState']}  texture {hermes['textureKey']}",
        fill=(255, 230, 150, 255) if item.get("routeOnly") else (230, 255, 235, 255),
    )
    return output


def main():
    if len(sys.argv) != 5:
        raise SystemExit(
            "usage: render-scene-scale-review.py <repo-root> <manifest> <capture-report> <output-dir>"
        )
    repo_root = Path(sys.argv[1]).resolve()
    manifest_path = Path(sys.argv[2]).resolve()
    capture_report_path = Path(sys.argv[3]).resolve()
    output_dir = Path(sys.argv[4]).resolve()
    output_dir.mkdir(parents=True, exist_ok=True)

    manifest = load_json(manifest_path)
    capture_report = load_json(capture_report_path)
    sprite = manifest["sprite"]
    sprite_info = frame_alpha_box(
        repo_root / "adventures/shadow-over-innsmouth" / sprite["asset"],
        repo_root / "adventures/shadow-over-innsmouth" / sprite["metadata"],
        int(sprite.get("frame", 0)),
    )

    review_frames_dir = output_dir / "review-frames"
    review_frames_dir.mkdir(parents=True, exist_ok=True)

    frames = []
    for item in capture_report["samples"]:
        image = Image.open(item["screenshot"]).convert("RGBA")
        visible_box = visible_sprite_box(item["snapshot"], sprite_info)
        item["visibleBox"] = visible_box
        item["visibleHeight"] = round(visible_box["height"], 2)
        item["runtimeBounds"] = runtime_box(item["snapshot"])
        review_frame = draw_runtime_overlay(image, item)
        review_frame_path = review_frames_dir / f"{item['id']}.png"
        review_frame.save(review_frame_path)
        item["reviewFrame"] = str(review_frame_path)
        frames.append(review_frame)

    tolerances = manifest.get("tolerances", {})
    max_scale_delta = tolerances.get("maxAdjacentScaleDelta", math.inf)
    max_height_delta = tolerances.get("maxAdjacentHeightDelta", math.inf)
    continuity = []
    for previous, current in zip(capture_report["samples"], capture_report["samples"][1:]):
        scale_delta = abs(current["snapshot"]["hermes"]["scale"] - previous["snapshot"]["hermes"]["scale"])
        height_delta = abs(current["visibleHeight"] - previous["visibleHeight"])
        continuity.append(
            {
                "from": previous["id"],
                "to": current["id"],
                "scaleDelta": round(scale_delta, 4),
                "heightDelta": round(height_delta, 2),
                "pass": scale_delta <= max_scale_delta and height_delta <= max_height_delta,
            }
        )

    thumb_width = 640
    thumb_height = 360
    header_height = 86
    cols = 3
    rows = math.ceil(len(frames) / cols)
    sheet = Image.new("RGBA", (cols * thumb_width, rows * (thumb_height + header_height)), (16, 18, 22, 255))

    for index, (image, item) in enumerate(zip(frames, capture_report["samples"])):
        row = index // cols
        col = index % cols
        x0 = col * thumb_width
        y0 = row * (thumb_height + header_height)
        thumb = image.resize((thumb_width, thumb_height))
        sheet.alpha_composite(thumb, (x0, y0 + header_height))
        draw = ImageDraw.Draw(sheet, "RGBA")
        draw.rectangle((x0, y0, x0 + thumb_width, y0 + header_height), fill=(16, 18, 22, 255))
        hermes = item["snapshot"]["hermes"]
        route_label = " route-only" if item.get("routeOnly") else ""
        draw_label(
            draw,
            (x0 + 10, y0 + 8),
            f"{item['id']}  {item.get('zone', '')}{route_label}\n"
            f"x {hermes['x']} y {hermes['y']} scale {hermes['scale']:.4f} visibleH {item['visibleHeight']}\n"
            f"frameH {hermes['displayHeight']} state {hermes['motionState']}",
            fill=(255, 210, 130, 255) if item.get("routeOnly") else (245, 236, 199, 255),
        )

    crop_width = 420
    crop_height = 360
    crop_header_height = 70
    crop_cols = 2
    crop_rows = math.ceil(len(capture_report["samples"]) / crop_cols)
    crop_sheet = Image.new(
        "RGBA",
        (crop_cols * crop_width, crop_rows * (crop_height + crop_header_height)),
        (12, 14, 18, 255),
    )
    for index, item in enumerate(capture_report["samples"]):
        review_frame = Image.open(item["reviewFrame"]).convert("RGBA")
        bounds = item["runtimeBounds"]
        pad = 220
        crop_left = max(0, round(bounds["x"] - pad))
        crop_top = max(0, round(bounds["y"] - pad))
        crop_right = min(review_frame.width, round(bounds["x"] + bounds["width"] + pad))
        crop_bottom = min(review_frame.height, round(bounds["y"] + bounds["height"] + pad))
        crop = review_frame.crop((crop_left, crop_top, crop_right, crop_bottom))
        crop.thumbnail((crop_width, crop_height))
        x0 = (index % crop_cols) * crop_width
        y0 = (index // crop_cols) * (crop_height + crop_header_height)
        crop_sheet.alpha_composite(
            crop,
            (x0 + (crop_width - crop.width) // 2, y0 + crop_header_height + (crop_height - crop.height) // 2),
        )
        draw = ImageDraw.Draw(crop_sheet, "RGBA")
        hermes = item["snapshot"]["hermes"]
        route_label = " ROUTE" if item.get("routeOnly") else ""
        draw.text(
            (x0 + 8, y0 + 8),
            f"{item['id']}{route_label}\n"
            f"x {hermes['x']} y {hermes['y']} s {hermes['scale']:.4f} h {hermes['displayHeight']}",
            fill=(255, 230, 150, 255) if item.get("routeOnly") else (245, 236, 199, 255),
        )

    report = {
        **capture_report,
        "spriteAlpha": sprite_info,
        "continuity": continuity,
        "passed": all(item["pass"] for item in continuity),
        "contactSheet": str(output_dir / f"{manifest['id']}.png"),
        "cropSheet": str(output_dir / f"{manifest['id']}-crops.png"),
        "reviewFramesDir": str(review_frames_dir),
    }
    report_path = output_dir / f"{manifest['id']}.json"
    sheet.save(output_dir / f"{manifest['id']}.png")
    crop_sheet.save(output_dir / f"{manifest['id']}-crops.png")
    report_path.write_text(json.dumps(report, indent=2) + "\n", encoding="utf8")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
