"""One current evidence table; simulation and accelerated live checks are labelled."""
import json,pathlib,math,subprocess
from overnight_facing import facing
root=pathlib.Path('tmp/overnight');sim=root/'sim';reports=root/'reports';recordings=pathlib.Path('tmp/recordings')
read=lambda p:json.loads(p.read_text())
scale=read(reports/'scale/review.json') if (reports/'scale/review.json').exists() else {}
rows=[];failures=[];live_total=0
for d in sorted(p for p in sim.iterdir() if p.is_dir()):
 plan=read(d/'plan.json');area=read(d/'area.json');checks={'exits':[],'objects':[],'extremes':[]};frozen=0;speed_errors=[]
 livepath=reports/(d.name+'-live.json');live=read(livepath) if livepath.exists() else {};live_total+=len(live.get('results',[]));lb={r['beat']['name']:r for r in live.get('results',[])}
 lc={k:[] for k in checks}
 newer=reports/(d.name+'-objects-live.json')
 if newer.exists():lb.update({r['beat']['name']:r for r in read(newer).get('results',[])})
 def witness(beat):
  for name in [f'track1-{d.name}-{beat}',f'track1-{d.name}-largest-occluder-behind',f'track1-{d.name}']:
   clip=recordings/name/'realtime.mp4';raw=recordings/(name+'.webm')
   if clip.exists():return str(clip)
   if raw.exists():return str(raw)
  return 'MISSING CLIP'
 for b in plan['beats']:
  data=read(d/(b['name']+'.json'));ev=read(d/(b['name']+'-events.json'));last=data[-1];lr=lb.get(b['name']);issues=[]
  if b.get('exit'):
   events=[e for e in ev['events'] if e['type']=='triggerExit'];ok=len(events)==1 and bool(b.get('expectedDestination')) and last['location']==b.get('expectedDestination');checks['exits'].append(ok)
   if lr:lc['exits'].append(len(lr['events'])==1 and bool(b.get('expectedDestination')) and lr['location']==b.get('expectedDestination'))
   if not ok:issues.append('exit has no saved destination or did not arrive exactly once')
  elif b.get('object'):
   bounds=next(o['bounds'] for o in area['interactables'] if o['name']==b['object'])
   ok=facing(area['area'],last['contact']['anchor'],bounds,last['contact'].get('heading'))[0] and last.get('object')==b['object'] and bool(last['contact'].get('arrival'));checks['objects'].append(ok)
   if lr:
    lok=facing(area['area'],lr['motor']['anchor'],bounds,lr['motor'].get('heading'))[0] and bool(lr['motor'].get('arrival')) and not lr.get('error')
    lc['objects'].append(lok)
    if not lok:issues.append('live final heading fails independent 27.5-degree ground-facing check')
   if not ok:issues.append('object arrival/facing failed')
  elif b['name'] in ['near-left','near-right','far-left','far-right','deepest','diagonal-away','diagonal-toward']:
   target=ev['setup']['reachableTarget'];a=last['contact']['anchor'];ok=bool(last['contact'].get('arrival')) and math.hypot(a['x']-target['x'],a['y']-target['y'])<=2;checks['extremes'].append(ok)
   if lr:
    a=lr['motor']['anchor'];g=lr.get('goal');lc['extremes'].append(bool(g) and lr['location']==d.name and math.hypot(a['x']-g['x'],a['y']-g['y'])<=2)
   if not ok:issues.append('extreme failed to arrive within 2 px')
  if b.get('coverageFailure'):issues.append(b['coverageFailure'])
  for a,z in zip(data,data[1:]):
   if a['walking'] and z['walking'] and a['location']==z['location']:
    g=a['contact']['ground'];h=z['contact']['ground'];v=math.hypot(g['x']-h['x'],g['y']-h['y'])/(z['t']-a['t']);frozen+=v<1e-8;speed_errors.append(abs(v/z['contact']['speedMetresPerSecond']-1))
  if issues:failures.append(f"- `{d.name}/{b['name']}`: {'; '.join(issues)}. Witness: `{witness(b['name'])}`.")
 if not checks['exits']:failures.append(f'- `{d.name}`: no derived exits; 0/0 is not a travel pass. Witness: `{witness("occluder-behind")}`.')
 def count(k):
  a=checks[k];l=lc[k];return f'{sum(a)}/{len(a)} H; {sum(l)}/{len(l)} L'
 lens=recordings/('track1-'+d.name+'-largest-occluder-behind')/'metrics.json'
 if not lens.exists():lens=recordings/('track1-'+d.name)/'metrics.json'
 metrics=read(lens) if lens.exists() else None
 speed=f'{frozen} zero H; render pending';draw='pending';slide='pending'
 if metrics:
  speed=f"{metrics['zeroBodyMotion']}/{metrics['movingRenderPairs']} zero L"
  draw=f"{metrics['heldDrawingPairs']} holds/{metrics['movingRenderPairs']} L"
  median=metrics['soleSlideMedian'];slide='no moving pairs' if median is None else f"{'PASS' if median<1 else 'FAIL'} {median:.2f}px ({metrics['soleSlidePairs']})"
  if median is None or median>=1:failures.append(f'- `{d.name}`: sole slide {slide}. Clip: `{witness("occluder-behind")}`.')
  if metrics['heldDrawingPairs'] or metrics['zeroBodyMotion']:failures.append(f'- `{d.name}`: render motion/drawing holds: {speed}; {draw}. Clip: `{witness("occluder-behind")}`.')
 occlusion='pending largest witness'
 crossing=reports/(d.name+'-crossings-live.json')
 if crossing.exists():
  c=read(crossing);cr=c.get('results',[]);pairs=[];orders=[];unsupported=any(r['beat'].get('coverageFailure') for r in cr)
  for r in cr:
   audit=r.get('audit',[])
   for a,b in zip(audit,audit[1:]):
    if a['walking'] and b['walking'] and b['delta']>0 and a['heading']==b['heading']:
     v=math.hypot(b['ground']['x']-a['ground']['x'],b['ground']['y']-a['ground']['y'])/(b['delta']/1000);pairs.append(abs(v/b['speed']-1))
   for a in audit:
    if a['overlap'] and a.get('baseline') is not None and a['occluderIndex']>=0:orders.append((a['characterIndex']<a['occluderIndex'])==(a['anchor']['y']<a['baseline']))
  occlusion='FAIL no rear floor' if unsupported else f'{sum(orders)}/{len(orders)} display-order samples'
  if pairs:speed+=f'; max chord-speed deviation {max(pairs)*100:.2f}%'
  if unsupported or (orders and not all(orders)):
   clip=next((r.get('clip') for r in cr if r.get('clip')),None);failures.append(f'- `{d.name}` largest-occluder check: {occlusion}. Clip: `tmp/recordings/{clip}.webm`.')
 ss=scale.get(d.name,{}).get('status','not reviewed')
 rows.append(f'| {d.name} | {count("exits")} | {count("objects")} | {count("extremes")} | {occlusion} | {speed} | {draw} | {slide} | {ss} |')
 if 'FAIL' in ss or 'unverified' in ss:failures.append(f'- `{d.name}` scale: {ss}. {scale[d.name].get("note", "")} Stills: `tmp/overnight/reports/scale/{d.name}-{{near,middle,far}}.png`; clip: `{witness("occluder-behind")}`.')
