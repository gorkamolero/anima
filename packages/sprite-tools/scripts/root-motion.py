#!/usr/bin/env python3
"""Extract lowest alpha contact and frame-to-frame stance displacement.

Usage: root-motion.py sheet.json [--axis x|y] [--travel -1|1]
RootMotion[i] is contact[i] - contact[i-1]. Swing/foot-switch frames use
median stance travel; contacts remain in metadata for independent QA.
Requires ImageMagick. Does not change artwork.
"""
import argparse
import json
import pathlib
import statistics
import subprocess

p = argparse.ArgumentParser()
p.add_argument('sheet', type=pathlib.Path)
p.add_argument('--axis', choices=['x', 'y'], required=True)
p.add_argument('--travel', type=int, choices=[-1, 1], required=True)
a = p.parse_args()
m = json.loads(a.sheet.read_text())
w, h = m['frameWidth'], m['frameHeight']
raw = subprocess.check_output(['magick', str(a.sheet.with_name(m['image'])), '-alpha', 'extract', '-depth', '8', 'gray:-'])
stride = w * m['cols']
contacts = []
for i in range(m['frameCount']):
    ox, oy = (i % m['cols']) * w, (i // m['cols']) * h
    bottom = next(y for y in range(h-1, -1, -1) if max(raw[(oy+y)*stride+ox:(oy+y)*stride+ox+w]) > 127)
    xs = [x for y in range(max(0, bottom-6), bottom+1) for x in range(w) if raw[(oy+y)*stride+ox+x] > 127]
    contacts.append({'x': sum(xs)/len(xs), 'y': bottom})
axis = a.axis
low = max(c['y'] for c in contacts)
valid = []
for i, c in enumerate(contacts):
    prev = contacts[i-1]
    d = c[axis]-prev[axis]
    if min(c['y'], prev['y']) >= low-8 and abs(c['x']-prev['x']) < 40 and d*a.travel < 0:
        valid.append(d)
if not valid:
    raise SystemExit('No forward stance contacts; inspect the sheet and direction')
fallback = statistics.median(valid)
root = []
swing = []
for i, c in enumerate(contacts):
    prev = contacts[i-1]
    dx, dy = c['x']-prev['x'], c['y']-prev['y']
    d = dx if axis == 'x' else dy
    stance = min(c['y'], prev['y']) >= low-8 and abs(dx) < 40
    if not stance: swing.append(i)
    root.append({'dx': dx if stance else (fallback if axis == 'x' else 0), 'dy': dy if stance else (fallback if axis == 'y' else 0)})
# A closed cycle must not accumulate sideways locomotion. Put the recovery
# on airborne frames, retaining every measured stance delta unchanged.
other = 'dy' if axis == 'x' else 'dx'
if swing:
    recovery = -sum(r[other] for r in root) / len(swing)
    for i in swing: root[i][other] += recovery
m['rootMotion'] = root
m['footContacts'] = contacts
m['rootMotionAxis'] = axis
m['rootMotionMethod'] = 'lowest-alpha-contact-v1; 7-row contact centroid; swing uses median forward stance'
a.sheet.write_text(json.dumps(m, indent='\t')+'\n')
print(a.sheet.name, len(root), 'frames; stance median', fallback)
