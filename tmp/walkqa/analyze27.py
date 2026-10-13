"""Brief 27 evidence index; calls the unchanged reviewer arrival tools separately."""
import json,pathlib,collections,math,hashlib
import numpy as np
from scipy import ndimage
base=pathlib.Path('tmp/walkqa/sim');out=base/'27-final'
def analyse(name):
 root=base/name;run=json.load(open(root/'run.json'));totals=collections.Counter();walks=[]
 for w in run['results']:
  scene,walk=w['scene'],w['walk'];rows=json.load(open(root/scene/(walk+'.json')));e=json.load(open(root/scene/(walk+'-events.json')))
  searches=[]
  for row in rows:
   s=row['contact'].get('plan',{}).get('search')
   if s and (not searches or s!=searches[-1]):searches.append(s)
  hist=collections.Counter()
  for s in searches:hist.update(s.get('rejections',{}))
  totals.update(hist)
  end=[r for r in rows if r['contact'].get('arrival')];a=end[-1]['contact']['arrival'] if end else None
  ratio=None;distance=None;travelled=False
  if a:
   loc=end[-1]['location'];startloc=next((r['location'] for r in rows if r['walking']),loc);travelled=loc!=startloc
   if not travelled:
    g=json.load(open(root/scene/'area.json'));area=g.get('areas',{}).get(loc,g['area']);m=area.get('clearanceMask') or area['mask'];W,H=m['width'],m['height'];mask=np.array(m['data']).reshape(H,W)>0
    _,(iy,ix)=ndimage.distance_transform_edt(~mask,return_indices=True);t=a['target'];x=min(W-1,max(0,int(t['x']*W/1920)));y=min(H-1,max(0,int(t['y']*H/1080)));standable={'x':(ix[y,x]+.5)*1920/W,'y':(iy[y,x]+.5)*1080/H};distance=math.dist(list(a['anchor'].values()),list(standable.values()));ratio=distance/a['halfStride']
  first,last=rows[0],rows[-1];target=last.get('target');movement=math.hypot(last['x']-first['x'],last['y']-first['y']);targetDistance=math.hypot(target['x']-first['x'],target['y']-first['y']) if target else 0
  stuck=first['location']==last['location'] and targetDistance>150 and movement<40
  body=0;changes=0
  for p,q in zip(rows,rows[1:]):
   if p['location']!=q['location'] or not(p['visible'] and q['visible']):continue
   if p['walking'] or q['walking']:body+=math.hypot(q['x']-p['x'],q['y']-p['y'])
   if p['walking'] and q['walking'] and p['contact']['heading']!=q['contact']['heading']:changes+=1
  limitations=[]
  if not a:limitations.append('no-arrival-record')
  if ratio is not None and ratio>1:limitations.append('outside-half-stride')
  if ratio is not None and ratio>2:limitations.append('outside-one-stride')
  if stuck:limitations.append('stuck-start')
  walks.append({'scene':scene,'walk':walk,'limitationId':'L27-'+scene+'-'+walk,'limitations':limitations,'hasArrival':bool(a),'travelled':travelled,'halfStrideRatio':ratio,'standableDistancePx':distance,'halfStridePx':a['halfStride'] if a else None,'stuck':stuck,'targetDistancePx':targetDistance,'bodyNetPx':movement,'search':w.get('search'),'searches':searches,'rejections':dict(hist),'turns':{'changes':changes,'bodyTravelPx':body,'pass_':changes<=body/300+1e-9}})
 expansions=[w['search']['expanded'] for w in walks if w['search']];missed=[w['search']['expanded'] for w in walks if w['search'] and w['halfStrideRatio'] is not None and w['halfStrideRatio']>2]
 dist=lambda values:dict(zip(['min','p25','median','p75','p90','p95','max'],np.percentile(values,[0,25,50,75,90,95,100]).tolist()))
 return {'run':name,'elapsedMs':run['elapsedMs'],'walks':walks,'rejections':dict(totals),'expanded':dist(expansions),'missedExpanded':dist(missed),'hasArrival':sum(w['hasArrival'] for w in walks),'travelled':sum(w['travelled'] for w in walks),'halfStride':sum(w['halfStrideRatio'] is not None and w['halfStrideRatio']<=1 for w in walks),'oneStride':sum(w['halfStrideRatio'] is not None and w['halfStrideRatio']<=2 for w in walks),'beyondStride':len(missed),'stuckWithArrival':sum(w['stuck'] and w['hasArrival'] for w in walks),'stuckAll':sum(w['stuck'] for w in walks),'turnPass':sum(w['turns']['pass_'] for w in walks)}
before=analyse('27-before');after=analyse('27-final')
checks=json.load(open(out/'checks.json'));by={(w['scene'],w['walk']):w for w in checks['walks']}
for w in after['walks']:w['checks']=by[w['scene'],w['walk']]['checks']
(out/'diagnostics.json').write_text(json.dumps({'before':before,'after':after},indent=2))
summary={}
for k,v in [('before',before),('after',after)]:summary[k]={a:b for a,b in v.items() if a!='walks'}
(out/'diagnostic-summary.json').write_text(json.dumps(summary,indent=2))
print(json.dumps(summary,indent=2))
