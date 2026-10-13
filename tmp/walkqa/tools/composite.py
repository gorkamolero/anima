#!/usr/bin/env python3
"""Offline visual aid from telemetry, never a replacement for numeric gates.
Usage: composite.py LOG FRAME --out frame.png [--browser browser.png]
       composite.py LOG --sheet --out sheet.png [--stride 4]
"""
import argparse
import functools
import json
import math
from pathlib import Path
import time
from PIL import Image, ImageChops, ImageStat, ImageDraw

ROOT = Path(__file__).resolve().parents[3]
PUBLIC = ROOT / 'adventures/shadow-over-innsmouth/public'

@functools.lru_cache(maxsize=128)
def load(path):
    return Image.open(path).convert('RGBA')

@functools.lru_cache(maxsize=512)
def sprite(texture, frame, cut=None):
    folder = 'kat' if texture.startswith('kat') else 'hermes'
    path = PUBLIC / 'assets/sprites' / folder / (texture + '.png')
    sheet = load(str(path))
    if cut:
        x, y, w, h = cut
    else:
        meta = json.loads(path.with_suffix('.json').read_text())
        w, h = meta['frameWidth'], meta['frameHeight']
        x, y = frame % (sheet.width // w) * w, frame // (sheet.width // w) * h
    return sheet.crop((x, y, x+w, y+h))

def overlay(canvas, source, bounds, flip=False):
    if flip:
        source = source.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
    x, y, w, h = bounds
    sx, sy = canvas.width / 1920, canvas.height / 1080
    # Retain fractional bounds; do not round the sprite's screen position.
    left, top = math.floor(x*sx), math.floor(y*sy)
    right, bottom = math.ceil((x+w)*sx), math.ceil((y+h)*sy)
    if right <= left or bottom <= top:
        return
    ax, ay = source.width/(w*sx), source.height/(h*sy)
    patch = source.transform((right-left,bottom-top),Image.Transform.AFFINE,
        (ax,0,(left-x*sx)*ax,0,ay,(top-y*sy)*ay),Image.Resampling.BILINEAR)
    canvas.alpha_composite(patch,(left,top))

def render(row, geometry, width=1920):
    background = geometry.get('image')
    if not background:
        candidate = geometry.get('background','')
        if candidate.startswith('/generated/') or candidate.startswith('/backgrounds/'):
            background = PUBLIC / candidate.lstrip('/')
        else:
            raise ValueError('navigation.json must contain the stored background image path')
    canvas = load(str(background)).resize((width,round(width*1080/1920)),Image.Resampling.BILINEAR).copy()
    objects = {o['id']:o for o in geometry['objects']}
    draws = []
    for oc in row['occluders']:
        b=oc['bounds']; bounds=(b['x'],b['y'],b['width'],b['height'])
        if 'sprite' in oc:
            s=oc['sprite']; source=sprite(s['texture'],0,(s['cutX'],s['cutY'],s['width'],s['height']))
            draws.append((oc['depth'],source,bounds,s['flip']))
        else:
            o=objects[oc['id']]
            draws.append((oc['depth'],load(str(Path(background).parent/o['png'])),bounds,False))
    if row['visible']:
        im=sprite(row['texture'],row['frame']); scale=row['scale']
        draws.append((row['depth'],im,(row['x']-im.width*scale/2,row['y']-im.height*scale,im.width*scale,im.height*scale),row['flip']))
    for _,im,bounds,flip in sorted(draws,key=lambda d:d[0]):
        overlay(canvas,im,bounds,flip)
    return canvas

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('log',type=Path);parser.add_argument('frame',type=int,nargs='?',default=0)
    parser.add_argument('--out',required=True,type=Path);parser.add_argument('--browser',type=Path)
    parser.add_argument('--sheet',action='store_true');parser.add_argument('--stride',type=int,default=4)
    args=parser.parse_args();rows=json.loads(args.log.read_text())
    geometry=json.loads((args.log.parent/'navigation.json').read_text())
    began=time.perf_counter()
    if args.sheet:
        indexes=list(range(0,len(rows),args.stride)); indexes+=[] if indexes[-1]==len(rows)-1 else [len(rows)-1]
        output=Image.new('RGBA',(1920,200*math.ceil(len(indexes)/6)),(20,20,20,255));draw=ImageDraw.Draw(output)
        for j,i in enumerate(indexes):
            output.alpha_composite(render(rows[i],geometry,320),((j%6)*320,(j//6)*200))
            draw.text(((j%6)*320+4,(j//6)*200+182),f'{i} {rows[i]["texture"]} / {rows[i]["frame"]}',fill='white')
    else: output=render(rows[args.frame],geometry)
    args.out.parent.mkdir(parents=True,exist_ok=True);output.convert('RGB').save(args.out)
    report={'renderMs':(time.perf_counter()-began)*1000,'output':str(args.out)}
    if args.browser:
        reference=load(str(args.browser)).convert('RGB');actual=output.convert('RGB')
        diff=ImageChops.difference(reference,actual);stats=ImageStat.Stat(diff)
        report.update(meanAbsoluteError=sum(stats.mean)/3,maxChannelError=max(e[1] for e in diff.getextrema()),differentPixels=sum(1 for p in diff.getdata() if p!=(0,0,0)),pixels=actual.width*actual.height)
        diff.save(args.out.with_suffix('.diff.png'))
        args.out.with_suffix('.diff.json').write_text(json.dumps(report,indent=2))
    print(json.dumps(report))

if __name__=='__main__':main()
