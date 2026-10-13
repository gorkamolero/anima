import json,pathlib,re,math,collections
from PIL import Image,ImageDraw,ImageFont
import numpy as np
base=pathlib.Path('tmp/walkqa/sim'); out=base/'28-final2'; report=pathlib.Path('tmp/walkqa/reports/28-cornered-starts.md')
namespace={};exec(pathlib.Path('tmp/walkqa/analyze27.py').read_text().split("before=analyse(")[0],namespace)
final=namespace['analyse']('28-final2'); before=namespace['analyse']('28-before'); (out/'diagnostics.json').write_text(json.dumps({'before':before,'after':final},indent=2))
runs=['28-before','28-entry-fix','28-pivot','28-start-floor','28-continue','28-segments','28-standing-pivot','28-two-boot-pivot','28-sole-start','28-transfer','28-route','28-final','28-small-rest','28-final2']
rows=[]
for name in runs:
 p=base/name; a=namespace['analyse'](name); r=json.load(open(p/'review28.json')); stats=[l.split() for l in open(p/'walkstats.log') if '.json' in l]; rows.append((name,a,sum(v['facing']['pass_'] for v in r),max(v['lock']['maxExcursion_px'] or 0 for v in r),sum(int(v[3].split('/')[0]) for v in stats),sum(int(v[-1]) for v in stats)))
plots=pathlib.Path('tmp/walkqa/reports/28-trajectories');plots.mkdir(exist_ok=True)
font=ImageFont.truetype('/System/Library/Fonts/Monaco.ttf',17)
cases=[('pier','near-right'),('lobby','near-left'),('grocery','far-left'),('outside','exit-edge-left')]
for scene,walk in cases:
 panels=[]
 for run in ['28-before','28-final2']:
  p=base/run/scene; log=json.load(open(p/(walk+'.json'))); geo=json.load(open(p/'area.json')); area=geo['area']; bg=pathlib.Path('tmp/walkqa/harness-24')/scene/'background.png'; im=Image.open(bg).convert('RGB').resize((960,540)); im=Image.blend(im,Image.new('RGB',im.size,'#101820'),.35)
  mask=np.array(area['mask']['data']).reshape(area['mask']['height'],area['mask']['width']); clear=area['clearanceMask']; cm=np.array(clear['data']).reshape(clear['height'],clear['width']); overlay=np.zeros((*mask.shape,4),dtype=np.uint8);overlay[mask>0]=[40,100,255,80];overlay[cm>0]=[30,230,80,90];im=Image.alpha_composite(im.convert('RGBA'),Image.fromarray(overlay).resize(im.size,Image.Resampling.NEAREST)); d=ImageDraw.Draw(im)
  source=log[0]['location']; points=[(r['x']/2,r['y']/2) for r in log if r['location']==source];d.line(points,fill='#ff4444',width=3);x,y=points[0];d.ellipse((x-5,y-5,x+5,y+5),fill='white')
  t=next((r.get('target') for r in log if r.get('target') and r['location']==source),None)
  if t:x,y=t['x']/2,t['y']/2;d.ellipse((x-7,y-7,x+7,y+7),outline='yellow',width=3)
  panel=Image.new('RGB',(960,585),'#111827');panel.paste(im,(0,45));draw=ImageDraw.Draw(panel);draw.text((12,10),f'{scene}/{walk} | {run} | body trajectory',font=font,fill='white');panels.append(panel)
 board=Image.new('RGB',(1920,585));board.paste(panels[0],(0,0));board.paste(panels[1],(960,0));board.save(plots/(scene+'-'+walk+'.png'))
