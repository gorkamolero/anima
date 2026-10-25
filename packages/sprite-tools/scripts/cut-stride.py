#!/usr/bin/env python3
# /// script
# dependencies = ["pillow", "numpy"]
# ///
"""Cut one stride out of a transparent walk video by gait, not by pixels.

Finds every foot plant from the foot spread of the silhouette, considers every
window from a plant to the second plant after it (one full stride, two steps),
and picks the one whose two steps match in length and whose end frame looks
most like its start frame. Writes the chosen frames as a Phaser sheet and
metadata (fps, cols) ready for register/seed-steps/root-motion.

    uv run scripts/cut-stride.py <frames-dir> <sheet-base> [--fps 24] [--cols 8]
        [--facing left] [--skip 36] [--band 0.06]
"""
import argparse, json
from pathlib import Path
import numpy as np
from PIL import Image

ap = argparse.ArgumentParser(description=__doc__)
ap.add_argument("frames", type=Path)
ap.add_argument("sheet", type=Path, help="output base path without extension")
ap.add_argument("--fps", type=int, default=24)
ap.add_argument("--cols", type=int, default=8)
ap.add_argument("--facing", choices=["left", "right"], default="left")
ap.add_argument("--skip", type=int, default=36, help="frames to ignore at the start (turn-in)")
ap.add_argument("--band", type=float, default=0.06)
args = ap.parse_args()

files = sorted(args.frames.glob("*.png"))
imgs = [Image.open(f).convert("RGBA") for f in files]
alphas = [np.asarray(im)[:, :, 3] > 127 for im in imgs]
h, w = alphas[0].shape
N = len(alphas)

def feet(a):
    ys, xs = np.nonzero(a)
    bottom = ys.max(); top = max(0, bottom - round(h * args.band))
    band = a[top:bottom + 1]
    occ = np.nonzero(band.sum(axis=0))[0]
    gaps = np.diff(occ)
    if len(gaps) and gaps.max() > 4:
        cut = occ[gaps.argmax()]; left = occ[occ <= cut]; right = occ[occ > cut]
    else:
        mid = int(np.median(occ)); left = occ[occ <= mid]; right = occ[occ > mid]
    return float(left.min()), float(right.max())

spread = np.array([r - l for l, r in (feet(a) for a in alphas)])
k = np.array([1, 2, 3, 2, 1], float); k /= k.sum()
sm = np.convolve(np.pad(spread, 2, mode="edge"), k, mode="valid")
# plants: local maxima of spread, at least 6 frames apart, after the skip
peaks = [i for i in range(args.skip + 1, N - 1) if sm[i] >= sm[i - 1] and sm[i] >= sm[i + 1]]
plants = []
for p in sorted(peaks, key=lambda i: -sm[i]):
    if all(abs(p - c) >= 6 for c in plants):
        plants.append(p)
plants.sort()
if len(plants) < 3:
    raise SystemExit(f"only {len(plants)} plants found: {plants}")

def seam(a, b):
    """Dissimilarity between two frames: alpha mismatch plus colour difference inside the figure."""
    A, B = alphas[a], alphas[b]
    iou = (A & B).sum() / max(1, (A | B).sum())
    ra = np.asarray(imgs[a])[:, :, :3].astype(float); rb = np.asarray(imgs[b])[:, :, :3].astype(float)
    both = A & B
    colour = np.abs(ra - rb)[both].mean() / 255 if both.any() else 1
    return (1 - iou) + colour

candidates = []
for i in range(len(plants) - 2):
    s, m, e = plants[i], plants[i + 1], plants[i + 2]
    step1, step2 = m - s, e - m
    ratio = max(step1, step2) / min(step1, step2)
    candidates.append((ratio, seam(s, e), s, e, step1, step2))
candidates.sort(key=lambda c: (round(c[0], 2), c[1]))
ratio, sm_, s, e, step1, step2 = candidates[0]
print(f"plants at {plants}")
for c in candidates:
    print(f"  stride {c[2]}..{c[3]} steps {c[4]}/{c[5]} ratio {c[0]:.2f} seam {c[1]:.3f}")
print(f"chosen {s}..{e - 1} ({e - s} frames), steps {step1}/{step2}, ratio {ratio:.2f}, seam {sm_:.3f}")

# Sheet: trim all chosen frames to their shared bbox, tile.
chosen = list(range(s, e))
boxes = [imgs[i].getchannel("A").point(lambda v: 255 if v > 40 else 0).getbbox() for i in chosen]
x0 = min(b[0] for b in boxes); y0 = min(b[1] for b in boxes); x1 = max(b[2] for b in boxes); y1 = max(b[3] for b in boxes)
fw, fh = x1 - x0, y1 - y0
n = len(chosen); rows = (n + args.cols - 1) // args.cols
canvas = Image.new("RGBA", (fw * args.cols, fh * rows))
for j, i in enumerate(chosen):
    canvas.paste(imgs[i].crop((x0, y0, x1, y1)), ((j % args.cols) * fw, (j // args.cols) * fh))
canvas.save(args.sheet.with_suffix(".png"))
meta = {
    "name": args.sheet.name, "image": args.sheet.name + ".png",
    "frameWidth": fw, "frameHeight": fh, "frameCount": n, "cols": args.cols, "rows": rows, "fps": args.fps,
    "source": {"frames": str(args.frames), "start": s, "end": e - 1, "plants": plants, "steps": [step1, step2], "seam": sm_,
               "method": "cut-stride.py: one stride between plants, chosen by step symmetry then seam similarity"},
}
args.sheet.with_suffix(".json").write_text(json.dumps(meta, indent="\t") + "\n")

# Seeds for root-motion.py from the same plants, so the stance split matches the cut.
front = "left" if args.facing == "left" else "right"
def sole_point(i):
    a = alphas[i]; ys, xs = np.nonzero(a); bottom = ys.max(); top = max(0, bottom - round(h * args.band))
    band = a[top:bottom + 1]; occ = np.nonzero(band.sum(axis=0))[0]
    gaps = np.diff(occ)
    if len(gaps) and gaps.max() > 4:
        cut = occ[gaps.argmax()]; left = occ[occ <= cut]; right = occ[occ > cut]
    else:
        mid = int(np.median(occ)); left = occ[occ <= mid]; right = occ[occ > mid]
    cols_ = left if front == "left" else right
    yy, xx = np.nonzero(band[:, cols_.min():cols_.max() + 1]); low = yy >= np.percentile(yy, 70)
    return {"x": float(cols_.min() + np.median(xx[low]) - x0), "y": float(top + np.median(yy[low]) - y0)}
seeds = {"switches": [{"frame": 0, "foot": "L", "point": sole_point(s)}, {"frame": plants[plants.index(s) + 1] - s, "foot": "R", "point": sole_point(plants[plants.index(s) + 1])}],
         "patch": [max(12, fw * 0.065), max(15, fh * 0.045)], "searchRadius": 24, "method": "cut-stride.py plants"}
args.sheet.with_name(args.sheet.name + "-seeds.json").write_text(json.dumps(seeds, indent=2) + "\n")
print(f"seeds: plants at 0 and {seeds['switches'][1]['frame']}")
print(f"wrote {args.sheet}.png/.json {fw}x{fh} x{n}")
