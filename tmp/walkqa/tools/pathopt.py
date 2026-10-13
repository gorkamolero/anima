"""Independent visibility graph over exact raster-cell polygons (no simplified walls)."""
import json,sys,math
import numpy as np
import shapely
from shapely.geometry import box,Point,LineString
from shapely.ops import unary_union
from scipy.sparse import csr_matrix
from scipy.sparse.csgraph import dijkstra

def polygon(mask):
 a=np.array(mask['data']).reshape(mask['height'],mask['width'])>0;sx=1920/mask['width'];sy=1080/mask['height'];rect=[]
 for y,row in enumerate(a):
  edges=np.diff(np.r_[False,row,False].astype(int));starts=np.flatnonzero(edges==1);ends=np.flatnonzero(edges==-1)
  rect.extend(box(l*sx,y*sy,r*sx,(y+1)*sy) for l,r in zip(starts,ends))
 return unary_union(rect)
def optimum(poly,start,end):
 if not poly.covers(Point(start)) or not poly.covers(Point(end)):return None
 if poly.covers(LineString([start,end])):return math.dist(start,end)
 parts=list(poly.geoms) if poly.geom_type=='MultiPolygon' else [poly];p=next((p for p in parts if p.covers(Point(start))),None)
 if p is None or not p.covers(Point(end)):return None
 coords=[]
 for ring in [p.exterior,*p.interiors]:
  vs=list(ring.coords)[:-1]
  for j,b in enumerate(vs):
   a=vs[j-1];c=vs[(j+1)%len(vs)];cross=(b[0]-a[0])*(c[1]-b[1])-(b[1]-a[1])*(c[0]-b[0])
   if cross:coords.append(b)
 points=np.array([start,end,*coords]);n=len(points);ri,ci=np.triu_indices(n,1);lines=shapely.linestrings(np.stack([points[ri],points[ci]],axis=1));ok=shapely.covers(p,lines);ri,ci=ri[ok],ci[ok];dist=np.linalg.norm(points[ri]-points[ci],axis=1);graph=csr_matrix((np.r_[dist,dist],(np.r_[ri,ci],np.r_[ci,ri])),shape=(n,n));return float(dijkstra(graph,indices=0)[1])
def check(rows,event,geometry):
 pts=[(p['x'],p['y']) for p in event['setup']['preview']];start=event['setup']['start'];pts=[(start['x'],start['y']),*pts]
 if len(pts)<2:return dict(pass_=False,reason='No planned route',flagged=[])
 poly=polygon(geometry['area']['mask']);opt=optimum(poly,pts[0],pts[-1]);length=sum(math.dist(a,b) for a,b in zip(pts,pts[1:]));walls=[i for i,(a,b) in enumerate(zip(pts,pts[1:])) if a!=b and not poly.covers(LineString([a,b]))]
 live=sum(math.hypot(b['x']-a['x'],b['y']-a['y']) for a,b in zip(rows,rows[1:]) if a.get('location')==b.get('location') and a['walking'] and b['walking'])
 ratio=length/opt if opt and opt>0 else None
 return dict(pass_=bool(ratio is not None and ratio<=1.05 and not walls),plannedLength=length,visibilityOptimum=opt,ratio=ratio,actualBodyLength=live,actualRatio=live/opt if opt else None,wallSegments=walls,flagged=[],clearance='route checked on independently polygonized eroded walk area')
if __name__=='__main__':
 if '--self-test' in sys.argv:
  poly=box(0,0,100,100).difference(box(40,0,60,70));o=optimum(poly,(10,10),(90,10));assert o>80;assert not poly.covers(LineString([(10,10),(90,10)]));assert math.isclose(optimum(box(0,0,100,100),(10,10),(90,10)),80);m=dict(width=4,height=4,data=[1,0,0,1]*3+[1,1,1,1]);e=dict(setup=dict(start=dict(x=240,y=135),preview=[dict(x=1680,y=135)]));assert not check([],e,{'area':{'mask':m}})['pass_'];print('PASS: doctored route through wall rejected by checker')
 else:print(json.dumps(check(*[json.load(open(p)) for p in sys.argv[1:4]])))
