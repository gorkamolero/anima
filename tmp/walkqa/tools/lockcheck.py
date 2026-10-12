"""Does the motor actually lock the planted foot? Projects the sheet's planted-foot keypoint
through the logged per-frame transform (verified to match the video) and reports how far it
moves on screen during each stance. This tests the motor's placement, given the keypoints;
whether the keypoints sit on the real boot is checked separately by eye on the contact sheets.

Stances are grouped by the SHEET's planted label (texture + planted foot), never by the
motor's own logged anchor: grouping by the motor's anchor would hide exactly the anchor
movement this tool exists to measure. Reviewer-owned: don't change the grouping.
Frames where Hermes isn't visible are skipped. Standing poses (single-frame sheets with
contacts) are included, so a settle into standing that moves the planted foot is measured.
"""
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


def screen(row, foot):
    m = meta(row["texture"])
    c = m.get("contacts", [None] * 999)[int(row["frame"])]
    if not c or foot not in c:
        return None
    s, sg = row["scale"], (-1 if row["flip"] else 1)
    return (row["x"] + (c[foot]["x"] - m["frameWidth"] / 2) * s * sg, row["y"] + (c[foot]["y"] - m["frameHeight"]) * s)


for clip in sys.argv[1:]:
    log = json.load(open(os.path.splitext(clip)[0] + ".json"))
    stances, cur = [], []
    for t, row in enumerate(log):
        if not row.get("visible", True) or "contacts" not in meta(row["texture"]):
            if cur:
                stances.append(cur)
                cur = []
            continue
        foot = meta(row["texture"])["contacts"][int(row["frame"])].get("planted")
        p = screen(row, foot)
        if p is None:
            continue
        # a stance continues while the same physical foot stays planted; a texture change
        # (walk -> standing pose, or cycle change) continues it if the foot's screen point is
        # within 3 px (i.e. the settle kept the foot down); otherwise it's a new stance.
        if cur and cur[-1][0][1] == foot and (cur[-1][0][0] == row["texture"] or math.dist(cur[-1][2], p) <= 3):
            pass
        elif cur:
            stances.append(cur)
            cur = []
        cur.append(((row["texture"], foot), t, p))
    if cur:
        stances.append(cur)
    drift = []
    for s in stances:
        if len(s) < 3:
            continue
        xs = [p[2][0] for p in s]
        ys = [p[2][1] for p in s]
        drift.append((round(max(math.hypot(x - xs[0], y - ys[0]) for x, y in zip(xs, ys)), 2), s[0][1], s[-1][1], s[0][0][0][7:]))
    drift.sort(reverse=True)
    print(json.dumps(dict(clip=clip, stances=len(drift), maxExcursion_px=drift[0][0] if drift else None,
                          median=sorted(d[0] for d in drift)[len(drift) // 2] if drift else None, worst=drift[:3])))
