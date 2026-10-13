"""Read-only video gates for each completed final browser capture."""
import sys,json,pathlib,time,subprocess
sys.path.insert(0,'tmp/walkqa/tools')
import pixelheight
root=pathlib.Path('tmp/walkqa/harness-26')
while True:
 results=[]
 for e in sorted(root.glob('*/*-events.json')):
  name=e.name.removesuffix('-events.json');out=e.with_name(name+'-video-checks.json')
  if out.exists():results.append(json.loads(out.read_text()));continue
  log=e.with_name(name+'.json');vid=e.with_name(name+'.mp4');rows=json.loads(log.read_text())
  r={'scene':e.parent.name,'walk':name}
  try:
   freeze=subprocess.run([sys.executable,'tmp/walkqa/tools/freeze.py',str(vid)],capture_output=True,text=True,check=True)
   r['freeze']=freeze.stdout.strip();r['freezePass']='frozen while walking 0 (' in freeze.stdout
   if len(set(x['location'] for x in rows))>1:r['pixelHeight']={'pass_':False,'limitation':'Scene transition needs per-location clean renders; single-background checker cannot cover this clip.'}
   else:r['pixelHeight']=pixelheight.check(vid,log,e.parent/'background.png')
  except Exception as exc:r['error']=str(exc)
  out.write_text(json.dumps(r));results.append(r);print(r['scene'],name,r.get('freezePass'),r.get('pixelHeight',{}).get('pass_'),flush=True)
 (root/'video-checks.json').write_text(json.dumps({'complete':len(results)==139,'walks':results,'freezePass':sum(r.get('freezePass',False) for r in results),'pixelHeightPass':sum(r.get('pixelHeight',{}).get('pass_',False) for r in results)},indent=2))
 if len(results)==139:break
 time.sleep(5)
