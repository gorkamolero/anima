#!/usr/bin/env python3
"""Measure sole-aligned walk/still matches. Local, deterministic, no image service.
Head/torso proxies are alpha centroids of the top 23% / 25-62% of each
silhouette's own visible height. Metrics use sprite pixels, before scaling.
Lower-body silhouette, free sole displacement and boot spread rank before upper body.
Only visually reviewed passing poses are eligible. All frames are measured; one minimum-score exit per support and a ranked entry list
with at least two remaining support frames are selected; runtime chooses the
best floor-safe candidate on the actual planted foot. Mirroring preserves
IoU and displacement lengths, so mirrored headings share the measurements.
"""
import json
import subprocess
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw
from scipy.ndimage import shift

ROOT = Path(__file__).resolve().parents[3]
SPR = ROOT / 'adventures/shadow-over-innsmouth/public/assets/sprites/hermes'
OUT = ROOT / 'tmp/walkqa/verification-14/matches'
OUT.mkdir(parents=True, exist_ok=True)
PAIRS = [('hermes-fal-veo-transparent-loop', 'hermes-passing-stand-side', ['left', 'right'])] + [
    ('hermes-walk-'+d, 'hermes-passing-stand-'+d, headings) for d, headings in [
        ('away', ['away']), ('toward', ['toward']),
        ('away-right', ['away-right', 'away-left']),
        ('toward-right', ['toward-right', 'toward-left'])]]

