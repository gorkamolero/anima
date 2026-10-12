"""Independent anchor segmentation-to-rendered-alpha coverage check."""
import pathlib,json,hashlib,subprocess
import numpy as np
from PIL import Image
root=pathlib.Path(__file__).resolve().parents[3];pub=root/'adventures/shadow-over-innsmouth/public/backgrounds';out=root/'tmp/walkqa/verification-07'
rows=[]
for stem in ['bus-station-kat-seated-composite-v1','arkham-bus-depot-flat-2d']:
 imagehash=hashlib.sha256((pub/(stem+'.png')).read_bytes()).hexdigest()
 labels=json.loads((pub/(stem+'.interactables.json')).read_text())['interactables']
 objects=json.loads((pub/(stem+'.occluders.json')).read_text())
 for o in objects:
  bounds=next(v['bounds'] for v in labels if v['name']==o['label'])
  key=hashlib.sha256((imagehash+':fal-ai/sam2/image:'+json.dumps(bounds,separators=(',',':'))).encode()).hexdigest()
  source=root/'api/data/perception'/(key+'.occlusion-mask.png')
  if not source.exists():rows.append({'scene':stem,'object':o['label'],'error':'reference unavailable'});continue
  raw=subprocess.check_output(['magick',str(source),'-resize','1920x1080!','-colorspace','gray','-threshold','50%','-depth','8','gray:-'])
  ref=np.frombuffer(raw,np.uint8).reshape(1080,1920)>127
  actual=np.zeros_like(ref);box=o['bbox'];x,y,w,h=[round(box[k]) for k in ['x','y','w','h']]
  alpha=np.array(Image.open(pub/o['png']).convert('RGBA').getchannel('A').resize((w,h)))>127
  actual[y:y+h,x:x+w]=alpha
  missing=int((ref & ~actual).sum());rows.append({'scene':stem,'object':o['label'],'reference':str(source.relative_to(root)),'referencePixels':int(ref.sum()),'missingPixels':missing,'coverage':float((ref&actual).sum()/max(1,ref.sum()))})
(out/'mask-coverage.json').write_text(json.dumps(rows,indent=2));print(json.dumps(rows,indent=2))
