#!/usr/bin/env python3
"""Remove only linear cross-axis camera drift, retaining residual pose bob.

Read immutable git source so reruns cannot accumulate transforms. Integer whole-frame
translations preserve pixels and apply the same offsets to every contact seed. Diagonal
clips retain their photographed direction. No generated frames or foot sliding.
"""
import io,json,subprocess,pathlib
import numpy as np
from PIL import Image
ROOT=pathlib.Path('adventures/shadow-over-innsmouth/public/assets/sprites/hermes')
OUT=pathlib.Path('tmp/walkqa/harness-24/art');OUT.mkdir(parents=True,exist_ok=True)
BASE='83e5099'
def source(path):return subprocess.check_output(['git','show',f'{BASE}:{path}'])
records=[]
for name,axis in [('hermes-fal-veo-transparent-loop',1),('hermes-walk-away',0),('hermes-walk-toward',0)]:
 path=ROOT/(name+'.json');m=json.loads(source(path));im=Image.open(io.BytesIO(source(ROOT/m['image']))).convert('RGBA')
 w,h,n=m['frameWidth'],m['frameHeight'],m['frameCount'];offsets=np.zeros((n,2),dtype=int);stances=[]
 switches=m['switchFrames'];cut=m['matchedCut']['exitFrames'][0]
 for j,start in enumerate(switches):
  end=switches[(j+1)%len(switches)];run=[(start+k)%n for k in range((end-start)%n or n)];foot=m['contacts'][start]['planted'];key='xy'[axis]
  values=np.array([m['contacts'][i][foot][key] for i in run]);drift=values[-1]-values[0]
  # Keep the matched standing frame stationary in its own stance.
  pivot=run.index(cut) if cut in run else (len(run)-1)/2
  for t,i in enumerate(run):offsets[i,axis]=round(-drift*(t-pivot)/(len(run)-1))
  stances.append(dict(start=start,foot=foot,frames=run,linearCrossAxisDrift=float(drift)))
 pad=np.maximum(0,-offsets.min(axis=0));extra=np.maximum(0,offsets.max(axis=0));nw,nh=(np.array([w,h])+pad+extra).tolist();offsets+=pad
 canvas=Image.new('RGBA',(nw*m['cols'],nh*((n+m['cols']-1)//m['cols'])))
 for i,offset in enumerate(offsets):
  x,y=i%m['cols']*w,i//m['cols']*h;frame=im.crop((x,y,x+w,y+h));dx,dy=map(int,offset);tile=Image.new('RGBA',(nw,nh));tile.paste(frame,(dx,dy))
  if np.asarray(tile)[...,3].sum()!=np.asarray(frame)[...,3].sum():raise ValueError(f'{name} frame {i}: clipping')
  canvas.paste(tile,(i%m['cols']*nw,i//m['cols']*nh))
 for group in ['switches','swing']:
  for seed in m['contactSeeds'].get(group,[]):
   dx,dy=offsets[seed['frame']];seed['point']['x']+=int(dx);seed['point']['y']+=int(dy)
 if name=='hermes-fal-veo-transparent-loop':
  lengths=[]
  for stance in stances:
   run=stance['frames'];foot=stance['foot'];a=m['contacts'][run[0]][foot];b=m['contacts'][run[-1]][foot];lengths.append(abs(b['x']-a['x']))
  durations=[0.]*n
  for stance,length in zip(stances,lengths):
   for i in stance['frames']:durations[i]=(1000/2.2)*(length/min(lengths))/len(stance['frames'])
  m['frameDurationsMs']=durations
  m['retiming']={'method':'preserve all source poses; allocate stance time proportional to measured horizontal distance','stanceLengths':lengths,'cadence':2000/sum(durations)}
 m['frameWidth'],m['frameHeight']=nw,nh
 m['sourceCorrection']=dict(method='integer linear cross-axis translation per stance; residual bob retained',sourceCommit=BASE,offsets=offsets.tolist())
 canvas.save(ROOT/m['image']);path.write_text(json.dumps(m,indent='\t')+'\n')
 records.append(dict(cycle=name,stances=stances,offsets=offsets.tolist()))
(OUT/'dedrift.json').write_text(json.dumps(records,indent=2))