def frames(meta):
    im = Image.open(SPR / meta['image']).convert('RGBA')
    w,h = meta['frameWidth'],meta['frameHeight']
    return [im.crop((i%meta['cols']*w,i//meta['cols']*h,(i%meta['cols']+1)*w,(i//meta['cols']+1)*h)) for i in range(meta['frameCount'])]

def centroid(a, lo, hi):
    ys = np.where(a > 127)[0]; top,bottom = ys.min(),ys.max()+1
    y0,y1 = int(top+(bottom-top)*lo),int(top+(bottom-top)*hi)
    weights = a[y0:y1].astype(float)/255
    yy,xx = np.indices(weights.shape)
    return np.array([(weights*xx).sum(), (weights*(yy+y0)).sum()])/weights.sum()

summary=[]
for walk,stand,headings in PAIRS:
    path=SPR/(walk+'.json'); meta=json.loads(path.read_text())
    idle=json.loads((SPR/(stand+'.json')).read_text()); images=frames(meta); still=frames(idle)[0]
    a=np.array(still.getchannel('A')); pad=350
    records=[]
    for i,im in enumerate(images):
        foot=meta['contacts'][i]['planted']; c=meta['contacts'][i][foot]; s=idle['contacts'][0][foot]
        delta=np.array([c['x']-s['x'],c['y']-s['y']])
        b=np.array(im.getchannel('A'))
        aa=shift(np.pad(a,pad), (delta[1],delta[0]),order=1,mode='constant')>127
        bb=np.pad(b,pad)>127
        iou=float((aa&bb).sum()/(aa|bb).sum())
        hip=int(np.where(b>127)[0].min()+.62*(np.where(b>127)[0].max()+1-np.where(b>127)[0].min()))+pad
        lower_iou=float((aa[hip:]&bb[hip:]).sum()/max(1,(aa[hip:]|bb[hip:]).sum()))
        free='R' if foot=='L' else 'L'
        source_free=meta.get('reviewedFreeBootSoles',{}).get(str(i),{}).get(free,meta['contacts'][i][free])
        still_free=idle['bootSoles'][0][free]
        free_px=float(np.linalg.norm(np.array([still_free['x'],still_free['y']])+delta-np.array([source_free['x'],source_free['y']])))
        spread=float(np.linalg.norm(np.array([source_free['x'],source_free['y']])-np.array([c['x'],c['y']])))
        lower_score=(1-lower_iou)*100+free_px+.25*spread
        passing=i in meta['reviewedPassingFrames']
        head=float(np.linalg.norm(centroid(a,0,.23)+delta-centroid(b,0,.23)))
        torso=float(np.linalg.norm(centroid(a,.25,.62)+delta-centroid(b,.25,.62)))
        remaining=1
        while remaining<len(images) and meta['contacts'][(i+remaining)%len(images)]['planted']==foot: remaining+=1
        records.append(dict(frame=i,foot=foot,alphaIoU=round(iou,6),headPx=round(head,3),torsoPx=round(torso,3),lowerBodyIoU=round(lower_iou,6),freeFootPx=round(free_px,3),bootSpreadPx=round(spread,3),passing=passing,lowerBodyScore=round(lower_score,3),score=round(lower_score,3),remainingSupport=remaining))
    rank=lambda r:(r['lowerBodyScore'],r['headPx']+r['torsoPx'])
    eligible=[r for r in records if r['passing']]
    exits=[min((r for r in eligible if r['foot']==f),key=rank)['frame'] for f in ['L','R']]
    # Cycles may contain more than one stance per anatomical foot. Include
    # the best cut in every contiguous support, rather than skipping a step.
    for start in meta['switchFrames']:
        support=[]; j=start
        while not support or meta['contacts'][j]['planted']==meta['contacts'][start]['planted']:
            support.append(records[j]); j=(j+1)%len(images)
            if j==start: break
        support=[r for r in support if r['passing']]
        if not support: continue
        best=min(support,key=rank)['frame']
        if best not in exits: exits.append(best)
    # Never insert a poor coverage frame just to satisfy the half-cycle cap.
    # The runtime cap and floor-safe fallback remain explicit safety constraints.
    entries=[r['frame'] for r in sorted(eligible,key=rank) if r['remainingSupport']>=2]
    meta['matchedCut']={'standing':stand,'headings':headings,'exitFrames':exits,'entryFrames':entries,'metrics':records,'method':'reviewed passing poses only; sole aligned lower-body alpha>127 IoU below walk hip at 62% visible height; primary=100*(1-lowerIoU)+freeBootSolePx+0.25*bootSpreadPx; secondary=headPx+torsoPx; reviewed free soles for passing frames, raw tracker for ineligible frames'}
    path.write_text(json.dumps(meta,indent='\t')+'\n')
    sheet=Image.new('RGB',(1200,500*len(exits)),'#303038'); draw=ImageDraw.Draw(sheet)
    for row,i in enumerate(exits):
        r=records[i]; foot=r['foot']; c=meta['contacts'][i][foot]; s=idle['contacts'][0][foot]
        layers=[]
        for im,offset in [(images[i],(0,0)),(still,(round(c['x']-s['x']),round(c['y']-s['y'])))]:
            canvas=Image.new('RGBA',(1000,1400)); canvas.alpha_composite(im,(180+offset[0],180+offset[1])); layers.append(canvas)
        overlay=Image.blend(layers[0],layers[1],.5) # Debug comparison ONLY, never game artwork.
        for col,im in enumerate([*layers,overlay]):
            bg=Image.new('RGBA',im.size,'#505058'); bg.alpha_composite(im)
            sheet.paste(bg.convert('RGB').resize((350,450)),(col*400,row*500+45))
        draw.text((10,row*500+5),f'{walk} {foot}: exit {i}, entry {next(j for j in entries if records[j]["foot"]==foot)}, legs {r["lowerBodyIoU"]} free {r["freeFootPx"]}, head {r["headPx"]} px, torso {r["torsoPx"]} px',fill='white')
        draw.text((10,row*500+25),'WALK                                      SOLE-ALIGNED STANDING                         COMPARISON OVERLAY ONLY',fill='white')
    sheet.save(OUT/(walk+'.png'))
    summary.append({'cycle':walk,'headings':headings,'exits':[records[i] for i in exits],'entries':[records[next(i for i in entries if records[i]['foot']==f)] for f in ['L','R']]})
(OUT/'summary.json').write_text(json.dumps(summary,indent=2)+'\n')
print(json.dumps(summary,indent=2))

subprocess.run(["pnpm", "--filter", "@anima/shadow-over-innsmouth", "exec", "biome", "format", "--write", *[str(SPR/(w+".json")) for w,_,_ in PAIRS]], cwd=ROOT, check=True)
