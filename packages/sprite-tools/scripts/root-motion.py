#!/usr/bin/env python3
"""Register foot ROIs; rootMotion[i] moves the body from i-1 to i.

Requires numpy and Pillow. Artwork is never modified.
--travel is the body's unflipped screen direction. Debug PNGs are local artifacts.
"""
import argparse
import json
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw


def register(previous, current, roi, radius=64, prediction=(0, 0)):
    """Integer SSD on premultiplied RGB plus alpha, then a parabola per axis."""
    x0, y0, x1, y1 = roi
    def weighted(image):
        image = image.astype(np.float32) / 255
        return np.concatenate((image[:, :, :3] * image[:, :, 3:], image[:, :, 3:]), axis=2)
    a, b = weighted(previous), weighted(current)
    px, py = map(round, prediction)
    pad = radius + max(abs(px), abs(py)) + 2
    b = np.pad(b, ((pad, pad), (pad, pad), (0, 0)))
    template = a[y0:y1, x0:x1]
    search = b[y0+pad+py-radius:y1+pad+py+radius, x0+pad+px-radius:x1+pad+px+radius]
    # FFT correlation and integral-image window energy give exact SSD at all
    # 41 x 41 integer offsets without an optional native vision dependency.
    th, tw = template.shape[:2]
    sh, sw = search.shape[:2]
    shape = (1 << (sh+th-2).bit_length(), 1 << (sw+tw-2).bit_length())
    cross = np.zeros(shape)
    for channel in range(4):
        cross += np.fft.irfft2(np.fft.rfft2(search[:, :, channel], s=shape) *
                              np.fft.rfft2(template[::-1, ::-1, channel], s=shape), s=shape)
    energy = np.pad(np.sum(search**2, axis=2), ((1, 0), (1, 0))).cumsum(0).cumsum(1)
    windows = energy[th:, tw:] - energy[:-th, tw:] - energy[th:, :-tw] + energy[:-th, :-tw]
    cost = windows + np.sum(template**2) - 2*cross[th-1:sh, tw-1:sw]
    iy, ix = np.unravel_index(cost.argmin(), cost.shape)
    def sub(v0, v1, v2):
        denominator = v0 - 2*v1 + v2
        return float(np.clip(.5*(v0-v2)/denominator, -.5, .5)) if denominator > 1e-8 else 0.
    sx = sub(cost[iy, ix-1], cost[iy, ix], cost[iy, ix+1]) if 0 < ix < 2*radius else 0
    sy = sub(cost[iy-1, ix], cost[iy, ix], cost[iy+1, ix]) if 0 < iy < 2*radius else 0
    mass = max(1., float(np.sum(template[:, :, 3]**2)))
    return {'dx': float(px+ix-radius+sx), 'dy': float(py+iy-radius+sy), 'residual': float(max(0, cost[iy, ix])/mass), 'boundary': bool(ix in (0,2*radius) or iy in (0,2*radius))}


