import sys,subprocess,json,importlib.util
from pathlib import Path
import numpy as np
from PIL import Image
v=sys.argv[1]; root=Path.cwd();d=root/'tmp/hermes-depth-06';video=d/f'{v}-bria.webm';out=d/v;out.mkdir(exist_ok=True)
spec=importlib.util.spec_from_file_location('factory',root/'packages/sprite-tools/scripts/sprite-factory.py');factory=importlib.util.module_from_spec(spec);spec.loader.exec_module(factory)
frames=factory.extract_alpha_video_frames(video,out/'raw',24,None)
# Premultiplied images: alpha boundaries and both legs contribute to seam score.
a=[]
for f in frames:
 im=Image.open(f).convert('RGBA').resize((90,160)); ar=np.array(im,dtype=float)/255
 a.append(np.concatenate([ar[:,:,:3]*ar[:,:,3:],ar[:,:,3:]],axis=2))
a=np.array(a);scores=[]
for start in range(24,len(a)-18):
 for length in range(20,49):
  end=start+length
  if end+2>=len(a):continue
  score=sum(np.mean((a[start+k,60:]-a[end+k,60:])**2) for k in [-1,0,1])/3
  scores.append((score,start,end))
score,start,end=min(scores)
meta={'method':'local-frame-similarity','start_frame':start,'end_frame':end,'frame_count':end-start,'fps':24,'start_time':start/24,'end_time':end/24,'seam_mse':score,'candidates':sorted(scores)[:8]}
(out/'loop-detection.json').write_text(json.dumps(meta,indent=2));print(meta)
# Encode exact [start,end) frame interval with alpha for sprite-factory.
loop=out/'loop.webm'
subprocess.run(['ffmpeg','-v','error','-y','-c:v','libvpx-vp9','-i',str(video),'-vf',f'trim=start_frame={start}:end_frame={end},setpts=PTS-STARTPTS','-an','-c:v','libvpx-vp9','-lossless','1','-pix_fmt','yuva420p','-auto-alt-ref','0',str(loop)],check=True)
