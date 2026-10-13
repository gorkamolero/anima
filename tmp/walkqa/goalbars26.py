"""Additional goal-level turn-rate and exact/absorbed arrival accounting."""
import json,pathlib,math
root=pathlib.Path('tmp/walkqa/sim/26-final');run=json.load(open(root/'run.json'));by={(r['scene'],r['walk']):r for r in run['results']};out=[]
for p in sorted(root.glob('*/*-events.json')):
 name=p.name.removesuffix('-events.json');rows=json.load(open(p.with_name(name+'.json')));distance=0;changes=[]
 for i,(a,b) in enumerate(zip(rows,rows[1:]),1):
  if a['location']!=b['location'] or not(a['visible'] and b['visible']):continue
  if a['walking'] or b['walking']:distance+=math.hypot(b['x']-a['x'],b['y']-a['y'])
  if a['walking'] and b['walking'] and a['contact']['heading']!=b['contact']['heading']:changes.append(i)
 a=by[p.parent.name,name].get('arrival');q={'scene':p.parent.name,'walk':name,'turns':{'changes':len(changes),'frames':changes,'bodyTravelPx':distance,'allowedRate':1/300,'pass_':len(changes)<=distance/300+1e-9},'arrival':a,'exactArrival':bool(a and a['distance']<=1e-6),'halfStrideArrival':bool(a and a['distance']<=a['halfStride']),'absorbedPx':a.get('absorbedDistance',0) if a else 0};out.append(q)
(root/'goal-bars.json').write_text(json.dumps({'walks':out,'turnPass':sum(r['turns']['pass_'] for r in out),'exactArrivals':sum(r['exactArrival'] for r in out),'halfStrideArrivals':sum(r['halfStrideArrival'] for r in out),'absorbedWalks':sum(r['absorbedPx']>0 for r in out)},indent=2))
