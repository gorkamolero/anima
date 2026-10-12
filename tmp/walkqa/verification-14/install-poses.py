import json,importlib.util
from pathlib import Path
import numpy as np
from PIL import Image,ImageDraw
ROOT=Path.cwd();S=ROOT/'adventures/shadow-over-innsmouth/public/assets/sprites/hermes';O=ROOT/'tmp/walkqa/verification-14';E=O/'edits'
spec=importlib.util.spec_from_file_location('tracking',ROOT/'packages/sprite-tools/scripts/root-motion.py');t=importlib.util.module_from_spec(spec);spec.loader.exec_module(t)
# Physical free-boot sole landmarks reviewed on the source sprites, not the
# unreliable swing-foot tracker. These annotations never drive the foot lock.
free={'side':{11:[280,992],28:[300,1027],29:[265,1030]},'away':{0:[261,946],1:[261,946],11:[353,992],12:[353,992]},'away-right':{8:[297,972],9:[360,965],21:[339,969],29:[280,978],30:[323,974],44:[381,965]},'toward':{0:[336,990],12:[264,965],13:[255,997],24:[351,948]},'toward-right':{7:[228,1000],8:[237,996],19:[360,993]}}
# Same sole landmark on the new still; explicit and independent of motor contacts.
soles={'side':{'L':[260,1005],'R':[365,1000]},'away':{'L':[289,970],'R':[369,971]},'away-right':{'L':[271,1008],'R':[345,1000]},'toward':{'L':[323,969],'R':[249,970]},'toward-right':{'L':[315,998],'R':[247,974]}}
old_offsets={'side':[7,3],'away':[7,4],'away-right':[7,4],'toward':[6,3],'toward-right':[11,4]}
normal=json.loads((E/'normalization.json').read_text());candidates=json.loads((O/'passing-candidates.json').read_text());review={}
for rec in normal:
 d=rec['direction']
 for f,xy in soles[d].items():
  soles[d][f]=[round((xy[k]-old_offsets[d][k])*rec['uniformScale']+rec['translation'][k],2) for k in range(2)]
 walk=rec['reference'];frame=rec['sourceFrame'];m=json.loads((S/(walk+'.json')).read_text());src=np.array(Image.open(E/f'{d}-source.png').convert('RGBA'));im=Image.open(E/f'{d}-registered.png').convert('RGBA');dst=np.array(im);c=m['contacts'][frame];f=c['planted'];q=c[f]
 reg=t.register(src,dst,[max(0,round(q['x']-45)),max(0,round(q['y']-55)),min(im.width,round(q['x']+45)),min(im.height,round(q['y']+15))],radius=70,masked=True)
 # Preserve the tracked within-shoe point on the same physical planted boot.
 contacts={f:{'x':q['x']+reg['dx'],'y':q['y']+reg['dy']},'planted':f}
 other='R' if f=='L' else 'L';contacts[other]={'x':soles[d][other][0],'y':soles[d][other][1]-6}
 name='hermes-passing-stand-'+d;im.save(S/(name+'.png'));meta={'name':name,'image':name+'.png','frameWidth':im.width,'frameHeight':im.height,'frameCount':1,'cols':1,'rows':1,'fps':24,'contacts':[contacts],'switchFrames':[],'bootSoles':[{k:dict(zip(['x','y'],v)) for k,v in soles[d].items()}],'normalization':{**rec,'plantedBootRegistration':reg,'retired':'hermes-matched-stand-'+d}}
 (S/(name+'.json')).write_text(json.dumps(meta,indent=2)+'\n')
 reviewed={}
 for i,xy in free[d].items():
  foot=m['contacts'][i]['planted'];other='R' if foot=='L' else 'L';reviewed[str(i)]={other:dict(zip(['x','y'],xy))}
 m['reviewedPassingFrames']=candidates[d][1];m['reviewedFreeBootSoles']=reviewed;(S/(walk+'.json')).write_text(json.dumps(m,indent=2)+'\n');review[d]={'runtimeContacts':contacts,'bootSoles':meta['bootSoles'],'sourceFrame':frame,'plantedRegistration':reg}
 bg=Image.new('RGBA',im.size,'#828282');bg.alpha_composite(im);dd=ImageDraw.Draw(bg)
 for k in ['L','R']:
  x,y=contacts[k]['x'],contacts[k]['y'];dd.ellipse((x-4,y-4,x+4,y+4),fill='cyan' if k=='L' else 'yellow');dd.text((x+7,y-16),k,fill='white')
 bg.crop((100,800,500,1059)).resize((800,518)).save(E/f'{d}-runtime-contacts-2x.png')
(O/'boot-landmarks.json').write_text(json.dumps(review,indent=2)+'\n')
