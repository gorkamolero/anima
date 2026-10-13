"""Locate exact off-floor/contact frames for crops, supplementing reviewer walkstats."""
import pathlib,json,sys,math
from functools import lru_cache
ROOT=pathlib.Path('adventures/shadow-over-innsmouth/public/assets/sprites/hermes')
@lru_cache(None)
def meta(t):return json.loads((ROOT/(t+'.json')).read_text())
def on(mask,x,y):
 ix,iy=math.floor(x*mask['width']/1920),math.floor(y*mask['height']/1080)
 return 0<=ix<mask['width'] and 0<=iy<mask['height'] and bool(mask['data'][iy*mask['width']+ix])
def check(rows,geometry,metadata=meta):
 off=[];contact=[];clearance=[];visible=0
 for i,r in enumerate(rows):
  if not r.get('visible',True):continue
  visible+=1;a=geometry.get('areas',{}).get(r.get('location'),geometry['area']);m=metadata(r['texture']);c=m['contacts'][r['frame']];f=r['contact'].get('planted',c['planted']);x=r['x']+(c[f]['x']-m['frameWidth']/2)*r['scale']*(-1 if r['flip'] else 1);y=r['y']+(c[f]['y']-m['frameHeight'])*r['scale']
  if not on(a.get('rawMask',a['mask']),x,y):off.append(i)
  if a.get('objectFootprints') and on(a['objectFootprints'],x,y):contact.append(i)
  if a.get('clearanceMask') and not on(a['clearanceMask'],r['x'],y):clearance.append(i)
 return dict(pass_=not off and not contact,flagged=sorted(set(off+contact+clearance)),clearancePass=not clearance,offFloor=off,objectContact=contact,bodyClearance=clearance,visibleFrames=visible)
if __name__=='__main__':
 if '--self-test' in sys.argv:
  a={'area':{'mask':dict(width=2,height=2,data=[0,0,1,1])}};m=dict(frameWidth=0,frameHeight=0,contacts=[dict(planted='L',L=dict(x=0,y=0))]);r=dict(x=500,y=700,scale=1,flip=False,frame=0,texture='',contact={});assert check([r],a,lambda _:m)['pass_'];r['y']=100;assert not check([r],a,lambda _:m)['pass_'];print('PASS: off-floor frame rejected')
 else:print(json.dumps(check(json.load(open(sys.argv[1])),json.load(open(sys.argv[2])))))
