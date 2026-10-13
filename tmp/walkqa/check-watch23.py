"""Run unchanged reviewer checks for independent scenes as captures complete."""
import pathlib,subprocess,os,time,concurrent.futures,json
root=pathlib.Path('tmp/walkqa/harness-23');seen=set();python=str(pathlib.Path('tmp/walkqa/tools/venv/bin/python').absolute())
def check(scene):
 env={**os.environ,'QA_SCENE':scene,'WALKQA_ROOT':str(root),'OPENBLAS_NUM_THREADS':'1','OMP_NUM_THREADS':'1'}
 with open(root/('checks-'+scene+'.log'),'a') as log:
  subprocess.run([python,'tmp/walkqa/tools/check20.py',str(root)],env=env,stdout=log,stderr=subprocess.STDOUT,check=True)
 print('checked',scene,flush=True)
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
 while True:
  events=set(root.glob('*/*-events.json'));fresh=events-seen
  list(pool.map(check,sorted({p.parent.name for p in fresh})))
  seen.update(events)
  if (root/'capture-complete.marker').exists() and not fresh:break
  time.sleep(15)
for script in ['tmp/walkqa/tools/videoalign20.py','tmp/walkqa/tools/behavior22.py','tmp/walkqa/trajectories23.py']:
 subprocess.run([python,script,str(root)],check=True)