existing_count=len(rows)
generation=reports/'generation.json'
if generation.exists():
 for item in read(generation)['results']:
  if item.get('ground')=='failed' or item.get('status')!=200:
   name=item.get('id') or ('new-'+item['kind'])
   rows.append(f'| {name} ({item["kind"]}) | BLOCKED pipeline | unavailable | unavailable | unavailable | unavailable | unavailable | unavailable | no playable scene |')
   failures.append(f'- `{name}` pipeline: HTTP {item.get("status")}; {item.get("error")}. Response: `tmp/overnight/reports/new-{item["kind"]}.json`. No playable scene exists, so a scene-canvas failure clip is unavailable.')
text=f'''# Track 1 — current scene evidence

**NOT ACCEPTED.** {existing_count} existing scenes plus five requested-place rows; {live_total} completed browser beat records. H = headless; L = game scene driven with the debug clock for functional checks. Only the retained six-second lens witnesses use the real-time render clock. Every-walk real-time motion proof remains incomplete. Sole values use the lens contact tracks, not a separate optical-foot tracker. Object counts include an independent ground-angle check (27.5 degrees, including sector hysteresis). Latest object-only reruns replace earlier object records. Largest-occluder recordings report actual display-list order; absent rear-floor coverage is a failure. No scene receives an overall pass.

Concurrent motor/standing-sheet edits occurred during capture. See `source-state.json` and `../BLOCKED.md`; this is not a single frozen-build acceptance matrix. The earlier cleanup-only location reload timeout in three live records happened after all their beats completed.

| Scene | exits once/right destination | object arrival/facing | extremes <=2px | largest occluder | body motion | drawing/render | sole median <1px | scale near/middle/far |
|---|---|---|---|---|---|---|---|---|
'''+ '\n'.join(rows)+'\n\n## Remaining failures and evidence gaps\n\n'+'\n'.join(failures)
text+='\n\n## Scale review\n\nNo stored scene data was patched. `scale/review.json` contains independent visual observations and reference assumptions. No shared scale change was shipped: under/oversize differs between pictures, and concurrent standing alignment changes invalidate later measurements. Existing references without known physical dimensions remain unverified.\n'
generation=reports/'generation.json'
if generation.exists():
 g=read(generation);text+='\n## Five-place pipeline and paid calls\n\n'
 for r in g['results']:text+=f'- {r["kind"]}: HTTP {r.get("status")}; `{r.get("id")}`; ground `{r.get("ground")}`; {r.get("error") or "no reported error"}.\n'
 from collections import Counter
 calls=Counter(c['kind'] for c in g['calls'] if not c.get('cached'));text+='\nUncached ledger rows by kind (request windows; concurrent callers may overlap; do not sum reservations and completed calls): `'+json.dumps(dict(calls))+'`. Raw per-request counts: `generation.json`.\n'
