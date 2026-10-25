"""One current evidence table; never promotes simulation to rendered proof."""
import json,pathlib,math,statistics
root=pathlib.Path('tmp/overnight'); sim=root/'sim'; reports=root/'reports'
rows=[]; failures=[]
for d in sorted(p for p in sim.iterdir() if p.is_dir()):
 plan=json.loads((d/'plan.json').read_text()); area=json.loads((d/'area.json').read_text()); checks={'exits':[],'objects':[],'extremes':[]}; speed=[]; frozen=0
 for b in plan['beats']:
  data=json.loads((d/(b['name']+'.json')).read_text()); ev=json.loads((d/(b['name']+'-events.json')).read_text()); last=data[-1]; issues=[]
  if b.get('exit'):
   events=[e for e in ev['events'] if e['type']=='triggerExit'];ok=len(events)==1 and bool(b.get('expectedDestination')) and last['location']==b.get('expectedDestination');checks['exits'].append(ok)
   if not ok:issues.append('exit lacks destination or did not arrive exactly once')
  elif b.get('object'):
   ok=bool(last['contact'].get('heading')) and last.get('object')==b['object'] and bool(last['contact'].get('arrival'));checks['objects'].append(ok)
   if not ok:issues.append('object arrival/facing failed')
  elif b['name'] in ['near-left','near-right','far-left','far-right','deepest','diagonal-away','diagonal-toward']:
   target=ev['setup']['reachableTarget'];a=last['contact']['anchor'];ok=bool(last['contact'].get('arrival')) and math.hypot(a['x']-target['x'],a['y']-target['y'])<=2;checks['extremes'].append(ok)
   if not ok:issues.append('extreme failed to arrive within 2 px')
  if b.get('coverageFailure'):issues.append(b['coverageFailure'])
  for a,z in zip(data,data[1:]):
   if a['walking'] and z['walking'] and a['location']==z['location']:
    g=a['contact']['ground'];h=z['contact']['ground'];v=math.hypot(g['x']-h['x'],g['y']-h['y'])/(z['t']-a['t']);speed.append(v);frozen+=v<1e-8
  if issues:failures.append(f"- `{d.name}/{b['name']}`: {'; '.join(issues)}. Scene witness: `tmp/recordings/track1-{d.name}/realtime.mp4` (crossing only; dedicated failure clip pending).")
 livepath=reports/(d.name+'-live.json');live=json.loads(livepath.read_text()) if livepath.exists() else None
 lens=pathlib.Path('tmp/recordings')/('track1-'+d.name)/'report.txt'
 def count(k):
  a=checks[k];return f'{sum(a)}/{len(a)} H'
 render='pending' if not lens.exists() else 'see lens'
 rows.append(f"| {d.name} | {count('exits')} | {count('objects')} | {count('extremes')} | pending live review | {frozen} zero H | {render} | {render} | {'captured' if (reports/'scale'/(d.name+'-near.png')).exists() else 'pending'} |")
text='''# Track 1 — current scene evidence

H = headless result only, not a live acceptance pass. Object totals check arrival and a defined final heading; independent facing comparison remains pending. Speed column counts zero ground motion in 24 Hz samples, not every render frame. Full live acceptance is incomplete.

| Scene | exits once/right destination | objects arrival/facing | extremes <=2px | largest occluder order | continuous ground speed | one drawing/render | sole median <1px | scale near/middle/far |
|---|---|---|---|---|---|---|---|---|
'''+ '\n'.join(rows)+'\n\n## Remaining failures and evidence gaps\n\n'+'\n'.join(failures)
text+='\n\n## Commands and actual output\n\n'
for name in ['headless-output.txt','typecheck.txt','tests.txt','live-output.txt']:
 p=reports/name
 if p.exists():text+='\n`'+name+'`\n```\n'+p.read_text()[-4000:]+'\n```\n'
text+='\n## Commits\n\n- `6af6255` Route object approaches from ground anchor.\n'
(reports/'scenes.md').write_text(text)
print(f'Updated {reports}/scenes.md: {len(rows)} scenes; {len(failures)} failures/coverage gaps')
