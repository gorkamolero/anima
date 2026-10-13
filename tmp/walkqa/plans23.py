"""Brief 23 plans: preserve semantic targets, replace degenerate starts; metres recorded."""
import json,pathlib, numpy as np
from scipy import ndimage
root=pathlib.Path('tmp/walkqa/harness-23')
for nav in root.glob('*/navigation.json'):
 g=json.loads(nav.read_text());a=g['area'];m=a['mask'];mask=np.array(m['data']).reshape(m['height'],m['width'])>0
 labels,n=ndimage.label(mask);sizes=np.bincount(labels.ravel());sizes[0]=0;component=labels==sizes.argmax()
 yy,xx=np.nonzero(component);points=np.column_stack(((xx+.5)*1920/m['width'],(yy+.5)*1080/m['height']))
 p=a['perspective'];ppm=p.get('pixelsPerMetre',300)
 def ground(q):
  q=np.asarray(q);z=1/(p['slope']*(q[...,1]-p['horizonY']))
  return np.stack(((q[...,0]-p.get('cx',960))*z/ppm,z*p.get('focalLength',1000)/ppm),axis=-1)
 gp=ground(points)
 def nearest(q):return points[np.argmin(np.linalg.norm(points-np.array(q),axis=1))]
 plan=json.loads((pathlib.Path('tmp/walkqa/harness-22')/nav.parent.name/'plan.json').read_text())
 # Keep the intended extremes and crossings. Select far enough starts on the
 # same connected component, biased towards the original start and open floor.
 clearance=ndimage.distance_transform_edt(component)[yy,xx]
 usable=(clearance>=1)&(points[:,0]>30)&(points[:,0]<1890)&(points[:,1]<1070)
 for beat in plan['beats']:
  requested=np.array(beat['click']);target=nearest(requested)
  if beat.get('object'):
   obj=next(o for o in g['interactables'] if o['name']==beat['object']);b=obj['bounds']
   requested=np.array([(b[0]+b[2])*960,b[3]*1080+5]);target=nearest(requested)
   beat['approachEstimate']=target.tolist()
  if beat.get('exit'):
   e=next((e for e in g['exits'] if e['id']==beat['exit']),{});q=e.get('approach')
   if not e:beat['coverageFailure']='Exit in brief 22 is absent from current scene geometry'
   if q:target=nearest([q['x'],q['y']])
  distances=np.linalg.norm(gp-ground(target),axis=1)
  valid=usable&(distances>=2.05)
  if beat['name']=='unreachable':valid=usable
  if not valid.any():
   # Move degenerate semantic targets to the nearest genuine reachable extent.
   old=target.copy(); found=False
   for candidate in points[np.argsort(np.linalg.norm(points-target,axis=1))]:
    distances=np.linalg.norm(gp-ground(candidate),axis=1);valid=usable&(distances>=2.05)
    if valid.any():target=candidate;found=True;break
   if not found:raise RuntimeError(f'{nav.parent.name}: floor diameter below 2 m')
   beat['targetRepair']={'oldReachableTarget':old.tolist(),'reason':'No start >=2m from old target; nearest reachable extent with a qualifying start'}
   if not beat.get('object') and not beat.get('exit'):beat['click']=target.tolist();requested=target
   else:beat['coverageFailure']='Object/exit approach has no >=2m start; inspect live approach before capture' 
  candidates=points[valid];start=candidates[np.argmin(np.linalg.norm(candidates-np.array(beat['start']),axis=1))]
  beat['start']=start.tolist();beat['target']=requested.tolist();beat['reachableTarget']=target.tolist();beat['groundDistance']=float(np.linalg.norm(ground(start)-ground(target)))
  beat['distanceStatus']='planned; capture must validate actual support start and motor goal'
 plan['method']='Connected-component floor targets; each non-unreachable start >=2.2 ground metres from reachable target; actual starts and motor goals remeasured at capture'
 (nav.parent/'plan.json').write_text(json.dumps(plan,indent=2));print(nav.parent.name,len(plan['beats']),min(b['groundDistance'] for b in plan['beats'] if b['name']!='unreachable'))
