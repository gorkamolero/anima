import json,importlib.util
from pathlib import Path
import numpy as np
from PIL import Image
root=Path.cwd();d=root/'tmp/hermes-depth-06';spec=importlib.util.spec_from_file_location('factory',root/'packages/sprite-tools/scripts/sprite-factory.py');factory=importlib.util.module_from_spec(spec);spec.loader.exec_module(factory)
frames=sorted((d/'away/source').glob('*.png'))
for i,f in enumerate(frames):
 a=np.array(Image.open(f).convert('RGB'));bg=tuple(np.median(np.concatenate([a[:,:50].reshape(-1,3),a[:,-50:].reshape(-1,3)]),axis=0));factory.chroma_key_frame(f,d/'away/raw'/f'frame-{i:03d}.png',bg,22,90,38)
# Search a seam over full gait cycles as in the existing extraction script.
a=[]
for f in sorted((d/'away/raw').glob('*.png')):
 ar=np.array(Image.open(f).convert('RGBA').resize((90,160)),dtype=float)/255;a.append(np.concatenate([ar[:,:,:3]*ar[:,:,3:],ar[:,:,3:]],axis=2))
a=np.array(a);scores=[]
for start in range(30,len(a)-20):
 for length in range(20,49):
  end=start+length
  if end+2>=len(a):continue
  scores.append((float(sum(np.mean((a[start+k,60:]-a[end+k,60:])**2) for k in [-1,0,1])/3),start,end))
score,start,end=min(scores);m={'method':'local-frame-similarity','start_frame':start,'end_frame':end,'frame_count':end-start,'fps':24,'seam_mse':score,'candidates':sorted(scores)[:8]};(d/'away/loop-detection.json').write_text(json.dumps(m,indent=2));print(m)
(d/'away-local-matte.manifest.json').write_text(json.dumps({'method':'sprite-factory.chroma_key_frame','background':'per-frame median of the outer 50 columns','tolerance':22,'edgeTolerance':38,'minBrightness':90,'reason':'BRIA upload refused exhausted balance; no extra paid calls'},indent=2))
