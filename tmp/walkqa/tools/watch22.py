"""Check completed captures while the fixed-source sweep continues."""
import pathlib,subprocess,os,time,sys
root=pathlib.Path('tmp/walkqa/harness-22');seen=set();env={**os.environ,'WALKQA_ROOT':str(root)}
while True:
 events=list(root.glob('*/*-events.json'))
 fresh=[p for p in events if str(p) not in seen]
 for scene in sorted({p.parent.name for p in fresh}):
  subprocess.run([sys.executable,'tmp/walkqa/tools/check20.py',str(root)],env={**env,'QA_SCENE':scene},check=True)
  seen.update(str(p) for p in fresh if p.parent.name==scene)
 if len(events)==139 and len(seen)==139:break
 time.sleep(10)
subprocess.run([sys.executable,'tmp/walkqa/tools/videoalign20.py',str(root)],env=env,check=True)
