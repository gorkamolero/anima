"""Track visible actor height in the encoded frames against a clean scene render.
Occluded/clipped frames are reported separately; at least half must be measurable."""
import json,sys,pathlib
import cv2,numpy as np
from PIL import Image
from functools import lru_cache
ROOT=pathlib.Path('adventures/shadow-over-innsmouth/public/assets/sprites/hermes')
@lru_cache(None)
def silhouette(texture,frame):
 m=json.loads((ROOT/(texture+'.json')).read_text());im=Image.open(ROOT/(texture+'.png'));w,h=m['frameWidth'],m['frameHeight'];cols=im.width//w;alpha=np.array(im.crop(((frame%cols)*w,(frame//cols)*h,(frame%cols+1)*w,(frame//cols+1)*h)).getchannel('A'));ys,xs=np.nonzero(alpha>127)
 return (int(xs.min()),int(ys.min()),int(xs.max()+1),int(ys.max()+1),w,h)
@lru_cache(None)
def canonical_height():
 m=json.loads((ROOT/'hermes-fal-veo-transparent-loop.json').read_text());return float(np.median([silhouette('hermes-fal-veo-transparent-loop',i)[3]-silhouette('hermes-fal-veo-transparent-loop',i)[1] for i in range(len(m['contacts']))]))
def measure(frame,bg,row):
 x0,y0,x1,y1,w,h=silhouette(row['texture'],row['frame']);s=row['scale'];left=row['x']-w*s/2;top=row['y']-h*s
 if row['flip']:x0,x1=w-x1,w-x0
 box=(int(left+x0*s),int(top+y0*s),int(left+x1*s+1),int(top+y1*s+1));expected=(y1-y0)*s
 if box[1]<56 or box[0]<0 or box[2]>=1920 or box[3]>=1080:return dict(censored='screen clipping',expected=expected)
 # Censor from independently rendered occluder alpha, never from height error.
 if row.get('occluders'):
  from draworder import exact_overlap,meta
  for obj in row['occluders']:
   if row['depth']<obj['depth'] and exact_overlap(row,obj,meta(row['texture'])):
    return dict(censored='occluder overlap',expected=expected)
 ax,ay,bx,by=box;diff=np.max(np.abs(frame[ay:by,ax:bx].astype(np.int16)-bg[ay:by,ax:bx].astype(np.int16)),axis=2)>25
 counts=diff.sum(axis=1);ys=np.flatnonzero(counts>=max(2,(bx-ax)*.025))
 if not len(ys):return dict(censored='no distinguishable silhouette',expected=expected)
 actual=int(ys[-1]-ys[0]+1);error=abs(actual/expected-1)
 normalized=canonical_height()*s
 return dict(height=actual,expected=expected,relativeError=error,canonicalExpected=normalized,normalizedHeightError=abs(actual/normalized-1),box=box)
def summarize(out):
 measurable=sum('censored' not in q for q in out)
 bad=[i for i,q in enumerate(out) if 'censored' not in q and q['relativeError']>.03]
 return dict(pass_=bool(out) and measurable/len(out)>=.5 and not bad,flagged=bad,censored=len(out)-measurable,measurable=measurable,measurableFraction=measurable/len(out) if out else 0,rows=out)
def check(video,log,bgfile):
 rows=json.load(open(log));bg=cv2.imread(str(bgfile));cap=cv2.VideoCapture(str(video));out=[];bad=[]
 for i,r in enumerate(rows):
  ok,f=cap.read()
  if not ok:raise ValueError(f'missing video frame {i}')
  if not r.get('visible',True):out.append(dict(censored='invisible'));continue
  q=measure(f,bg,r);out.append(q)
  if 'censored' not in q and q['relativeError']>.03:bad.append(i)
 cap.release();return summarize(out)
if __name__=='__main__':
 if '--self-test' in sys.argv:
  silhouette=lambda *_:(0,0,40,100,40,100);canonical_height=lambda:100;bg=np.zeros((1080,1920,3),np.uint8);f=bg.copy();f[100:200,100:140]=255;r=dict(texture='synthetic',frame=0,scale=1,x=120,y=200,flip=False);assert measure(f,bg,r)['relativeError']<=.03;f[100:120,100:140]=0;assert measure(f,bg,r)['relativeError']>.03;assert summarize([dict(relativeError=0,normalizedHeightError=.2),dict(censored='occluder overlap')])['pass_'];assert not summarize([dict(relativeError=0),dict(censored='screen clipping'),dict(censored='invisible')])['pass_'];assert not summarize([dict(relativeError=.2),dict(censored='occluder overlap')])['pass_'];print('PASS: short silhouette rejected; censored correct walk accepted at 50%; insufficient coverage rejected; pose-height difference accepted')
 else:print(json.dumps(check(*sys.argv[1:4])))
