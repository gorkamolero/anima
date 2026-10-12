#!/usr/bin/env python3
"""Track physical sole contacts for anchor-based sprite walking.

Requires numpy and Pillow. Artwork is never modified.
Reviewed stance seeds may be supplied with --seeds. Debug PNGs show every frame.
"""
import argparse
import json
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw


def register(previous, current, roi, radius=64, prediction=(0, 0), masked=False):
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
    # FFT correlations evaluate weighted SSD over the entire search window
    # without an optional native vision dependency.
    th, tw = template.shape[:2]
    sh, sw = search.shape[:2]
    shape = (1 << (sh+th-2).bit_length(), 1 << (sw+tw-2).bit_length())
    cross = np.zeros(shape)
    mask = (template[:, :, 3] > .5).astype(np.float32) if masked else np.ones(template.shape[:2], dtype=np.float32)
    template = template * mask[:, :, None]
    for channel in range(4):
        cross += np.fft.irfft2(np.fft.rfft2(search[:, :, channel], s=shape) *
                              np.fft.rfft2(template[::-1, ::-1, channel], s=shape), s=shape)
    energy = np.sum(search**2, axis=2)
    windows = np.fft.irfft2(np.fft.rfft2(energy, s=shape) *
                           np.fft.rfft2(mask[::-1, ::-1], s=shape), s=shape)[th-1:sh, tw-1:sw]
    cost = windows + np.sum(template**2) - 2*cross[th-1:sh, tw-1:sw]
    iy, ix = np.unravel_index(cost.argmin(), cost.shape)
    def sub(v0, v1, v2):
        denominator = v0 - 2*v1 + v2
        return float(np.clip(.5*(v0-v2)/denominator, -.5, .5)) if denominator > 1e-8 else 0.
    sx = sub(cost[iy, ix-1], cost[iy, ix], cost[iy, ix+1]) if 0 < ix < 2*radius else 0
    sy = sub(cost[iy-1, ix], cost[iy, ix], cost[iy+1, ix]) if 0 < iy < 2*radius else 0
    mass = max(1., float(np.sum(template[:, :, 3]**2)))
    return {'dx': float(px+ix-radius+sx), 'dy': float(py+iy-radius+sy), 'residual': float(max(0, cost[iy, ix])/mass), 'boundary': bool(ix in (0,2*radius) or iy in (0,2*radius))}


def track_stance(frames, start, count, point, size):
    """Move the same sole keypoint by chained local boot registration, never re-pick it."""
    points = [dict(point)]
    diagnostics = []
    h, w = frames[0].shape[:2]
    velocity = (0, 0)
    for step in range(1, count):
        previous = (start + step - 1) % len(frames)
        current = (start + step) % len(frames)
        q = points[-1]
        rx, ry = size
        roi = [max(0, round(q['x']-rx)), max(0, round(q['y']-ry)),
               min(w, round(q['x']+rx)), min(h, round(q['y']+8))]
        result = register(frames[previous], frames[current], roi, radius=48 if step == 1 else 24, prediction=velocity)
        refined = register(frames[previous], frames[current], roi, radius=2,
                           prediction=(result['dx'], result['dy']), masked=True)
        if not refined['boundary']:
            result['dx'], result['dy'] = refined['dx'], refined['dy']
        velocity = (float(np.clip(result['dx'],-48,48)), float(np.clip(result['dy'],-48,48)))
        points.append({'x':float(np.clip(q['x']+result['dx'],1,w-2)),'y':float(np.clip(q['y']+result['dy'],1,h-2))})
        diagnostics.append(dict(frame=current, **result))
    return points, diagnostics


