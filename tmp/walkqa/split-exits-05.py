import json,sys,subprocess,shutil
from pathlib import Path
root=Path('tmp/walkqa/final-05')/sys.argv[1]
full=Path('tmp/walkqa/transitions-05')/sys.argv[1];full.mkdir(parents=True,exist_ok=True)
for clip in root.glob('*.mp4'):
 data=clip.with_suffix('.json')
 if not data.exists():continue
 a=json.loads(data.read_text())
 if not a:continue
 changes=[i for i,r in enumerate(a) if r['location']!=a[0]['location']]
 if not changes:continue
 n=min(changes)
 if n<2:continue
 dest=full/clip.name
 if dest.exists():continue
 shutil.move(clip,dest);shutil.copy2(data,full/data.name)
 subprocess.run(['ffmpeg','-v','error','-y','-i',str(dest),'-frames:v',str(n),'-an','-c:v','libx264','-crf','0',str(clip)],check=True)
 data.write_text(json.dumps(a[:n]));subprocess.run(['ffmpeg','-v','error','-y','-i',str(dest),'-vf',f'select=eq(n\\,{len(a)-1})','-frames:v','1',str(full/(clip.stem+'-destination.png'))],check=True)
 (full/(clip.stem+'-split.json')).write_text(json.dumps({'sourceFrames':n,'fullFrames':len(a),'from':a[0]['location'],'to':a[-1]['location'],'completed':not a[-1]['ui'] and not a[-1]['inputBlocked']},indent=2))
 print(clip.name,'source',n,'full',len(a),flush=True)