else:text+='\n## Five-place pipeline\n\nRequests started; results pending in `generation-output.txt`.\n'
text+='\n## Commands and actual output\n\n'
commands={'headless-output.txt':'api/node_modules/.bin/tsx adventures/shadow-over-innsmouth/scripts/simulate-walks.mts','typecheck.txt':'pnpm --filter @anima/footfall typecheck','tests.txt':'pnpm --filter @anima/footfall test','live-output.txt':'node adventures/shadow-over-innsmouth/scripts/overnight-live.mjs [--resume]','generation-output.txt':'node adventures/shadow-over-innsmouth/scripts/overnight-generate.mjs','facing-output.txt':'python3 adventures/shadow-over-innsmouth/scripts/overnight_facing.py','all-lenses-output.txt':'node adventures/shadow-over-innsmouth/scripts/walk-lens.mjs track1-<scene> --every 18'}
for name,cmd in commands.items():
 p=reports/name
 if p.exists():text+='\n`'+cmd+'` (full output: `'+name+'`)\n```\n'+p.read_text()[-2500:]+'\n```\n'
text+='\n## Commits from this track\n\n'
for rev in ['6af6255','0e95075','513efa8','bd1763b','9c4fe55','458576f','fb165e2']:
 text+='- '+subprocess.check_output(['git','show','-s','--format=%h %s',rev],text=True)
(reports/'scenes.md').write_text(text)
print(f'Updated {reports}/scenes.md: {len(rows)} scenes, {live_total} live beat records, {len(failures)} failures/coverage gaps')
