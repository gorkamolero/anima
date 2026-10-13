"""Generate deterministic coverage from the live eroded mask; no authored coordinates."""
import json,pathlib
import numpy as np
from scipy import ndimage as ndi
from shapely.geometry import Polygon,Point
root=pathlib.Path('tmp/walkqa/harness-20')
for file in root.glob('*/navigation.json'):
 g=json.loads(file.read_text());a=g['area'];m=a['mask'];mask=np.array(m['data']).reshape(m['height'],m['width'])>0
 labels,n=ndi.label(mask);sizes=np.bincount(labels.ravel());sizes[0]=0;component=labels==sizes.argmax()
 yy,xx=np.nonzero(component);pts=np.column_stack(((xx+.5)*1920/m['width'],(yy+.5)*1080/m['height']))
 # Leave an interior cell margin for extrema; these remain genuine extrema of the selected component.
 dist=ndi.distance_transform_edt(component); clearance=dist[yy,xx]; usable=clearance>=2
 p=pts[usable];d=clearance[usable]
 exits=[Polygon([(q["x"],q["y"]) for q in e["region"]]).buffer(50) for e in g["exits"]]
 p=np.array([q for q in p if 30<q[0]<1890 and 65<q[1]<1020 and not any(e.covers(Point(q)) for e in exits)])
 def pick(x,y): return p[np.argmin((p[:,0]-x)**2+(p[:,1]-y)**2)].tolist()
 left,right=p[:,0].min(),p[:,0].max();top,bottom=p[:,1].min(),min(940,p[:,1].max());mid=(left+right)/2
 nearleft=pick(left,bottom);nearright=pick(right,bottom);farleft=pick(left,top);farright=pick(right,top);deep=p[p[:,1].argmin()].tolist();centre=pick(mid,(top+bottom)/2)
 beats=[]
 def add(name,start,target,**kw):beats.append(dict(name=name,start=start,click=target,**kw))
 for name,start,target in [('near-left',nearright,nearleft),('near-right',nearleft,nearright),('deepest',pick(mid,bottom),deep),('far-left',farright,farleft),('far-right',farleft,farright),('diagonal-away',nearleft,farright),('diagonal-toward',farleft,nearright)]:add(name,start,target)
 rear=[]
 for o in sorted(g['objects'],key=lambda o:o['bbox']['w']*o['bbox']['h'],reverse=True):
  b=o['bbox'];baseline=o.get('baseline',[])
  if not baseline:continue
  by=np.interp(p[:,0],[q['x'] for q in baseline],[q['y'] for q in baseline]);inside=(p[:,0]>b['x'])&(p[:,0]<b['x']+b['w'])&(p[:,1]<by)&(p[:,1]>by-100)
  if inside.any():
   q=p[inside];rearpoint=q[np.argmin((q[:,0]-b['x']-b['w']/2)**2+(q[:,1]-by[inside]+25)**2)].tolist();front=pick(b['x']+b['w']/2,b['y']+b['h']+70)
   add('occluder-behind',front,rearpoint,occluder=o['id']);add('occluder-back',rearpoint,front,occluder=o['id']);rear=[o['id']];break
 if not rear:
  add('occluder-behind',centre,deep,coverageFailure='No reachable rear strip found');add('occluder-back',deep,centre,coverageFailure='No reachable rear strip found')
 # Local maxima of clearance across the corridor normal, excluding short dead ends.
 ridge=component & (dist>=2)&(((dist>=np.roll(dist,1,0))&(dist>=np.roll(dist,-1,0)))|((dist>=np.roll(dist,1,1))&(dist>=np.roll(dist,-1,1))))
 gy,gx=np.nonzero(ridge);order=np.argsort(dist[gy,gx]);gap=None
 for j in order:
  q=np.array([(gx[j]+.5)*1920/m['width'],(gy[j]+.5)*1080/m['height']]);near=p[np.linalg.norm(p-q,axis=1)<100]
  if len(near)<5:continue
  cov=np.cov(near.T);v=np.linalg.eigh(cov)[1][:,-1];s=pick(*(q-v*80));t=pick(*(q+v*80))
  if np.linalg.norm(np.array(s)-t)>100:gap=(s,t,q.tolist(),float(dist[gy[j],gx[j]]*1920/m['width']*2));break
 if gap:add('narrow-gap',gap[0],gap[1],gapCentre=gap[2],clearanceDiameter=gap[3])
 else:add('narrow-gap',nearleft,nearright,coverageFailure='No corridor candidate')
 add('unreachable',centre,[mid,max(65,top-180)])
 if g['interactables']:add('object',centre,centre,object=g['interactables'][0]['name'])
 else:add('object',centre,centre,coverageFailure='No interactables')
 for e in g['exits']:
  q=[sum(v[k] for v in e['region'])/len(e['region']) for k in ['x','y']]
  add('exit-'+e['id'],centre,q,exit=e['id'],expectedDestination=e.get('to'),exitKind=e['kind'])
 (file.parent/'plan.json').write_text(json.dumps(dict(place=g['location'],method='largest eroded connected component; extrema, local clearance ridges, baseline rear strips',beats=beats),indent=2))
 print(file.parent.name,len(beats))
