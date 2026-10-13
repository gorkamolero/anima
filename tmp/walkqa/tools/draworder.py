"""Depth/baseline consistency where sprite and occluder bounds overlap.
Exact alpha intersection follows a bounding-box broad phase; NPC sprites are included."""
import json,sys,math,pathlib,os
from functools import lru_cache
import numpy as np
from PIL import Image
SPR=pathlib.Path('adventures/shadow-over-innsmouth/public/assets/sprites/hermes')
PUBLIC=SPR.parents[2]
CATALOG_FILE=pathlib.Path(os.environ.get('WALKQA_ROOT','tmp/walkqa/harness-20'))/'occluder-catalog.json'
CATALOG=json.loads(CATALOG_FILE.read_text()) if CATALOG_FILE.exists() else {}
@lru_cache(None)
def alpha(texture,frame):
 m=meta(texture);im=Image.open(SPR/(texture+'.png'));w,h=m['frameWidth'],m['frameHeight'];cols=im.width//w
 return np.array(im.crop(((frame%cols)*w,(frame//cols)*h,(frame%cols+1)*w,(frame//cols+1)*h)).getchannel('A'))
@lru_cache(None)
def objectalpha(filename):
 files=[PUBLIC/'backgrounds'/filename,PUBLIC/'generated'/filename]
 file=next((p for p in files if p.exists()),None)
 if not file:raise ValueError('Occluder raster missing: '+filename)
 return np.array(Image.open(file).getchannel('A'))
@lru_cache(None)
def npc_alpha(spec):
 o=json.loads(spec);im=Image.open(SPR.parent/'kat'/(o['texture']+'.png'));x,y=o['cutX'],o['cutY'];a=np.array(im.crop((x,y,x+o['width'],y+o['height'])).getchannel('A'))
 return a[:,::-1] if o.get('flip') else a
def exact_overlap(row,obj,m):
 entry=next((o for o in CATALOG.get(row.get('location'),[]) if o['id']==obj['id']),None)
 if entry is None and not obj.get('sprite'):return None
 b=obj['bounds'];s=row['scale'];left=row['x']-m['frameWidth']*s/2;top=row['y']-m['frameHeight']*s
 x0=max(0,int(np.ceil(max(left,b['x']))));x1=min(1920,int(np.ceil(min(left+m['frameWidth']*s,b['x']+b['width']))));y0=max(0,int(np.ceil(max(top,b['y']))));y1=min(1080,int(np.ceil(min(row['y'],b['y']+b['height']))))
 if x1<=x0 or y1<=y0:return False
 xs=np.arange(x0,x1)+.5;ys=np.arange(y0,y1)+.5;sa=alpha(row['texture'],row['frame']);oa=npc_alpha(json.dumps(obj['sprite'],sort_keys=True)) if obj.get('sprite') else objectalpha(entry['png']);sx=np.clip(((xs-left)/s).astype(int),0,sa.shape[1]-1);sy=np.clip(((ys-top)/s).astype(int),0,sa.shape[0]-1)
 if row['flip']:sx=sa.shape[1]-1-sx
 ox=np.clip(((xs-b['x'])*oa.shape[1]/b['width']).astype(int),0,oa.shape[1]-1);oy=np.clip(((ys-b['y'])*oa.shape[0]/b['height']).astype(int),0,oa.shape[0]-1)
 return bool(((sa[sy[:,None],sx]>0)&(oa[oy[:,None],ox]>0)).any())

@lru_cache(None)
def meta(t):return json.loads((SPR/(t+'.json')).read_text())
def baseline(points,x):
 pts=sorted(points,key=lambda p:p['x'])
 if x<=pts[0]['x']:return pts[0]['y']
 for a,b in zip(pts,pts[1:]):
  if x<=b['x']:return a['y']+(b['y']-a['y'])*(x-a['x'])/max(1e-9,b['x']-a['x'])
 return pts[-1]['y']
def check(rows,metadata=meta):
 bad=[];crossings=[];count=0;previous={};fallback=0
 for i,r in enumerate(rows):
  if not r.get('visible',True):continue
  m=metadata(r['texture']);w=m['frameWidth']*r['scale'];h=m['frameHeight']*r['scale'];x,y=r['contact']['anchor'].values()
  for o in r.get('occluders',[]):
   b=o['bounds'];pts=o.get('baseline',[])
   if not pts:continue
   overlaps=r['x']+w/2>b['x'] and r['x']-w/2<b['x']+b['width'] and r['y']>b['y'] and r['y']-h<b['y']+b['height']
   if overlaps:
    exact=exact_overlap(r,o,m)
    if exact is None:fallback+=1
    else:overlaps=exact
   behind=not o.get("floorDecal",False) and y<baseline(pts,x);key=(r.get('location'),o['id'])
   if overlaps:
    count+=1
    if behind!=(r['depth']<o['depth']):bad.append(dict(frame=i,occluder=o['id'],feet=[x,y],baseline=baseline(pts,x)))
    if key in previous and previous[key]!=behind:crossings.append(dict(frame=i,occluder=o['id']))
   previous[key]=behind
 return dict(pass_=not bad,flagged=bad,overlapFrames=count,crossings=crossings,overlapMethod='screen pixel intersection of sprite and occluder alpha masks',bboxFallbackFrames=fallback)
if __name__=='__main__':
 if '--self-test' in sys.argv:
  r=dict(texture='test',scale=1,x=50,y=100,contact={'anchor':{'x':50,'y':100}},depth=2,occluders=[dict(id='box',depth=3,bounds=dict(x=0,y=0,width=100,height=200),baseline=[dict(x=0,y=120),dict(x=100,y=120)])]);assert check([r],lambda t:dict(frameWidth=100,frameHeight=200))['pass_'];r['depth']=4;assert not check([r],lambda t:dict(frameWidth=100,frameHeight=200))['pass_'];r['occluders'][0]['floorDecal']=True;assert check([r],lambda t:dict(frameWidth=100,frameHeight=200))['pass_'];r['depth']=2;assert not check([r],lambda t:dict(frameWidth=100,frameHeight=200))['pass_'];print('PASS: inverted depth and raised floor decal rejected')
 else:print(json.dumps(check(json.load(open(sys.argv[1])))))
