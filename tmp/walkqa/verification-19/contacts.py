from pathlib import Path
import copy,json
from PIL import Image,ImageDraw
O=Path('tmp/walkqa/verification-19');m=json.loads(Path('adventures/shadow-over-innsmouth/public/assets/sprites/hermes/hermes-passing-stand-side.json').read_text())
for mirror in [False,True]:
 suffix='-mirrored' if mirror else '';contacts=copy.deepcopy(list(reversed(m['contacts'])))
 if mirror:
  for c in contacts:
   for f in ['L','R']:c[f]['x']=611-c[f]['x']
 meta=dict(name='side-settle'+suffix,image='stop-sheet'+suffix+'.png',frameWidth=612,frameHeight=1059,frameCount=3,cols=3,rows=1,fps=24,contacts=contacts,settleFrames=[0,1,2],holdTicks=2)
 (O/('stop-sheet'+suffix+'.json')).write_text(json.dumps(meta,indent=2)+'\n')
 im=Image.open(O/('review'+suffix+'.png'));d=ImageDraw.Draw(im)
 for i,c in enumerate(contacts):
  for f in ['L','R']:
   x=c[f]['x']+612*i;y=c[f]['y']+35;d.ellipse((x-3,y-3,x+3,y+3),fill='cyan' if f==c['planted'] else 'yellow')
 im.save(O/('contacts'+suffix+'.png'))
