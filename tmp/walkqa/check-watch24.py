import pathlib,subprocess,os,time,concurrent.futures,json
root=pathlib.Path('tmp/walkqa/harness-24');seen=set();python=str(pathlib.Path('tmp/walkqa/tools/venv/bin/python').absolute())
def check(scene):
 env={**os.environ,'QA_SCENE':scene,'WALKQA_ROOT':str(root),'OPENBLAS_NUM_THREADS':'1','OMP_NUM_THREADS':'1'}
 with open(root/('checks-'+scene+'.log'),'a') as log:
  subprocess.run([python,'tmp/walkqa/check24.py',str(root)],env=env,stdout=log,stderr=subprocess.STDOUT,check=True)
 print('checked',scene,flush=True)
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
 while True:
  events=set(root.glob('*/*-events.json'));fresh=events-seen
  if fresh:
   subprocess.run([python,'tmp/walkqa/trajectories24.py',str(root)],stdout=subprocess.DEVNULL,check=True)
   list(pool.map(check,sorted({p.parent.name for p in fresh})))
   seen.update(events)
  if len(events)==139 and not fresh:break
  time.sleep(15)
for script in ['tmp/walkqa/tools/videoalign20.py','tmp/walkqa/tools/behavior22.py','tmp/walkqa/tools/walkstats.py']:
 with open(root/(pathlib.Path(script).stem+'.log'),'w') as log:subprocess.run([python,script,str(root)],stdout=log,check=True)
(root/'checks-complete.marker').touch()
