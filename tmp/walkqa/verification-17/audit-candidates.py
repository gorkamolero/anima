import json,hashlib,subprocess,importlib.util
from pathlib import Path
import cv2,numpy as np
from PIL import Image
from scipy import ndimage as ndi
r=Path('tmp/walkqa/verification-17');records=[]
for d in [r/h for h in ['side','away','away-right','toward','toward-right']]:
 m=json.loads((d/'candidate.json').read_text());q=m['contact'][m['contact']['planted']];x,y=round(q['x']),round(q['y']);a=np.array(Image.open(d/'first.png').convert('L'));box=[x-24,y-50,x+24,y+3];template=a[box[1]:box[3],box[0]:box[2]];frames=[]
 for i in range(9):
  im=Image.open(d/f'frame-{i:02}.png').convert('RGBA');bg=Image.new('RGBA',im.size,(128,128,128,255));bg.alpha_composite(im);gray=np.array(bg.convert('L'));sx=max(0,box[0]-30);sy=max(0,box[1]-30);search=gray[sy:min(im.height,box[3]+30),sx:box[2]+30];res=cv2.matchTemplate(search,template,cv2.TM_CCOEFF_NORMED);_,score,_,pos=cv2.minMaxLoc(res);shift=[pos[0]+sx-box[0],pos[1]+sy-box[1]]
  alpha=np.array(im)[:,:,3];interior=ndi.binary_erosion(alpha>127,iterations=3);frames.append({'frame':i,'bootTemplateShift':shift,'correlation':score,'nonOpaqueInteriorPixels':int(((alpha<255)&interior).sum())})
 records.append({'heading':d.name,'frames':frames,'note':'Raw pixel diagnostic, not runtime lockcheck; template can change appearance and is not an anatomical tracker.'})
 for variant in ['', 'rigid']:
  dest=d/variant
  for start in [0,3,6]:
   out=Image.new('RGB',(2400,1260),'#808080')
   for j,i in enumerate(range(start,start+3)):
    im=Image.open(dest/f'frame-{i:02}.png').convert('RGBA');bg=Image.new('RGBA',im.size,(128,128,128,255));bg.alpha_composite(im);out.paste(bg.crop((120,0,520,620)).resize((800,1240),Image.Resampling.NEAREST),(j*800,20))
   out.save(dest/f'upper-{start}-{start+2}-2x.png')
(r/'pixel-audit.json').write_text(json.dumps(records,indent=2));print(json.dumps([{'heading':x['heading'],'maxTemplateShift':max(float(np.linalg.norm(y['bootTemplateShift'])) for y in x['frames']),'nonOpaqueInteriorPixels':[y['nonOpaqueInteriorPixels'] for y in x['frames']]} for x in records],indent=2))
