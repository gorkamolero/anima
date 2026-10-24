#!/usr/bin/env python3
# /// script
# dependencies = ["pillow", "numpy"]
# ///
"""Seed foot plants for root-motion.py from the silhouette alone.

In a side-view walk the feet are furthest apart at each plant. Per frame, the
lowest band of opaque pixels is split into the front and back foot; the plant
frames are the local maxima of their spread, and the planted foot is the front
one. Labels alternate L, R so each stance keeps its identity.

    uv run scripts/seed-steps.py <sheet.json> [--out seeds.json] [--band 0.06]
"""
import argparse, json
from pathlib import Path
import numpy as np
from PIL import Image

ap = argparse.ArgumentParser(description=__doc__)
ap.add_argument("sheet", type=Path)
ap.add_argument("--out", type=Path)
ap.add_argument("--band", type=float, default=0.06, help="height fraction of the foot band")
ap.add_argument("--facing", choices=["left", "right"], default="left", help="walking direction in the drawing")
args = ap.parse_args()

m = json.loads(args.sheet.read_text())
img = Image.open(args.sheet.with_name(m["image"])).convert("RGBA")
w, h, cols, n = m["frameWidth"], m["frameHeight"], m["cols"], m["frameCount"]
frames = [np.asarray(img.crop(((i % cols) * w, (i // cols) * h, (i % cols + 1) * w, (i // cols + 1) * h)))[:, :, 3] > 127 for i in range(n)]

feet = []
for a in frames:
    ys, xs = np.nonzero(a)
    bottom = ys.max(); top = max(0, bottom - round(h * args.band))
    band = a[top:bottom + 1]
    colsum = band.sum(axis=0)
    occupied = np.nonzero(colsum)[0]
    # split the band at its widest gap; fall back to the median column
    gaps = np.diff(occupied)
    if len(gaps) and gaps.max() > 4:
        cut = occupied[gaps.argmax()]
        left = occupied[occupied <= cut]; right = occupied[occupied > cut]
    else:
        mid = int(np.median(occupied)); left = occupied[occupied <= mid]; right = occupied[occupied > mid]
    def sole(cols_):
        yy, xx = np.nonzero(band[:, cols_.min():cols_.max() + 1])
        low = yy >= np.percentile(yy, 70)
        return {"x": float(cols_.min() + np.median(xx[low])), "y": float(top + np.median(yy[low]))}
    feet.append({"left": sole(left), "right": sole(right), "spread": float(right.max() - left.min())})

spread = np.array([f["spread"] for f in feet])
# smooth circularly, then take local maxima at least n/4 apart
k = np.array([1, 2, 3, 2, 1], float); k /= k.sum()
sm = np.convolve(np.concatenate([spread[-2:], spread, spread[:2]]), k, mode="valid")
peaks = [i for i in range(n) if sm[i] >= sm[(i - 1) % n] and sm[i] >= sm[(i + 1) % n]]
peaks.sort(key=lambda i: -sm[i])
chosen = []
for p in peaks:
    if all(min((p - c) % n, (c - p) % n) >= n // 4 for c in chosen):
        chosen.append(p)
chosen.sort()
front = "left" if args.facing == "left" else "right"
# The spread peaks just before heel strike. Walk forward from each peak while
# the front foot still travels in the walking direction; the plant is where it stops.
sign = -1 if args.facing == "left" else 1
planted = []
for p in chosen:
    i = p
    for _ in range(n // 6):
        dx = (feet[(i + 1) % n][front]["x"] - feet[i][front]["x"]) * sign
        if dx <= 2:
            break
        i = (i + 1) % n
    planted.append(i)
chosen = planted
switches = [{"frame": p, "foot": "LR"[j % 2], "point": feet[p][front]} for j, p in enumerate(chosen)]
seeds = {"switches": switches, "other": feet[chosen[0]]["right" if front == "left" else "left"],
         "patch": [max(12, w * 0.065), max(15, h * 0.045)], "searchRadius": 24, "method": "seed-steps.py: spread maxima of the foot band"}
out = args.out or args.sheet.with_name(args.sheet.stem + "-seeds.json")
out.write_text(json.dumps(seeds, indent=2) + "\n")
print(f"{args.sheet.stem}: plants at {chosen} (spread {[round(float(spread[p])) for p in chosen]} px); wrote {out}")
