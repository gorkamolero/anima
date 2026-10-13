import json,pathlib,subprocess,os
root=pathlib.Path('tmp/walkqa/harness-22');env={**os.environ,'WALKQA_ROOT':str(root)}
subprocess.run(['python3','tmp/walkqa/tools/results22.py'],env=env,check=True)
subprocess.run(['python3','tmp/walkqa/tools/behavior22.py',str(root)],check=True)
versions={n:json.loads(pathlib.Path(f'tmp/walkqa/harness-{n}/results.json').read_text()) for n in [20,21,22]}
keys=['lock','floor','scale','height','facing','draworder','path','behavior','freeze','video','visual']
def walks(q):return [(s,n,w) for s,v in q['scenes'].items() for n,w in v['walks'].items() if w['status']=='captured']
lines=['## Results (generated from saved evidence)','', '| Check | Brief 20 | Brief 21 | Brief 22 |','|---|---:|---:|---:|']
for k in keys:lines.append('| '+k+' | '+' | '.join(f"{sum(w['checks'][k].get('pass_') is True for _,_,w in walks(versions[n]))}/{len(walks(versions[n]))}" for n in versions)+' |')
lines+=['','The behavior row preserves the unchanged <=12 px sprite-origin checker. The following supplementary column applies the requested physical-sole half-stride bar. Path 22 uses ground-space octilinear norm; 20/21 retain their original Euclidean screen-space assessments.','', '| Scene | Captured | Half-stride behavior | Legacy behavior | Visual reviewed |','|---|---:|---:|---:|---:|']
for s,v in versions[22]['scenes'].items():
 ws=[(n,w) for n,w in v['walks'].items() if w['status']=='captured'];goal=[]
 for n,w in ws:
  f=root/s/(n+'-check-behavior-goal22.json');goal.append(json.loads(f.read_text()) if f.exists() else {})
 lines.append(f"| {s} | {len(ws)}/{v['planned']} | {sum(q.get('pass_') is True for q in goal)}/{len(ws)} | {sum(w['checks']['behavior'].get('pass_') is True for _,w in ws)}/{len(ws)} | {sum(w['checks']['visual'].get('pass_') is not None for _,w in ws)}/{len(ws)} |")
lines+=['','## Walk evidence index','','| Walk | Frames | Failed/missing checks | Visual observation |','|---|---:|---|---|']
for s,n,w in walks(versions[22]):
 failed=', '.join(k for k,c in w['checks'].items() if c.get('pass_') is not True)
 lines.append(f"| [{s}/{n}](../harness-22/{s}/{n}-sheet.png) | {w['frames']} | {failed} | {w.get('visualNotes') or 'Not reviewed yet'} |")
p=pathlib.Path('tmp/walkqa/reports/22-octilinear.md');prefix=p.read_text().split('## Results (generated from saved evidence)')[0];p.write_text(prefix+'\n'+'\n'.join(lines)+'\n')
print(versions[22]['totals'])
