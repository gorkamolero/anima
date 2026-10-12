#!/usr/bin/env python3
"""Locally key the four grey Hermes stills and match the walk's alpha>127 height.
No remote services. Run with Pillow, NumPy and SciPy installed.
"""
import json
import statistics
from pathlib import Path
import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = Path(__file__).resolve().parents[3]
SPR = ROOT / 'adventures/shadow-over-innsmouth/public/assets/sprites/hermes'
OUT = ROOT / 'tmp/walkqa/verification-11'
OUT.mkdir(parents=True, exist_ok=True)
ref = json.loads((SPR / 'hermes-fal-veo-transparent-loop.json').read_text())
sheet = Image.open(SPR / ref['image']).convert('RGBA')
w, h = ref['frameWidth'], ref['frameHeight']
def bounds(im):
    return im.getchannel('A').point(lambda a: 255 if a > 127 else 0).getbbox()
heights = []
for i in range(ref['frameCount']):
    b = bounds(sheet.crop((i % ref['cols'] * w, i // ref['cols'] * h,
                          (i % ref['cols'] + 1) * w, (i // ref['cols'] + 1) * h)))
    heights.append(b[3] - b[1])
target = round(statistics.median(heights))
records = []
for direction in ['away', 'away-right', 'toward', 'toward-right']:
    rgb = np.array(Image.open(SPR / f'hermes-{direction}-keyframe.png').convert('RGB')).astype(float)
    # Grey background is mildly compressed, not a single exact RGB value.
    grey = (np.ptp(rgb, axis=2) < 15) & (rgb.mean(2) > 95) & (rgb.mean(2) < 160)
    labels, _ = ndimage.label(~grey)
    sizes = np.bincount(labels.ravel()); sizes[0] = 0
    body = labels == sizes.argmax()
    # Preserve enclosed greys (shirt and glasses); remove exterior and between boots.
    body = ndimage.binary_fill_holes(body)
    body[rgb.shape[0]//2:] &= ~grey[rgb.shape[0]//2:]
    interior = ndimage.binary_erosion(body, iterations=2)
    _, indices = ndimage.distance_transform_edt(~interior, return_indices=True)
    fg = rgb[tuple(indices)]
    bg = np.median(rgb[grey], axis=0)
    delta = fg - bg
    alpha = np.clip(((rgb-bg)*delta).sum(2) / np.maximum((delta*delta).sum(2), 1), 0, 1)
    alpha[interior] = 1
    alpha[~ndimage.binary_dilation(body)] = 0
    cleaned = np.clip((rgb - (1-alpha[...,None])*bg) / np.maximum(alpha[...,None], .001), 0, 255)
    rgba = np.dstack([cleaned, alpha*255]).astype('uint8')
    im = Image.fromarray(rgba)
    b = bounds(im)
    crop = im.crop(b)
    crop = crop.resize((round(crop.width * target/crop.height), target), Image.Resampling.LANCZOS)
    canvas = Image.new('RGBA', (w, h))
    canvas.alpha_composite(crop, ((w-crop.width)//2, h-target))
    name = f'hermes-stand-{direction}'
    canvas.save(SPR / f'{name}.png')
    # Contacts are checked on the annotated boot crops; identity matches walk sheets.
    a = np.array(canvas.getchannel('A')) > 127
    lower = a.copy(); lower[:h-90] = False
    xs = np.where(lower.any(0))[0]
    split = (xs.min()+xs.max())//2
    contacts = []
    for lo, hi in [(xs.min(), split), (split, xs.max()+1)]:
        ys, xx = np.where(lower[:,lo:hi]); bottom = ys.max()
        sole = xx[ys >= bottom-3] + lo
        contacts.append({'x': float(np.median(sole)), 'y': float(bottom)})
    # Anatomical L is screen-left from behind, screen-right from the front.
    left, right = contacts if direction.startswith('away') else contacts[::-1]
    meta = {'name':name, 'image':f'{name}.png','frameWidth':w,'frameHeight':h,
            'frameCount':1,'cols':1,'rows':1,'fps':24,
            'contacts':[{'L':left,'R':right,'planted':'L'}], 'switchFrames':[],
            'normalization':{'reference':ref['name'],'alphaThreshold':127,
                             'referenceHeightMedian':statistics.median(heights),
                             'visibleHeight':bounds(canvas)[3]-bounds(canvas)[1], 'origin':[.5,1]}}
    (SPR / f'{name}.json').write_text(json.dumps(meta,indent=2)+'\n')
    magenta = Image.new('RGBA',canvas.size,'magenta'); magenta.alpha_composite(canvas)
    magenta.resize((w*3,h*3),Image.Resampling.NEAREST).convert('RGB').save(OUT/f'{name}-magenta-3x.png')
    records.append(meta)
(OUT/'normalization.json').write_text(json.dumps({'heights':heights,'sprites':records},indent=2)+'\n')
print('Reference median:',statistics.median(heights),'sprite heights:',[r['normalization']['visibleHeight'] for r in records])
