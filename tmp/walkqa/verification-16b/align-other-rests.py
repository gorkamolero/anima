from pathlib import Path
import cv2,json,shutil
from PIL import Image
r=Path('tmp/walkqa/verification-16b');records=[]
for a in json.loads((r/'sources.json').read_text()):
 h=a['heading']
 if h=='away':continue
 pt=a['contact'][a['contact']['planted']];x=int(pt['x']);y=int(pt['y']);box=(max(0,x-24),max(0,y-55),min(612,x+24),min(1059,y+3));sx=max(0,box[0]-25);sy=max(0,box[1]-20);ex=min(612,box[2]+25);ey=min(1059,box[3]+20)
 first=cv2.imread(str(r/'sources'/f'{h}-first.png'),0);last=cv2.imread(str(r/'sources'/f'{h}-last.png'),0);t=first[box[1]:box[3],box[0]:box[2]];m=cv2.matchTemplate(last[sy:ey,sx:ex],t,cv2.TM_CCOEFF_NORMED);_,score,_,loc=cv2.minMaxLoc(m);dx=loc[0]+sx-box[0];dy=loc[1]+sy-box[1];records.append({'heading':h,'template':box,'displacement':[dx,dy],'score':score});print(records[-1])
 # Keep metadata placement when distinct drawings do not register reliably.
 if '--apply' in __import__('sys').argv and score>0.75 and abs(dx)<24 and abs(dy)<19:
  for suffix in ['', '-alpha']:
   p=r/'sources'/f'{h}-last{suffix}.png';shutil.copyfile(p,r/'sources'/f'{h}-last-metadata-aligned{suffix}.png');im=Image.open(p).convert('RGBA');im=im.transform(im.size,Image.Transform.AFFINE,(1,0,dx,0,1,dy),Image.Resampling.BICUBIC,fillcolor=(128,128,128,255) if not suffix else (0,0,0,0));im.save(p)
(r/'other-rest-registration.json').write_text(json.dumps(records,indent=2))