def extract(sheet, axis, travel, debug):
    m = json.loads(sheet.read_text())
    w, h = m['frameWidth'], m['frameHeight']
    image = Image.open(sheet.with_name(m['image'])).convert('RGBA')
    frames = [np.asarray(image.crop(((i % m['cols'])*w, (i//m['cols'])*h, (i % m['cols']+1)*w, (i//m['cols']+1)*h))) for i in range(m['frameCount'])]
    pairs = []
    for i, frame in enumerate(frames):
        previous = frames[i-1]
        ys, xs = np.nonzero(previous[:, :, 3] > 127)
        center = w//2
        top, bottom = max(0, int(ys.max()-.09*(ys.max()-ys.min()))), min(h, int(ys.max()+1))
        rois = [[max(0, int(xs.min())-6), top, center+4, bottom], [center-4, top, min(w, int(xs.max())+7), bottom]]
        choices = []
        for foot, roi in zip(('left', 'right'), rois):
            result = register(previous, frame, roi)
            weights = previous[roi[1]:roi[3], roi[0]:roi[2], 3].astype(float)
            yy, xx = np.indices(weights.shape)
            mass = max(1, weights.sum())
            result['point'] = {'x': float(roi[0]+(weights*xx).sum()/mass), 'y': float(roi[1]+(weights*yy).sum()/mass)}
            result.update(foot=foot, roi=roi)
            choices.append(result)
        eligible = [r for r in choices if r['d'+axis]*travel <= .5]
        chosen = min(eligible or choices, key=lambda r: r['residual'])
        pairs.append(dict(chosen=chosen, candidates=choices))
    # Choose a coherent cyclic stance sequence. A lifting foot must improve
    # residual enough to beat switch cost; a single heel-roll reversal does not
    # split one physical stance into several conveniently short QA phases.
    best = None
    for initial in (0, 1):
        costs = [0. if k == initial else float('inf') for k in (0, 1)]
        paths = [[initial], [initial]]
        for pair in pairs[1:]:
            next_costs, next_paths = [], []
            for k, r in enumerate(pair['candidates']):
                previous = min((0,1), key=lambda j: costs[j]+(.2 if j != k else 0))
                next_costs.append(costs[previous]+(.2 if previous != k else 0)+r['residual']+.25*max(0,r['d'+axis]*travel))
                next_paths.append(paths[previous]+[k])
            costs, paths = next_costs, next_paths
        end = min((0,1), key=lambda k: costs[k]+(.2 if k != initial else 0))
        total = costs[end]+(.2 if end != initial else 0)+pairs[0]['candidates'][initial]['residual']
        if best is None or total < best[0]: best = (total, paths[end])
    for pair, k in zip(pairs, best[1]): pair['chosen'] = pair['candidates'][k]
    # No smoothing: preserve measured subpixel displacements at foot switches.
    m['rootMotion'] = [{'dx': -p['chosen']['dx'], 'dy': -p['chosen']['dy']} for p in pairs]
    m['plantedFoot'] = [p['chosen']['foot'] for p in pairs]
    m['footRegistration'] = pairs
    m['footContacts'] = [{'x': p['chosen']['point']['x']+p['chosen']['dx'], 'y': p['chosen']['point']['y']+p['chosen']['dy']} for p in pairs]
    m['rootMotionAxis'] = axis
    m['rootMotionMethod'] = 'foot-roi-ssd-v3; 64px search; directional cyclic stance; body displacement = minus registered foot shift'
    # Periodic, zero-mean displacement relative to average cycle travel.
    vectors = np.array([[r['dx'], r['dy']] for r in m['rootMotion']])
    offsets = np.cumsum(vectors - vectors.mean(axis=0), axis=0)
    offsets -= offsets.mean(axis=0)
    m['visualRoot'] = [{'x': float(x), 'y': float(y)} for x, y in offsets]
    sheet.write_text(json.dumps(m, indent='\t')+'\n')
    debug.mkdir(parents=True, exist_ok=True)
    canvas = Image.new('RGB', (4*320, ((len(frames)+3)//4)*150), '#777777')
    for i, (frame, pair) in enumerate(zip(frames, pairs)):
        tile = Image.fromarray(frame).crop((146, h-110, 466, h))
        draw = ImageDraw.Draw(tile)
        for r in pair['candidates']:
            x0,y0,x1,y1=r['roi']
            draw.rectangle((x0-146,y0-(h-110),x1-146,y1-(h-110)),outline='lime' if r is pair['chosen'] else 'red',width=2)
        r=pair['chosen']; x,y=m['footContacts'][i].values()
        draw.line((x-146,y-h+110,x-146-r['dx']*4,y-h+110-r['dy']*4),fill='cyan',width=2)
        ox,oy=(i%4)*320,(i//4)*150
        canvas.paste(tile,(ox,oy),tile)
        ImageDraw.Draw(canvas).text((ox+4,oy+112), f"{i}: {r['foot']} ({r['dx']:.2f},{r['dy']:.2f}) SSD {r['residual']:.3f}", fill='white')
    canvas.save(debug/(sheet.stem+'-registration.png'))
    print(sheet.name, 'body travel', {k:round(sum(r[k] for r in m['rootMotion']),2) for k in ('dx','dy')})


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('sheet', type=Path)
    parser.add_argument('--axis', choices=('x','y'), required=True)
    parser.add_argument('--travel', type=int, choices=(-1,1), required=True)
    parser.add_argument('--debug', type=Path, default=Path('tmp/walkqa'))
    args = parser.parse_args()
    extract(args.sheet, args.axis, args.travel, args.debug)
