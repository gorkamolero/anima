"""Independent perspective check. Nominal feet = sprite bottom origin, as engine API.
Also report physical planted-sole discrepancy rather than conceal it."""
import json,sys,math
import numpy as np

def prediction(area,x,y):
 p=area['perspective'];r=p.get('residual',[]);k=float(np.interp(x,[v['x'] for v in r],[v['k'] for v in r])) if r else 1
 s=p.get('constant',p['slope']*(y-p['horizonY']))*k
 return area['baseScale']*max(area['scaleClamp']['min'],min(area['scaleClamp']['max'],s))
def check(rows,geometry):
 bad=[];errors=[];sole=[]
 for i,r in enumerate(rows):
  if not r.get('visible',True):continue
  a=geometry.get('areas',{}).get(r.get('location'),geometry['area']);expected=prediction(a,r['x'],r['y']);e=abs(r['scale']/expected-1);errors.append(e)
  anchor=r.get('contact',{}).get('anchor');sole.append(abs(r['scale']/prediction(a,anchor['x'],anchor['y'])-1) if anchor else 0)
  if e>.01+1e-8:bad.append(i)
 return dict(pass_=not bad,flagged=bad,maxRelativeError=max(errors,default=0),maxPlantedSoleRelativeError=max(sole,default=0),threshold=.01)
if __name__=='__main__':
 if '--self-test' in sys.argv:
  a={'perspective':{'slope':.01,'horizonY':0},'baseScale':1,'scaleClamp':{'min':0,'max':10}};r={'x':0,'y':100,'scale':1};assert check([r],{'area':a})['pass_'];assert not check([{**r,'scale':1.2}],{'area':a})['pass_'];print('PASS: 20% scale corruption rejected')
 else:print(json.dumps(check(json.load(open(sys.argv[1])),json.load(open(sys.argv[2])))))
