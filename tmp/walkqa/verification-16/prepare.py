import json,hashlib
from pathlib import Path
from PIL import Image
root=Path('tmp/walkqa/verification-16'); spr=Path('adventures/shadow-over-innsmouth/public/assets/sprites/hermes')
(root/'reviewer-tool-sha256.json').write_text(json.dumps({str(p):hashlib.sha256(p.read_bytes()).hexdigest() for p in Path('tmp/walkqa/tools').glob('*') if p.is_file()},indent=2))
records=[]
for heading,cycle,frame in [('side','hermes-fal-veo-transparent-loop',29),('away','hermes-walk-away',11),('away-right','hermes-walk-away-right',8),('toward','hermes-walk-toward',13),('toward-right','hermes-walk-toward-right',8)]:
 m=json.loads((spr/(cycle+'.json')).read_text()); w,h=m['frameWidth'],m['frameHeight']; x=frame%m['cols']*w;y=frame//m['cols']*h
 im=Image.open(spr/m['image']).convert('RGBA').crop((x,y,x+w,y+h));im.save(root/'sources'/f'{heading}-alpha.png'); bg=Image.new('RGBA',im.size,(128,128,128,255));bg.alpha_composite(im);bg.convert('RGB').save(root/'sources'/f'{heading}.png')
 records.append(dict(heading=heading,cycle=cycle,frame=frame,width=w,height=h,contact=m['contacts'][frame]))
(root/'sources.json').write_text(json.dumps(records,indent=2))
print(records)
