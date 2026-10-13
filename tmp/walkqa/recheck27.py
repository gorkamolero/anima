"""Reuse gates only when every checker input agrees (except unused search diagnostics)."""
import pathlib,json,subprocess,shutil,os
src=pathlib.Path('tmp/walkqa/sim/27-objects');dst=pathlib.Path('tmp/walkqa/sim/27-final')
prior=json.load(open(src/'checks.json'));old={(r['scene'],r['walk']):r for r in prior['walks']};keep=[];changed=[]
def motion(p):
 rows=json.load(open(p))
 for r in rows:r['contact'].get('plan',{}).pop('search',None)
 return rows
for event in sorted(dst.glob('*/*-events.json')):
 scene=event.parent.name;walk=event.name.removesuffix('-events.json');a=src/scene;b=dst/scene
 same=(scene,walk) in old and motion(a/(walk+'.json'))==motion(b/(walk+'.json')) and json.load(open(a/(walk+'-events.json')))==json.load(open(event)) and json.load(open(a/'navigation.json'))==json.load(open(b/'navigation.json')) and json.load(open(a/'area.json'))==json.load(open(b/'area.json'))
 if same:
  keep.append(old[scene,walk])
  for p in a.glob(walk+'-check-*.json'):shutil.copyfile(p,b/p.name)
  p=a/(walk+'-lockcheck.txt')
  if p.exists():shutil.copyfile(p,b/p.name)
 else:changed.append(scene+'/'+walk)
(dst/'checks.json').write_text(json.dumps({'walks':keep}))
(dst/'validation'/'gate-reuse.json').write_text(json.dumps({'reused':len(keep),'rechecked':changed,'comparison':'all frames minus contact.plan.search; events, area and navigation exactly equal'},indent=2))
print('reusing',len(keep),'rechecking',len(changed),flush=True)
subprocess.run(['tmp/walkqa/tools/venv/bin/python','tmp/walkqa/check26.py',str(dst),*changed],check=True,env={**os.environ,'WALKQA_ROOT':str(dst)})