text='''# Brief 28 — cornered starts

**Acceptance remains incomplete.** The simulator now records arrivals for all 139 walks and has zero reviewer-style stuck starts, but the 90% half-stride / 100% one-stride targets and the facing bar are not met. Pier/near-right remains a named implementation limitation; it is not declared geometrically impossible.

Branch `open-world-mvp`, starting commit `252a9d3`. Read the goal, brief 27, and the requested ten commits. Existing changes to `calls.md`, reviewer `walkstats.py`, and `AgentDebug.test.ts` were preserved. No reviewer tool was edited.

## Changes and measurements

- Standing pivots use either grounded boot. A standing pose showing the support transfer precedes a turn that would otherwise move the old sheet's planted boot. This repaired the 112 px lock failure in an intermediate experiment.
- First-stance body clearance begins at its actual entry drawing. Floor support is measured at the planted/landing soles; the first projected body may straddle a floor/caption boundary. Object footprints remain solid and the landing must be inside normal clearance. Later stances retain normal clearance checks. No facing tolerance was changed (30° / 35°).
- Up to eight improving stand-and-pivot continuations are planned before playback. Every segment settles before restarting; playback does not invoke search. Each search retains its 4,000-node cap, so a complete multi-segment request can exceed 4,000 expansions. This is bounded continuation, not a globally optimal search.
- Partial stops are scored by the remaining route around floor gaps, while arrival remains the actual geometric residual. Rejected continuation searches are included in the final rejection histograms.

| Run / change | Half stride | Within one stride | Beyond one stride | Missing arrival | Stuck | Facing / 139 | Max lock px | Off-floor frames | Object contacts |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Brief 26 | 12 / 116 | 26 / 116 | 90 | 21 | 28 | 86 | 59.63 | nonzero (inside return) | 0 |
| Brief 27 | 27 / 118 | 44 / 118 | 74 | 18 | 22 | 80 | 0 | 0 | 0 |
'''
labels={'28-before':'Reproduced 27','28-entry-fix':'Actual entry origin','28-pivot':'Incoming-support pivots','28-start-floor':'Raw first-stance body floor','28-continue':'Runtime continuation experiment (replaced)','28-segments':'Preplanned continuations','28-standing-pivot':'Static-standing validation experiment (replaced)','28-two-boot-pivot':'Either boot (lock failure; rejected)','28-sole-start':'Sole-supported start (lock failure; rejected)','28-transfer':'Explicit support transfer','28-route':'Route score','28-final':'All attempted searches counted','28-small-rest':'Small distant-stride continuations','28-final2':'Final'}
for name,a,f,l,o,c in rows:
 denom=a['hasArrival']-a['travelled'];text+=f"| [{name}](../sim/{name}/) — {labels[name]} | {a['halfStride']} / {denom} | {a['oneStride']} / {denom} | {a['beyondStride']} | {139-a['hasArrival']} | {a['stuckAll']} | {f} | {l} | {o} | {c} |\n"
text+='''
Final: **103 / 128 (80.5%) within half stride; 113 / 128 (88.3%) within one stride; 11 scene transfers; zero missing arrivals; zero stuck starts by the unchanged brief-27 definition** (same scene, target >150 px from first logged body, net body movement <40 px). This definition does not certify every short/unreachable click as successful. Facing passes fall from 80 to 73; settling and pivots do not waive the reviewer's reversal/run rules. Full per-walk results: [review28.json](../sim/28-final2/review28.json), [arrival reviewer](../sim/28-final2/arrival_vs_standable.log), [walkstats](../sim/28-final2/walkstats.log), [diagnostics](../sim/28-final2/diagnostics.json).

The arrival, facing, lock and walkstats reviewer tools ran on every retained simulator run, including diagnostic probes. `review28.py` is an orchestration script outside the reviewer-tools directory. Simulator runs read stored records only and make no network requests. Final corpus time: '''+f"{json.load(open(out/'run.json'))['elapsedMs']/1000:.3f} s"+'''.

## Four requested trajectories

White = first logged body position; red = body trajectory; yellow = target; blue = raw floor; green = clearance. Source-scene trajectories stop at transfer. Left is reproduced brief 27, right is final. Full histograms count all attempted plans, including discarded continuations.

| Case | Before residual px | Final source-scene residual px | Before → final expansions | Rejections |
|---|---:|---:|---:|---|
'''
for scene,walk in cases:
 b=next(w for w in before['walks'] if w['scene']==scene and w['walk']==walk);a=next(w for w in final['walks'] if w['scene']==scene and w['walk']==walk)
 residual=[]
 for run in ['28-before','28-final2']:
  log=json.load(open(base/run/scene/(walk+'.json'))); arrivals=[r['contact']['arrival'] for r in log if r['location']==log[0]['location'] and r['contact'].get('arrival')];residual.append(round(arrivals[-1]['distance'],2) if arrivals else 'none')
 text+=f"| {scene}/{walk} | {residual[0]} | {residual[1]} | {b['search']['expanded']} → {a['search']['expanded']} | [before](../sim/28-before/{scene}/{walk}-rejections.json), [after](../sim/28-final2/{scene}/{walk}-rejections.json) |\n"
for scene,walk in cases:text+=f'\n![{scene}/{walk} before and after](28-trajectories/{scene}-{walk}.png)\n'
text+='''
## Named arrival limitations

The following is the complete list beyond half stride, with actual reviewer ratios and full rejection histograms. These remain implementation limitations after pivot, support, first-stance and route-score attempts. No scenes were dropped. `nearest-reachable` means reachable in the bounded drawn-action graph, not proof of floor unreachability.

| Limitation | Half-stride multiples | Expanded | Outcome | Histogram |
|---|---:|---:|---|---|
'''
for w in final['walks']:
 ratio=w['halfStrideRatio']
 if ratio is not None and ratio>1:
  s=w['search'];text+=f"| L28-{w['scene']}-{w['walk']} | {ratio:.2f} | {s['expanded']} | {s['reason']} | [counts](../sim/28-final2/{w['scene']}/{w['walk']}-rejections.json) |\n"
text+='''
## Final verification

Pending final browser comparison and town replay. Regression evidence and final status will be appended here before delivery.
'''
report.write_text(text)
print(report)
