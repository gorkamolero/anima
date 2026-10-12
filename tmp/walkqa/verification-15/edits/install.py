import json,shutil,importlib.util
from pathlib import Path
import numpy as np
from PIL import Image,ImageDraw
from scipy.optimize import minimize
from scipy.ndimage import affine_transform
S=Path('adventures/shadow-over-innsmouth/public/assets/sprites/hermes'); E=Path('tmp/walkqa/verification-15/edits')
spec=importlib.util.spec_from_file_location('tracking','packages/sprite-tools/scripts/root-motion.py');t=importlib.util.module_from_spec(spec);spec.loader.exec_module(t)
raws={'away-right':'exec-ffe6dbe6-5cad-4afd-8960-01bed540022c.png','toward-right':'exec-972fcd73-f30b-4438-8f06-d8599579ff39.png'}
records=[]
for d,file in raws.items():
 shutil.copy(Path('/Users/gorkolas/.codex/generated_images/01a13110-e1c0-7af0-ba36-3af690478d07')/file,E/(d+'-1.png'))
 shutil.copy(Path('tmp/walkqa/verification-14/edits')/(d+'-source.png'),E/(d+'-source.png'))
 src=Image.open(E/(d+'-source.png')).convert('RGBA');raw=Image.open(E/(d+'-1.png')).convert('RGBA');base=raw.resize(src.size,Image.Resampling.LANCZOS)
 # Fit one uniform transform to the whole silhouette; never warp separate parts.
 a=np.array(src.getchannel('A').resize((306,530)))/255.;b=np.array(base.getchannel('A').resize((306,530)))/255.
 def loss(v):
  k,x,y=v; bb=affine_transform(b,np.eye(2)/k,offset=[-y/k,-x/k],output_shape=a.shape,order=1);return np.mean((a-bb)**2)
 fit=minimize(loss,[1.02,0,0],method='Powell',bounds=[(.98,1.06),(-15,15),(-15,15)],options={'xtol':1e-5});k,x,y=fit.x;x*=2;y*=src.height/530
 dst=base.transform(src.size,Image.Transform.AFFINE,(1/k,0,-x/k,0,1/k,-y/k),Image.Resampling.BICUBIC);dst.save(E/(d+'-registered.png'))
 name='hermes-passing-stand-'+d;meta=json.loads((S/(name+'.json')).read_text());walk=json.loads((S/('hermes-walk-'+d+'.json')).read_text());contact=walk['contacts'][8];foot=contact['planted'];free='R' if foot=='L' else 'L';q=contact[foot]
 reg=t.register(np.array(src),np.array(dst),[round(q['x']-45),round(q['y']-55),round(q['x']+45),min(src.height,round(q['y']+15))],radius=35,masked=True)
 fq=walk['reviewedFreeBootSoles']['8'][free];fr=t.register(np.array(src),np.array(dst),[round(fq['x']-35),round(fq['y']-50),round(fq['x']+35),min(src.height,round(fq['y']+15))],radius=35,masked=True)
 sole={foot:{'x':q['x']+reg['dx'],'y':q['y']+reg['dy']},free:{'x':fq['x']+fr['dx'],'y':fq['y']+fr['dy']}}
 meta['contacts']=[{**sole,'planted':foot}];meta['bootSoles']=[sole];rec={'direction':d,'reference':'hermes-walk-'+d,'sourceFrame':8,'editAttempt':1,'uniformScale':float(k),'translation':[float(x),float(y)],'plantedBootRegistration':reg,'freeBootRegistration':fr,'method':'single whole-image uniform scale and translation, generated alpha preserved'};meta['normalization']=rec;records.append(rec)
 dst.save(S/(name+'.png'));(S/(name+'.json')).write_text(json.dumps(meta,indent='\t')+'\n')
 out=Image.new('RGBA',(src.width*3,src.height),'#828282')
 for i,im in enumerate([src,dst,Image.blend(src,dst,.5)]):out.alpha_composite(im,(src.width*i,0))
 out.convert('RGB').save(E/(d+'-review.png'))
(E/'normalization.json').write_text(json.dumps(records,indent=2)+'\n')
print(json.dumps(records,indent=2))
