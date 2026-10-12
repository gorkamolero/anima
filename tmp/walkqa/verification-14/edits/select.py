import json
from pathlib import Path
from PIL import Image
SPR=Path('adventures/shadow-over-innsmouth/public/assets/sprites/hermes');OUT=Path('tmp/walkqa/verification-14/edits')
choices={'side':('hermes-fal-veo-transparent-loop',29),'away':('hermes-walk-away',11),'away-right':('hermes-walk-away-right',8),'toward':('hermes-walk-toward',13),'toward-right':('hermes-walk-toward-right',8)}
for d,(n,i) in choices.items():
 m=json.loads((SPR/(n+'.json')).read_text());w,h=m['frameWidth'],m['frameHeight'];im=Image.open(SPR/m['image']).convert('RGBA').crop((i%m['cols']*w,i//m['cols']*h,(i%m['cols']+1)*w,(i//m['cols']+1)*h));im.save(OUT/(d+'-source.png'));bg=Image.new('RGBA',im.size,'#828282');bg.alpha_composite(im);bg.convert('RGB').save(OUT/(d+'-input.png'))
(OUT/'selection.json').write_text(json.dumps(choices,indent=2)+'\n')
