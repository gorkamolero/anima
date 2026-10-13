"""Independent visibility graph over exact raster-cell polygons (no simplified walls)."""
import json,sys,math
import numpy as np
import shapely
from shapely.geometry import box,Point,LineString
from shapely.ops import unary_union, transform
from scipy.sparse import csr_matrix
from scipy.sparse.csgraph import dijkstra

def polygon(mask):
 a=np.array(mask['data']).reshape(mask['height'],mask['width'])>0;sx=1920/mask['width'];sy=1080/mask['height'];rect=[]
 for y,row in enumerate(a):
  edges=np.diff(np.r_[False,row,False].astype(int));starts=np.flatnonzero(edges==1);ends=np.flatnonzero(edges==-1)
  rect.extend(box(l*sx,y*sy,r*sx,(y+1)*sy) for l,r in zip(starts,ends))
 return unary_union(rect)
def norm(delta,octilinear=False):
 a=np.abs(delta)
 return np.max(a,axis=-1)+(math.sqrt(2)-1)*np.min(a,axis=-1) if octilinear else np.linalg.norm(a,axis=-1)
def optimum(poly,start,end,octilinear=False):
 if not poly.covers(Point(start)) or not poly.covers(Point(end)):return None
 if poly.covers(LineString([start,end])):return float(norm(np.subtract(start,end),octilinear))
 parts=list(poly.geoms) if poly.geom_type=='MultiPolygon' else [poly];p=next((p for p in parts if p.covers(Point(start))),None)
 if p is None or not p.covers(Point(end)):return None
 coords=[]
 for ring in [p.exterior,*p.interiors]:
  vs=list(ring.coords)[:-1]
  for j,b in enumerate(vs):
   a=vs[j-1];c=vs[(j+1)%len(vs)];cross=(b[0]-a[0])*(c[1]-b[1])-(b[1]-a[1])*(c[0]-b[0])
   if cross:coords.append(b)
 points=np.array([start,end,*coords]);n=len(points);ri,ci=np.triu_indices(n,1);lines=shapely.linestrings(np.stack([points[ri],points[ci]],axis=1));ok=shapely.covers(p,lines);ri,ci=ri[ok],ci[ok];dist=norm(points[ri]-points[ci],octilinear);graph=csr_matrix((np.r_[dist,dist],(np.r_[ri,ci],np.r_[ci,ri])),shape=(n,n));return float(dijkstra(graph,indices=0)[1])
def ground(p,point):
 x,y=point
 if p.get('constant') is not None:return (x/300,-y/300)
 z=1/(p['slope']*(y-p['horizonY']));ppm=p.get('pixelsPerMetre',300)
 return ((x-p.get('cx',960))*z/ppm,z*p.get('focalLength',1000)/ppm)
def check(rows,event,geometry):
 pts=[(p['x'],p['y']) for p in event['setup']['preview']];start=event['setup']['start'];pts=[(start['x'],start['y']),*pts]
 if len(pts)<2:return dict(pass_=False,reason='No planned route',flagged=[])
 screen=polygon(geometry['area']['mask']);perspective=geometry['area'].get('perspective',{'constant':1})
 poly=transform(lambda x,y,z=None:ground(perspective,(np.asarray(x),np.asarray(y))),screen)
 gp=[ground(perspective,p) for p in pts]
 euclidean=optimum(poly,gp[0],gp[-1]);opt=optimum(poly,gp[0],gp[-1],True)
 length=sum(float(norm(np.subtract(a,b),True)) for a,b in zip(gp,gp[1:]))
 walls=[i for i,(a,b) in enumerate(zip(pts,pts[1:])) if a!=b and not screen.covers(LineString([a,b]))]
 live=0;livewalls=[]
 for i,(a,b) in enumerate(zip(rows,rows[1:])):
  if a.get('location')!=b.get('location') or not(a['walking'] and b['walking']):continue
  pa=(a['x'],a['y']);pb=(b['x'],b['y'])
  live+=math.dist(ground(perspective,pa),ground(perspective,pb))
  if pa!=pb and not screen.covers(LineString([pa,pb])):livewalls.append(i)
 ratio=live/opt if opt and opt>0 else None
 return dict(pass_=bool(ratio is not None and ratio<=1.05 and not walls and not livewalls),plannedLength=length,visibilityOptimum=opt,octilinearOptimum=opt,euclideanOptimum=euclidean,ratio=ratio,actualBodyLength=live,actualRatio=ratio,wallSegments=walls,actualWallFrames=livewalls,flagged=livewalls,units='ground metres',clearance='exact raster polygon; octilinear norm visibility geodesic (infimum at non-octilinear boundaries)')
if __name__=='__main__':
 if '--self-test' in sys.argv:
  assert math.isclose(optimum(box(0,0,100,100),(10,10),(90,40),True),80+(math.sqrt(2)-1)*30);poly=box(0,0,100,100).difference(box(40,0,60,70));o=optimum(poly,(10,10),(90,10));assert o>80;assert not poly.covers(LineString([(10,10),(90,10)]));assert math.isclose(optimum(box(0,0,100,100),(10,10),(90,10)),80);m=dict(width=4,height=4,data=[1,0,0,1]*3+[1,1,1,1]);e=dict(setup=dict(start=dict(x=240,y=135),preview=[dict(x=1680,y=135)]));assert not check([],e,{'area':{'mask':m}})['pass_'];print('PASS: doctored route through wall rejected by checker')
 else:print(json.dumps(check(*[json.load(open(p)) for p in sys.argv[1:4]])))
