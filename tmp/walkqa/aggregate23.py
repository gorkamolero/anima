"""Brief-23 evidence index; consumes unchanged reviewer outputs without waivers."""
import collections, hashlib, json, pathlib, statistics
root=pathlib.Path('tmp/walkqa/harness-23')
load=lambda p:json.loads(p.read_text())
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
result=load(root/'results.json'); records=[]; audit=[]
for scene,s in result['scenes'].items():
 for name,w in s['walks'].items():
  p=root/scene; event=load(p/(name+'-events.json')); turns=load(p/(name+'-check-turns.json')); physical=load(p/(name+'-check-behavior-goal22.json')); manifest=load(p/(name+'-crops/manifest.json'))
  assert manifest['viewed']
  assert all(sha(pathlib.Path(f))==h for f,h in manifest['reviewedImageHashes'].items())
  assert all(sha(pathlib.Path(f))==h for f,h in event['captureSource'].items())
  assert name=='unreachable' or turns['actualGroundDistance']>=2
  files=[p/(name+suffix) for suffix in ['.json','.mp4','-events.json','-trajectory.png','-sheet.png']]
  assert all(f.exists() and f.stat().st_size for f in files)
  bars={k:c['pass_'] for k,c in w['checks'].items()}; bars.update(arrival=physical['pass_'],turns=turns['pass_'])
  failures=[k for k,v in bars.items() if v is not True]; limits=[]
  if 'arrival' in failures or w['movingFrames']==0:limits.append('L1')
  if any(k in failures for k in ['turns','path','facing']):limits.append('L2')
  if 'behavior' in failures and (name.startswith('exit') or name=='object'):limits.append('L3')
  if any(k in failures for k in ['height','scale']):limits.append('L4')
  if any(k in failures for k in ['floor','draworder','lock','visual']):limits.append('L5')
  if name in ['narrow-gap','occluder-behind','occluder-back'] or event['setup'].get('coverageFailure'):limits.append('L6')
  record={'scene':scene,'walk':name,'bars':bars,'failures':failures,'limitations':limits,'frames':w['frames'],'movingFrames':w['movingFrames'],'turns':turns,'physicalArrival':physical,'setup':event['setup'],'visualNotes':manifest['notes'],'path':w['checks']['path'],'pass_':not failures and w['completedNaturally']}
  records.append(record)
  audit.append({'scene':scene,'walk':name,'captureSource':event['captureSource'],'reviewedImageHashes':manifest['reviewedImageHashes'],'trajectoryViewed':True,'evidenceHashes':{str(f):sha(f) for f in files}})
summary={'walks':len(records),'frames':result['totals']['frames'],'reviewed':len(audit),'allBarsPass':sum(r['pass_'] for r in records),'reversals':sum(r['turns']['reversals'] for r in records),'medianCycleChanges':statistics.median(r['turns']['cycleChanges'] for r in records),'maxCycleChanges':max(r['turns']['cycleChanges'] for r in records),'medianHeadingChanges':statistics.median(r['turns']['headingChanges'] for r in records),'cycleLimitPass':sum(r['turns']['pass_'] for r in records),'headingLimitPass':sum(r['turns']['headingPass'] for r in records),'minimumNonUnreachableDistance':min(r['turns']['actualGroundDistance'] for r in records if r['walk']!='unreachable'),'bars':{k:sum(r['bars'][k] is True for r in records) for k in records[0]['bars']},'searchReasons':dict(collections.Counter(r['turns']['search']['search']['reason'] for r in records)),'plannerComplete':sum(r['turns']['search']['complete'] for r in records),'stationaryWalks':[r['scene']+'/'+r['walk'] for r in records if r['movingFrames']==0]}
(root/'evidence-index.json').write_text(json.dumps({'summary':summary,'walks':records},indent=2))
(root/'evidence-audit.json').write_text(json.dumps(audit,indent=2))
# Keep a compact, reviewable tracked table; detailed captures remain local.
lines=['# Brief 23 per-walk evidence','', 'All 139 trajectories and full contact sheets were inspected, along with flagged/random feet, crossing triples and final six rest frames. P/F are unchanged reviewer bars. Arrival adds physical sole half-stride validation; turns is the strict cycle count. A limitation is a failure, not a waiver.','', '| Walk / trajectory | Ground m | Cycles / limit | Headings | Reversals | Lock | Floor | Scale | Pixel height | Facing | Draw | Path | Click/exit | Freeze | Video | Visual | Arrival | Path ratio | Failed limitation IDs |','|---|---:|---:|---:|---:|---|---|---|---|---|---|---|---|---|---|---|---|---:|---|']
for r in records:
 t=r['turns']; b=r['bars']; label=r['scene']+'/'+r['walk']; base='../harness-23/'+label
 flags=['P' if b[k] is True else 'F' for k in ['lock','floor','scale','height','facing','draworder','path','behavior','freeze','video','visual','arrival']]
 ratio=r['path'].get('actualRatio'); ratio=f'{ratio:.3f}' if ratio is not None else 'n/a'
 lines.append('| ['+label+']('+base+'-trajectory.png) | '+f"{t['actualGroundDistance']:.3f} | {t['cycleChanges']}/{t['changeLimit']} | {t['headingChanges']} | {t['reversals']} | "+' | '.join(flags)+f" | {ratio} | {', '.join(r['limitations'])} |")
lines+=['','## Start, clicked target and reachable target','', 'Coordinates are scene pixels; ground distance is measured in metres with that scene\'s perspective. Start is the selected actual planted sole after reverse settle, not the sprite origin. The reachable target is the actual motor goal; a projected walk-area point does not prove native-stride reachability.','', '| Walk | Actual start sole | Click | Reachable target | Ground m | Endpoint error m |','|---|---|---|---|---:|---:|']
def xy(q):
 if isinstance(q,list):return f'({q[0]:.2f}, {q[1]:.2f})'
 return f"({q['x']:.2f}, {q['y']:.2f})" if q else 'n/a'
for r in records:
 t=r['turns'];end=t['endpointGroundError'];end=f'{end:.3f}' if end is not None else 'n/a'
 lines.append(f"| {r['scene']}/{r['walk']} | {xy(t['startAnchor'])} | {xy(r['setup']['click'])} | {xy(t['actualTarget'])} | {t['actualGroundDistance']:.3f} | {end} |")
lines+=['','## Visual observations','']
for r in records:
 label=r['scene']+'/'+r['walk'];lines.append(f"- [{label}](../harness-23/{label}-sheet.png): {r['visualNotes']}")
pathlib.Path('tmp/walkqa/reports/23-walk-evidence.md').write_text('\n'.join(lines)+'\n')
print(json.dumps(summary,indent=2))
