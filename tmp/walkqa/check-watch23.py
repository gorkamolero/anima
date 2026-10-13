"""Run unchanged reviewer checks as frozen captures complete."""
import pathlib,subprocess,os,time,json
root=pathlib.Path('tmp/walkqa/harness-23');seen=set();python=str(pathlib.Path('tmp/walkqa/tools/venv/bin/python').absolute())
while True:
 events=set(root.glob('*/*-events.json'));fresh=events-seen
 for scene in sorted({p.parent.name for p in fresh}):
  env={**os.environ,'QA_SCENE':scene,'WALKQA_ROOT':str(root)}
  subprocess.run([python,'tmp/walkqa/tools/check20.py',str(root)],env=env,check=True)
 seen.update(events)
 if (root/'capture-complete.marker').exists() and not fresh:break
 time.sleep(15)
subprocess.run([python,'tmp/walkqa/tools/videoalign20.py',str(root)],check=True)
subprocess.run([python,'tmp/walkqa/tools/behavior22.py',str(root)],check=True)
subprocess.run([python,'tmp/walkqa/trajectories23.py',str(root)],check=True)
