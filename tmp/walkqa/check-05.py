import json,subprocess,sys,time
from pathlib import Path
scene=sys.argv[1];root=Path('tmp/walkqa/final-05')/scene
out=Path('tmp/walkqa/checks-05')/scene;out.mkdir(parents=True,exist_ok=True)
python='tmp/walkqa/tools/venv/bin/python'
# Wait until the scene matrix has completed: checker estimates background from all siblings.
while not (root/'render.json').exists():time.sleep(5)
subprocess.run([sys.executable,'tmp/walkqa/split-exits-05.py',scene],check=True)
for clip in sorted(root.glob('*.mp4')):
 result=out/(clip.stem+'.json')
 if result.exists():continue
 p=subprocess.run([python,'tmp/walkqa/tools/footcheck.py',str(clip)],capture_output=True,text=True)
 if p.returncode:result.write_text(json.dumps({'video':str(clip),'error':p.stderr}));print(clip.stem,'ERROR',flush=True);continue
 result.write_text(p.stdout);r=json.loads(p.stdout)
 if r['worstStance']:
  a,b,_=r['worstStance'];strip=out/(clip.stem+'-worst.png');subprocess.run([python,'tmp/walkqa/tools/feetstrip.py',str(clip),str(a),str(b),str(strip)],capture_output=True)
 print(scene,clip.stem,r['stanceDrift_px_max'],r['worstStance'],flush=True)
