"""Preserve scene transitions, then run the reviewer's unchanged proof checks."""
import json, subprocess, hashlib, math
from pathlib import Path
root=Path('tmp/walkqa/final-06'); out=Path('tmp/walkqa/verification-06')
trans=Path('tmp/walkqa/transitions-06')
def run(args): return subprocess.run(args,check=True,capture_output=True,text=True).stdout
prior={r['clip']:r['sha256'] for r in json.loads((out/'proof-manifest.json').read_text())} if (out/'proof-manifest.json').exists() else {}
split=[]
for scene in sorted(root.iterdir()):
 if not scene.is_dir(): continue
 geo=json.loads((scene/'navigation.json').read_text()); source=geo['location']
 for clip in sorted(scene.glob('*.mp4')):
  log=clip.with_suffix('.json'); rows=json.loads(log.read_text())
  n=next((i for i,r in enumerate(rows) if r['location']!=source),len(rows))
  previous=trans/scene.name/clip.name
  if n==len(rows) and previous.exists() and hashlib.sha256(clip.read_bytes()).hexdigest()!=prior.get(str(clip)):
   archive=out/'old-transitions'/scene.name;archive.mkdir(parents=True,exist_ok=True)
   for p in [previous,previous.with_suffix('.json'),previous.with_name(previous.stem+'-sheet.png')]:
    if p.exists():p.replace(archive/p.name)
  if n<len(rows):
   assert n>0,(clip,n)
   dest=trans/scene.name;dest.mkdir(parents=True,exist_ok=True)
   for p in [clip,log,clip.with_name(clip.stem+'-sheet.png')]: p.replace(dest/p.name)
   run(['ffmpeg','-y','-v','error','-i',str(dest/clip.name),'-frames:v',str(n),'-c:v','libx264','-crf','18','-pix_fmt','yuv420p',str(clip)])
   log.write_text(json.dumps(rows[:n]))
   run(['ffmpeg','-y','-v','error','-i',str(clip),'-vf',f'fps=6,scale=320:-1,tile=6x{math.ceil(n/24)}','-frames:v','1',str(clip.with_name(clip.stem+'-sheet.png'))])
   split.append({'clip':str(clip),'sourceFrames':n,'fullFrames':len(rows),'transition':str(dest/clip.name)})
# Retain provenance when only a subset of clips is refreshed.
split=[]
for original in sorted(trans.glob('*/*.mp4')):
 clip=root/original.parent.name/original.name
 split.append({'clip':str(clip),'sourceFrames':len(json.loads(clip.with_suffix('.json').read_text())),'fullFrames':len(json.loads(original.with_suffix('.json').read_text())),'transition':str(original)})
(out/'transitions.json').write_text(json.dumps(split,indent=2))
clips=sorted(root.glob('*/*.mp4'))
(out/'lockcheck-final.jsonl').write_text(run(['python3','tmp/walkqa/tools/lockcheck.py',*[str(p) for p in clips]]))
(out/'walkstats-final.txt').write_text(run(['python3','tmp/walkqa/tools/walkstats.py',str(root)]))
manifest=[];body=[]
for clip in clips:
 rows=json.loads(clip.with_suffix('.json').read_text())
 probe=json.loads(run(['ffprobe','-v','error','-select_streams','v:0','-count_frames','-show_entries','stream=width,height,r_frame_rate,nb_read_frames','-of','json',str(clip)]))['streams'][0]
 assert (probe['width'],probe['height'],probe['r_frame_rate'],int(probe['nb_read_frames']))==(1920,1080,'24/1',len(rows)),(clip,probe,len(rows))
 geo=json.loads((clip.parent/'navigation.json').read_text());m=geo['area']['mask']
 off=[]
 for i,r in enumerate(rows):
  if not r['walking']:continue
  x=int(r['x']*m['width']/1920);y=int(r['y']*m['height']/1080)
  if not (0<=x<m['width'] and 0<=y<m['height'] and m['data'][y*m['width']+x]):off.append(i)
 body.append({'clip':str(clip),'offBodyFrames':off})
 manifest.append({'clip':str(clip),'frames':len(rows),'width':1920,'height':1080,'fps':24,'sha256':hashlib.sha256(clip.read_bytes()).hexdigest()})
(out/'proof-manifest.json').write_text(json.dumps(manifest,indent=2))
(out/'body-floor.json').write_text(json.dumps(body,indent=2))
print(f'{len(clips)} clips: 1920x1080, 24 fps, frame/log counts verified; {len(split)} transitions preserved separately; body off-floor: {sum(len(r["offBodyFrames"]) for r in body)}')
print((out/'walkstats-final.txt').read_text())
