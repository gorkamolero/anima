import json,hashlib,subprocess
from pathlib import Path
from PIL import Image
import numpy as np,cv2
O=Path('tmp/walkqa/verification-19');S=Path('adventures/shadow-over-innsmouth/public/assets/sprites/hermes');result={}
a=np.array(Image.open(O/'frame-1.png'));b=np.array(Image.open(O/'frame-2.png'))
result['plantedSoleInteriorIdentical']=bool(np.array_equal(a[997:1008,340:399],b[997:1008,340:399]))
result['soleContourYDeltaSourcePx']=[int(np.where(b[:,x,3]>127)[0].max())-int(np.where(a[:,x,3]>127)[0].max()) for x in range(350,370)]
result['assetAlpha']=[]
for i in range(3):
 arr=np.array(Image.open(O/f'frame-{i}.png'));inside=cv2.erode((arr[:,:,3]>127).astype('uint8'),np.ones((7,7),np.uint8))>0
 result['assetAlpha'].append({'frame':i,'nonopaqueInterior':int(((arr[:,:,3]<255)&inside).sum())})
result['preserved']={}
for p in sorted(S.glob('hermes-passing-stand-*')):
 if '-side.' in p.name:continue
 old=subprocess.check_output(['git','show','HEAD:'+str(p)])
 result['preserved'][p.name]=old==p.read_bytes()
result['exitExact']=bool(np.array_equal(np.array(Image.open(O/'frame-0.png')),np.array(Image.open('tmp/walkqa/verification-16b/sources/side-first-alpha.png'))))
import importlib.util
sp=importlib.util.spec_from_file_location('key','packages/sprite-tools/scripts/matched-standing.py');k=importlib.util.module_from_spec(sp);sp.loader.exec_module(k)
pre=np.array(k.key(Image.open(O/'B1-registered.png')))
result['beforeRepairSoleContourYDeltaSourcePx']=[int(np.where(pre[:,x,3]>127)[0].max())-int(np.where(a[:,x,3]>127)[0].max()) for x in range(350,370)]
(O/'asset-audit.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result,indent=2))
