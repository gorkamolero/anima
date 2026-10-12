from pathlib import Path
import subprocess,json
from PIL import Image
root=Path('tmp/walkqa');out=[]
for name in ['roundtrip/door-outside-to-inside','roundtrip/door-inside-to-outside','road/edge-left','road/far']:
 p=root/'exits-07'/name;rows=json.loads(p.with_suffix('.json').read_text());raw=subprocess.check_output(['ffmpeg','-v','error','-i',str(p.with_suffix('.mp4')),'-vf','crop=400:400:0:60,scale=20:20','-pix_fmt','rgb24','-f','rawvideo','-']);frames=[raw[i:i+1200] for i in range(0,len(raw),1200)];last=frames[-1];first=frames[0]
 def dist(a,b):return sum(abs(x-y) for x,y in zip(a,b))/len(a)
 crossing=next((i for i,v in enumerate(frames) if dist(v,last)<dist(v,first)),None)
 paths=[]
 for i in [crossing-1,crossing,crossing+1] if crossing else []:
  dest=p.parent/(p.name+f'-visual-f{i:04}.png');subprocess.run(['ffmpeg','-v','error','-y','-i',str(p.with_suffix('.mp4')),'-vf',f'select=eq(n\\,{i})','-frames:v','1',str(dest)],check=True);paths.append(str(dest.relative_to(root)))
 out.append({'clip':name,'visualBackgroundCrossing':crossing,'frames':paths})
print(json.dumps(out,indent=2));(root/'verification-07/visible-exits.json').write_text(json.dumps(out,indent=2))
