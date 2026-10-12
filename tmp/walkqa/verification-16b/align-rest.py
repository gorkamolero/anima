"""Audit support-boot translation between supplied endpoints, without changing the art."""
from pathlib import Path
import cv2,numpy as np,json,shutil
from PIL import Image
r=Path('tmp/walkqa/verification-16b');h='away'
# Freeze exact inputs for submitted jobs before refining source registration.
for d in r.iterdir():
 if (d/'input.json').exists():
  inp=json.loads((d/'input.json').read_text())
  for k,v in inp.items():
   if k.endswith('_url') and v.startswith('../sources/'):
    dest=d/Path(v).name
    if not dest.exists():shutil.copyfile(d/v,dest)
    inp[k]=dest.name
  (d/'input.json').write_text(json.dumps(inp,indent=2))
a=cv2.imread(str(r/'sources'/f'{h}-first.png'),0);b=cv2.imread(str(r/'sources'/f'{h}-last.png'),0)
t=a[929:983,246:294];score=cv2.matchTemplate(b[909:1003,226:324],t,cv2.TM_CCOEFF_NORMED);_,match,_,loc=cv2.minMaxLoc(score);dx,dy=loc[0]-20,loc[1]-20
record={'heading':h,'sourceTemplate':[246,929,294,983],'restBootDisplacement':[dx,dy],'score':match,'correction':[-dx,-dy]}
(r/'rest-boot-registration.json').write_text(json.dumps(record,indent=2));print(record)
if '--apply' in __import__('sys').argv:
 for suffix in ['', '-alpha']:
  p=r/'sources'/f'{h}-last{suffix}.png';shutil.copyfile(p,r/'sources'/f'{h}-last-metadata-aligned{suffix}.png')
  im=Image.open(p).convert('RGBA');im=im.transform(im.size,Image.Transform.AFFINE,(1,0,dx,0,1,dy),Image.Resampling.BICUBIC,fillcolor=(128,128,128,255) if not suffix else (0,0,0,0));im.save(p)
