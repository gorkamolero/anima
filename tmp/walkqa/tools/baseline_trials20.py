"""Build two isolated baseline repair trials; never change stored geometry."""
import json,pathlib,numpy as np
from PIL import Image
root=pathlib.Path('tmp/walkqa/harness-20');catalog=json.loads((root/'occluder-catalog.json').read_text());public=pathlib.Path('adventures/shadow-over-innsmouth/public')
for mode in ['baseline-linear','baseline-silhouette']:
 result={}
 for scene,objects in catalog.items():
  result[scene]={}
  for o in objects:
   b=o['bbox'];ps=o['baseline']
   if not ps:continue
   if mode=='baseline-linear':
    x=np.array([p['x'] for p in ps]);y=np.array([p['y'] for p in ps]);slope,intercept=np.polyfit(x,y,1) if len(set(x))>1 else (0,y[0]);points=[{'x':v,'y':float(np.clip(slope*v+intercept,b['y'],b['y']+b['h']))} for v in [b['x'],b['x']+b['w']]]
   else:
    file=next(p for p in [public/'backgrounds'/o['png'],public/'generated'/o['png']] if p.exists());im=Image.open(file);a=np.array(im.getchannel('A'));points=[]
    for x in range(0,a.shape[1],max(1,a.shape[1]//48)):
     ys=np.nonzero(a[:,x]>127)[0]
     if len(ys):points.append({'x':b['x']+(x+.5)*b['w']/a.shape[1],'y':b['y']+(int(ys[-1])+1)*b['h']/a.shape[0]})
   result[scene][o['id']]=points
 out=root/'experiments'/mode;out.mkdir(parents=True,exist_ok=True);(out/'baseline-overrides.json').write_text(json.dumps(result));print(mode)
