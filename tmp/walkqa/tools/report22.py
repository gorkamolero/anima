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
lines+=['','## Walk evidence index','','L1 arrival, L2 turns/length, L3 exits, L4 height, L5 contact/masks, L6 optimum model. These are triage references, not waived checks. Every row links the earlier implementation and this frozen capture; two captures alone do not establish two repairs for every newly discovered defect.','', '| Walk | Brief 21 | Frames | Failed/missing checks | Limitation references | Visual observation |','|---|---|---:|---|---|---|']
for s,n,w in walks(versions[22]):
 failed=', '.join(k for k,c in w['checks'].items() if c.get('pass_') is not True)
 goal=json.loads((root/s/(n+'-check-behavior-goal22.json')).read_text())
 refs=[]
 if not goal['pass_']:refs.append('L3' if 'insideRequestedExit' in goal else 'L1')
 if any(k in failed for k in ['facing','path']):refs.append('L2')
 if 'height' in failed:refs.append('L4')
 if any(k in failed for k in ['floor','lock','freeze','visual']):refs.append('L5')
 refs.append('L6')
 if not goal['pass_']:failed+=', goal22 behavior'
 lines.append(f"| [{s}/{n}](../harness-22/{s}/{n}-sheet.png) | [21](../harness-21/{s}/{n}-sheet.png) | {w['frames']} | {failed} | {', '.join(refs)} | {w.get('visualNotes') or 'Not reviewed yet'} |")
lines+=['','## Ground-space path lengths','','These columns retain both optima in metres. The octilinear value is the canonical norm infimum described in L6, not a certified finite depth-varying stride optimum. A short truncated walk is not an arrival pass.','', '| Walk | Actual | Octilinear optimum | Euclidean optimum | Actual/octilinear |','|---|---:|---:|---:|---:|']
def fmt(x):return f'{x:.4f}' if isinstance(x,(float,int)) else 'unavailable'
for s,n,w in walks(versions[22]):
 p=w['checks']['path']
 lines.append(f"| {s}/{n} | {fmt(p.get('actualBodyLength'))} | {fmt(p.get('octilinearOptimum'))} | {fmt(p.get('euclideanOptimum'))} | {fmt(p.get('actualRatio'))} |")
lines+=['','## Exact exit assessment','','The unchanged checker tests one trigger and destination arrival. The extra brief-22 check also requires the logged planted anchor at the trigger frame to lie inside the requested source exit polygon, including its boundary.','', '| Exit walk | Trigger count | Legacy transition pass | Inside requested source region | Combined pass |','|---|---:|---|---|---|']
for s,n,w in walks(versions[22]):
 g=json.loads((root/s/(n+'-check-behavior-goal22.json')).read_text())
 if 'insideRequestedExit' in g:lines.append(f"| {s}/{n} | {g['triggerCount']} | {g['legacyPass']} | {g['insideRequestedExit']} | {g['pass_']} |")
p=pathlib.Path('tmp/walkqa/reports/22-octilinear.md');prefix=p.read_text().split('## Results (generated from saved evidence)')[0];p.write_text(prefix+'\n'+'\n'.join(lines)+'\n')
print(versions[22]['totals'])
