import json,math
from pathlib import Path
root=Path('tmp/walkqa/final-05');sprites=Path('adventures/shadow-over-innsmouth/public/assets/sprites/hermes')
sheets={p.stem:json.loads(p.read_text()) for p in sprites.glob('*.json') if not p.name.endswith('.manifest.json')}
def distance(a,b):return math.hypot(a['x']-b['x'],a['y']-b['y'])
results=[]
for scene in sorted(root.iterdir()):
 if not scene.is_dir():continue
 area=json.loads((scene/'area.json').read_text());mask=area['area']['mask'];p=area['area']['perspective'];base=area['area']['baseScale'];clamp=area['area']['scaleClamp']
 for vid in sorted(scene.glob('*.mp4')):
  frames=json.loads(vid.with_suffix('.json').read_text());walk=[(i,f) for i,f in enumerate(frames) if f['walking'] and f['location']==area['location']]
  errors=[];scales=[];off=[];anchor_drift=[];start=None;last=None;frozen=[]
  for i,f in walk:
   c=f['contact'];m=sheets[c['cycle']];q=m['contacts'][c['frame']][c['planted']];point={'x':f['x']+(q['x']-m['frameWidth']/2)*(-1 if f['flip'] else 1)*f['scale'],'y':f['y']+(q['y']-m['frameHeight'])*f['scale']};errors.append(distance(point,c['anchor']))
   k=1;r=p.get('residual',[])
   if r:
    right=next((n for n,t in enumerate(r) if t['x']>=f['x']),-1)
    if right<=0:k=r[0 if right==0 else -1]['k']
    else:
     a,b=r[right-1],r[right];k=a['k']+(b['k']-a['k'])*(f['x']-a['x'])/(b['x']-a['x'])
   expected=base*max(clamp['min'],min(clamp['max'],p.get('constant',p['slope']*(f['y']-p['horizonY']))*k));scales.append(abs(f['scale']/expected-1))
   x=int(math.floor(f['x']*mask['width']/1920));y=int(math.floor(f['y']*mask['height']/1080));idx=y*mask['width']+x
   if not(0<=x<mask['width'] and 0<=y<mask['height'] and mask['data'][idx]):off.append(i)
   sig=(c['cycle'],c['planted'],f['flip'])
   if last is None or sig!=last[0] or i!=last[1]+1:start=c['anchor']
   anchor_drift.append(distance(start,c['anchor']))
   if last and i==last[1]+1 and f['x']==last[2]['x'] and f['y']==last[2]['y'] and f['frame']==last[2]['frame']:frozen.append(i)
   last=(sig,i,f)
  arrivals=[f['contact']['arrival'] for f in frames if f.get('contact',{}).get('arrival')]
  results.append(dict(clip=f'{scene.name}/{vid.name}',frames=len(frames),walkingFrames=len(walk),walkingSeconds=round(len(walk)/24,3),anchorErrorMax=max(errors,default=None),anchorDriftMax=max(anchor_drift,default=None),scaleErrorMax=max(scales,default=None),offFloorFrames=off,frozenTelemetryFrames=frozen,arrival=arrivals[-1] if arrivals else None))
(scene.parent/'telemetry-results.json').write_text(json.dumps(results,indent=2))
print('clips',len(results),'walking frames',sum(r['walkingFrames'] for r in results),'anchor error',max(r['anchorErrorMax'] or 0 for r in results),'anchor drift',max(r['anchorDriftMax'] or 0 for r in results),'scale error',max(r['scaleErrorMax'] or 0 for r in results),'off-floor frames',sum(len(r['offFloorFrames']) for r in results),'frozen',sum(len(r['frozenTelemetryFrames']) for r in results))
for r in results:
 if r['clip'].startswith('road/diagonal') or r['offFloorFrames']:print(r['clip'],r['walkingSeconds'],'seconds',len(r['offFloorFrames']),'off floor')