def seed_sole(frame, left):
    """Only used to initialise a track, never during a stance."""
    h,w=frame.shape[:2]
    ys,xs=np.nonzero(frame[:,:,3]>127)
    bottom=int(ys.max()); top=max(0,bottom-round((bottom-ys.min())*.07))
    a,b=(0,w//2) if left else (w//2,w)
    yy,xx=np.nonzero(frame[top:bottom+1,a:b,3]>127)
    if not len(xx): return {'x':w*.5,'y':float(bottom)}
    low=yy>=np.percentile(yy,80)
    return {'x':float(a+np.median(xx[low])),'y':float(top+np.median(yy[low]))}


def extract(sheet, axis, travel, debug, seeds=None):
    m=json.loads(sheet.read_text()); w,h=m['frameWidth'],m['frameHeight']
    image=Image.open(sheet.with_name(m['image'])).convert('RGBA')
    frames=[np.asarray(image.crop(((i%m['cols'])*w,(i//m['cols'])*h,(i%m['cols']+1)*w,(i//m['cols']+1)*h))) for i in range(m['frameCount'])]
    n=len(frames)
    # Explicit reviewed physical-foot handoffs replace image-half classifications.
    spec=seeds or m.get('contactSeeds') or {'switches':[{'frame':0,'foot':'L','point':seed_sole(frames[0],True)}],
                  'other':seed_sole(frames[0],False),'patch':[max(12,w*.065),max(15,h*.045)]}
    switches=sorted(spec['switches'],key=lambda v:v['frame'])
    contacts=[{} for _ in frames]; diagnostics=[]
    patch=spec.get('patch',[w*.075,h*.05])
    for j,seed in enumerate(switches):
        start=seed['frame']; end=switches[(j+1)%len(switches)]['frame']
        count=(end-start)%n or n
        foot=seed['foot']
        # Include the preceding pose to transfer the new foot at a real handoff.
        previous=(start-1)%n
        backward,_=track_stance([frames[start],frames[previous]],0,2,seed['point'],patch)
        contacts[previous][foot]=backward[-1]
        tracked,diag=track_stance(frames,start,count,seed['point'],patch)
        diagnostics.extend(dict(foot=foot,**d) for d in diag)
        for k,point in enumerate(tracked):
            i=(start+k)%n;contacts[i][foot]=point;contacts[i]['planted']=foot
    # Track the swing backwards from its landing to retain identity through crossings.
    # The planted track is never changed by swing registration.
    for foot in ('L','R'):
        known=[i for i,c in enumerate(contacts) if foot in c]
        if not known:
            start=spec.get('other',seed_sole(frames[0],foot=='L'))
            tracked,_=track_stance(frames,0,n,start,patch)
            for c,q in zip(contacts,tracked):c[foot]=q
            continue
        for j,a in enumerate(known):
            b=known[(j+1)%len(known)]; gap=(b-a)%n
            if gap<2: continue
            checkpoints=[c for c in spec.get('swing',[]) if c['foot']==foot and 0<(c['frame']-a)%n<gap]
            if checkpoints:
                seed=checkpoints[0];mid=seed['frame'];before=(mid-a)%n;after=(b-mid)%n
                forward,_=track_stance(frames,mid,after,seed['point'],patch)
                reverse=[frames[(mid-k)%n] for k in range(before)]
                backward,_=track_stance(reverse,0,before,seed['point'],patch)
                for k,q in enumerate(forward):contacts[(mid+k)%n][foot]=q
                for k,q in enumerate(backward):contacts[(mid-k)%n][foot]=q
            else:
                reverse=[frames[(b-k)%n] for k in range(gap)]
                tracked,_=track_stance(reverse,0,gap,contacts[b][foot],patch)
                for k in range(1,gap):contacts[(b-k)%n][foot]=tracked[k]
    for key in ('rootMotion','visualRoot','footRegistration','footContacts','plantedFoot','rootMotionAxis','rootMotionMethod'):
        m.pop(key,None)
    m.update(contacts=contacts,switchFrames=[s['frame'] for s in switches],
             contactMethod='physical-foot stance seeds; chained 48px boot SSD with local masked refinement; swing tracked backwards from landing',contactSeeds=spec)
    sheet.write_text(json.dumps(m,indent='\t')+'\n')
    debug.mkdir(parents=True,exist_ok=True)
    tilew=306; bottom=min(h,round(h*.28)); zoom=tilew/w; tileh=round(bottom*zoom)+30
    canvas=Image.new('RGB',(6*tilew,((n+5)//6)*tileh),'#777777')
    for i,(frame,c) in enumerate(zip(frames,contacts)):
        tile=Image.fromarray(frame).crop((0,h-bottom,w,h)).resize((tilew,round(bottom*zoom)))
        x,y=i%6*tilew,i//6*tileh;canvas.paste(tile,(x,y),tile);draw=ImageDraw.Draw(canvas)
        for foot,color in [('L','cyan'),('R','yellow')]:
            px=x+c[foot]['x']*zoom;py=y+(c[foot]['y']-h+bottom)*zoom
            draw.ellipse((px-4,py-4,px+4,py+4),outline=color,width=2)
            draw.text((px+5,py-12),foot,fill=color)
        draw.text((x+4,y+tileh-20),f"{i}: planted {c['planted']}"+(' SWITCH' if i in m['switchFrames'] else ''),fill='white')
    canvas.save(debug/(sheet.stem+'-contacts.png'))
    (debug/(sheet.stem+'-tracking.json')).write_text(json.dumps(diagnostics,indent=2))
    print(sheet.name,'switches',m['switchFrames'])


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('sheet',type=Path)
    parser.add_argument('--axis',choices=('x','y'),default='x')
    parser.add_argument('--travel',type=int,choices=(-1,1),default=-1)
    parser.add_argument('--debug',type=Path,default=Path('tmp/walkqa/contacts-05'))
    parser.add_argument('--seeds',type=Path)
    args=parser.parse_args()
    extract(args.sheet,args.axis,args.travel,args.debug,json.loads(args.seeds.read_text()) if args.seeds else None)
