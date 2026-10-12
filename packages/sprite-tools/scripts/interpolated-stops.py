#!/usr/bin/env python3
"""Offline RIFE stop candidates; never installs unreviewed art into the game.

Run in tmp/interpolation-17/venv with rife-mlx installed. Model/cache belongs
under tmp, not in source control. Endpoints are translated, never warped.
"""
import argparse
import hashlib
import json
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as ndi


def opaque_body(image):
    pixels = np.array(image)
    interior = ndi.binary_erosion(pixels[:, :, 3] > 127, iterations=3)
    pixels[interior, 3] = 255
    return Image.fromarray(pixels)


def matte(rgb):
    c = np.asarray(rgb, dtype=float)
    distance = np.linalg.norm(c - 128, axis=2)
    candidate = distance < 35
    seeds = np.zeros(candidate.shape, bool)
    seeds[0] = candidate[0]
    seeds[-1] = candidate[-1]
    seeds[:, 0] = candidate[:, 0]
    seeds[:, -1] = candidate[:, -1]
    outside = ndi.binary_propagation(seeds, mask=candidate)
    _, indices = ndi.distance_transform_edt(outside, return_indices=True)
    foreground = c[indices[0], indices[1]] - 128
    alpha = np.clip(np.sum((c - 128) * foreground, axis=2) /
                    np.maximum(1, np.sum(foreground ** 2, axis=2)), 0, 1)
    alpha[~outside] = 1  # Body interior must remain fully opaque.
    alpha[distance < 2] = 0
    color = np.clip((c - 128 * (1 - alpha[..., None])) /
                    np.maximum(alpha[..., None], .001), 0, 255)
    return opaque_body(Image.fromarray(np.dstack((color, alpha * 255)).astype('uint8')))


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--sources', type=Path, default=Path('tmp/walkqa/verification-16b'))
    p.add_argument('--output', type=Path, default=Path('tmp/walkqa/verification-17'))
    p.add_argument('--steps', type=int, default=8, choices=range(5, 10))
    args = p.parse_args()
    from rife_mlx.utils.weights import build_model
    from rife_mlx.pipeline_mlx import interpolate_pair
    model = build_model('4.25')
    records = json.loads((args.sources / 'sources.json').read_text())
    for record in records:
        heading = record['heading']
        out = args.output / heading
        out.mkdir(parents=True, exist_ok=True)
        a, b = [opaque_body(Image.open(args.sources / 'sources' / f'{heading}-{s}-alpha.png').convert('RGBA'))
                for s in ['first', 'last']]
        contact = record['contact'][record['contact']['planted']]
        x, y = round(contact['x']), round(contact['y'])
        # Whole-image integer translation fitted to the planted boot only.
        def gray(im):
            bg = Image.new('RGBA', im.size, (128, 128, 128, 255))
            bg.alpha_composite(im)
            return bg.convert('RGB')
        template = np.array(gray(a).convert('L'))[y-55:y+4, x-25:x+25]
        search = np.array(gray(b).convert('L'))[y-95:min(a.height,y+44), x-65:x+65]
        score = cv2.matchTemplate(search, template, cv2.TM_CCOEFF_NORMED)
        _, confidence, _, loc = cv2.minMaxLoc(score)
        dx, dy = 40-loc[0], 40-loc[1]
        registration_note = 'local boot template; inspect physical foot identity'
        if heading == 'away-right':
            # The template prefers the OTHER boot on this different drawing.
            # Reviewed viewer-left rest sole (222,1006) -> source (285,1024).
            dx, dy = 63, 18
            registration_note = 'reviewed anatomical support sole; template matched the wrong boot'
        translated = Image.new('RGBA', b.size)
        translated.alpha_composite(b, (dx, dy))
        b = translated
        a.save(out / 'first-alpha.png'); b.save(out / 'last-alpha.png')
        rgb0, rgb1 = gray(a), gray(b)
        rgb0.save(out / 'first.png'); rgb1.save(out / 'last.png')
        frames = [a]
        for i in range(1, args.steps):
            raw = Image.fromarray(interpolate_pair(model, np.array(rgb0), np.array(rgb1), i / args.steps))
            raw.save(out / f'rgb-{i:02}.png')
            frames.append(matte(raw))
        frames.append(b)
        sheet = Image.new('RGBA', (a.width * len(frames), a.height))
        for i, frame in enumerate(frames):
            frame.save(out / f'frame-{i:02}.png')
            sheet.paste(frame, (i*a.width, 0))
            # One full-resolution 2x frame per file, avoiding viewer downsampling.
            gray(frame).resize((a.width*2,a.height*2), Image.Resampling.NEAREST).save(out/f'review-{i:02}-2x.png')
        sheet.save(out / 'candidate-sheet.png')
        # Small overview is navigation, not the full-resolution inspection.
        overview = Image.new('RGB', (306*len(frames), 550), '#808080')
        draw = ImageDraw.Draw(overview)
        for i, frame in enumerate(frames):
            overview.paste(gray(frame).resize((306,530)), (306*i,20))
            draw.text((306*i+5,4),str(i),fill='white')
        overview.save(out/'overview.png')
        metadata = {**record, 'translationCorrection':[dx,dy], 'bootCorrelation':confidence,
                    'registrationNote': registration_note,
                    'method':'RIFE 4.25 MLX, RGB128 endpoints, local connected matte',
                    'status':'candidate: contacts are endpoint anchors, not proof of visual lock',
                    'image':'candidate-sheet.png','frameWidth':a.width,'frameHeight':a.height,
                    'frameCount':len(frames),'fps':24,
                    'contacts':[record['contact'] for _ in frames],
                    'sha256':hashlib.sha256((out/'candidate-sheet.png').read_bytes()).hexdigest()}
        (out/'candidate.json').write_text(json.dumps(metadata,indent=2)+'\n')
        print(heading, 'completed', confidence, (dx,dy), flush=True)


if __name__ == '__main__':
    main()
