"""Refresh stance results after all trajectories exist; preserve reviewer implementation."""
import pathlib,json,sys,subprocess,os
sys.path.insert(0,str(pathlib.Path('tmp/walkqa/tools').absolute()))
import facing_stance
root=pathlib.Path('tmp/walkqa/harness-24')
for event in sorted(root.glob('*/*-events.json')):
 p=event.with_name(event.name.replace('-events',''));turn=p.with_name(p.stem+'-check-turns.json')
 result=facing_stance.check(json.loads(p.read_text()),json.loads(turn.read_text())['cornersOver25Degrees'])
 target=p.with_name(p.stem+'-check-facing.json');encoded=json.dumps(result)
 if not target.exists() or target.read_text()!=encoded:target.write_text(encoded)
print('Recomputed',len(list(root.glob('*/*-events.json'))),'stance gates')
