"""Per-clip walk statistics from the verified per-frame logs.

- on-floor: the planted contact point (sheet keypoint projected through the log) lies on
  the scene's walk mask (<scene>/area.json, 384x216 over 1920x1080), every walking frame;
- ground speed per cycle (m/s) from contact.ground;
- cadence (steps/s) = planted-foot switches per second;
- walk length (s) and straight-line distance.
Usage: walkstats.py <dir-with-scene-subdirs>
"""
import collections
import glob
import json
import math
import os
import sys

SPR = "/Users/gorkolas/Developer/anima/adventures/shadow-over-innsmouth/public/assets/sprites/hermes"
_m = {}


def meta(t):
    if t not in _m:
        _m[t] = json.load(open(os.path.join(SPR, t + ".json")))
    return _m[t]


root = sys.argv[1]
speeds = collections.defaultdict(list)
rows = []
for scene in sorted(glob.glob(os.path.join(root, "*", "area.json"))):
    area = json.load(open(scene))["area"]
    A = area["mask"]
    footprints = area.get("objectFootprints")
    mw, mh, md = A["width"], A["height"], A["data"]

    def on(x, y):
        i, j = math.floor(x * mw / 1920), math.floor(y * mh / 1080)
        return 0 <= i < mw and 0 <= j < mh and md[j * mw + i] > 0

    for f in sorted(glob.glob(os.path.join(os.path.dirname(scene), "*.json"))):
        if f.endswith("area.json"):
            continue
        try:
            L = json.load(open(f))
        except Exception:
            continue
        if not isinstance(L, list) or not L or "contact" not in L[0]:
            continue
        w = [r for r in L if r.get("walking")]
        off, contacts, switches, seg = 0, 0, 0, collections.defaultdict(lambda: [0.0, 0])
        prev = None
        for r in w:
            m = meta(r["texture"])
            c = m.get("contacts", [None] * 999)[int(r["frame"])] if "contacts" in m else None
            if c:
                ft = c["planted"]
                s, sg = r["scale"], (-1 if r["flip"] else 1)
                x = r["x"] + (c[ft]["x"] - m["frameWidth"] / 2) * s * sg
                y = r["y"] + (c[ft]["y"] - m["frameHeight"]) * s
                off += 0 if on(x, y) else 1
                if footprints:
                    fx, fy = math.floor(x * footprints["width"] / 1920), math.floor(y * footprints["height"] / 1080)
                    if 0 <= fx < footprints["width"] and 0 <= fy < footprints["height"]:
                        contacts += bool(footprints["data"][fy * footprints["width"] + fx])
                if prev and (prev[0] != r["texture"] or prev[1] != ft):
                    switches += 1
                prev = (r["texture"], ft)
        for a, b in zip(w, w[1:]):
            ga, gb = a["contact"].get("ground"), b["contact"].get("ground")
            if not ga or not gb:
                continue
            d = math.hypot(gb["x"] - ga["x"], gb["y"] - ga["y"])
            if d > 0.5:
                continue
            k = b["texture"].replace("hermes-", "").replace("fal-veo-transparent-loop", "side")
            seg[k][0] += d
            seg[k][1] += 1
        for k, (d, n) in seg.items():
            if n >= 12:
                speeds[k].append(d / (n / 24))
        dist = math.hypot(w[-1]["x"] - w[0]["x"], w[-1]["y"] - w[0]["y"]) if w else 0
        rows.append((os.path.relpath(f, root), len(w) / 24, dist, off, len(w), switches / (len(w) / 24) if w else 0, contacts if footprints else None))

print("clip".ljust(44), "walk s", " dist px", "off-floor", "steps/s", "object-contacts")
for r in rows:
    print(r[0].ljust(44), f"{r[1]:6.1f}", f"{r[2]:7.0f}", f"{r[3]:4d}/{r[4]:<4d}", f"{r[5]:5.2f}", str(r[6]) if r[6] is not None else "MISSING")
print()
for k, v in sorted(speeds.items()):
    v = sorted(v)
    print(k.ljust(20), "ground m/s min/median/max", round(v[0], 2), round(v[len(v) // 2], 2), round(v[-1], 2), f"(n={len(v)})")
