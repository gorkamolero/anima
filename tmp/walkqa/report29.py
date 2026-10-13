import json,pathlib,math,sys,collections
import numpy as np
from PIL import Image,ImageDraw,ImageFont
base=pathlib.Path('tmp/walkqa/sim');out=base/'29-facing';report=pathlib.Path('tmp/walkqa/reports/29-clean-routes.md')
ns={};exec(pathlib.Path('tmp/walkqa/analyze27.py').read_text().split('before=analyse(')[0],ns)
runs=['29-single','29-entries','29-corners','29-facing','29-confirm'];data={name:ns['analyse'](name) for name in runs};final=data['29-facing'];before=ns['analyse']('28-final2');(out/'diagnostics.json').write_text(json.dumps({'before':before,'after':final},indent=2))
plots=report.parent/'29-trajectories';plots.mkdir(exist_ok=True)
font=ImageFont.truetype('/System/Library/Fonts/Monaco.ttf',17)
cases=[('pier','near-right'),('pier','diagonal-away'),('road','far-right'),('lobby','far-right'),('inside','object'),('road','near-right'),('lobby','near-left'),('outside','far-right')]
for scene,walk in cases:
 panels=[]
 for run in ['28-final2','29-facing']:
  p=base/run/scene;rows=json.load(open(p/(walk+'.json')));area=json.load(open(p/'area.json'))['area'];im=Image.open(pathlib.Path('tmp/walkqa/harness-24')/scene/'background.png').convert('RGB').resize((960,540));im=Image.blend(im,Image.new('RGB',im.size,'#101820'),.35)
  raw=area['mask'];m=np.array(raw['data']).reshape(raw['height'],raw['width']);clear=area['clearanceMask'];cm=np.array(clear['data']).reshape(clear['height'],clear['width']);overlay=np.zeros((*m.shape,4),dtype=np.uint8);overlay[m>0]=[40,100,255,80];overlay[cm>0]=[30,230,80,90];im=Image.alpha_composite(im.convert('RGBA'),Image.fromarray(overlay).resize(im.size,Image.Resampling.NEAREST));d=ImageDraw.Draw(im)
  points=[(r['x']/2,r['y']/2) for r in rows if r['location']==rows[0]['location']];d.line(points,fill='#ff4444',width=3);x,y=points[0];d.ellipse((x-5,y-5,x+5,y+5),fill='white')
  t=next((r.get('target') for r in rows if r.get('target')),None)
  if t:x,y=t['x']/2,t['y']/2;d.ellipse((x-7,y-7,x+7,y+7),outline='yellow',width=3)
  panel=Image.new('RGB',(960,585),'#111827');panel.paste(im,(0,45));ImageDraw.Draw(panel).text((12,10),f'{scene}/{walk} | {run} | body trajectory',font=font,fill='white');panels.append(panel)
 board=Image.new('RGB',(1920,585));board.paste(panels[0],(0,0));board.paste(panels[1],(960,0));board.save(plots/(scene+'-'+walk+'.png'))
text='''# Brief 29 — clean routes

**Not accepted: route enforcement improves, but arrivals regress substantially.** The final simulator has 43/132 arrivals within half a stride and 66/132 within one stride, versus 103/128 and 113/128 in brief 28. Seven scene transfers are excluded from the arrival denominator (28: eleven). All 139 walks retain arrival records. No scenes or walks were removed. This is not completion of `docs/FOOTFALL-GOAL.md`.

Branch `open-world-mvp`; starting commit `39f40c8`. Read the goal, brief 28 report, the improved reviewer, and `git log -10`. Existing changes to `calls.md`, reviewer `walkstats.py`, and untracked `AgentDebug.test.ts` were preserved. No reviewer tool was edited.

## Production changes

- One search owns a click. Removed the up-to-eight stand-and-pivot continuations that reset run/reversal/turn budgets. Standing pivots are offered only at the initial state; playback contains one final stop, never a restart pivot mid-plan.
- `minHeadingRun: 2` rejects turns out of a one-stance middle run in search, including the stop edge. First and final runs may have one stance. Heading history is part of duplicate detection, so successive legal small turns cannot silently produce a cumulative reversal.
- Compute the eight-connected shortest route once on the clearance mask, with visibility string pulling and >25° corners, using the reviewer's 1.4142 diagonal cost and ties-to-even line sampling. Actual stance collision checks remain conservative. A corner can reset the heading envelope once, within 0.6 ground metres, when the new heading is within 45° of the route's outgoing direction. The overall budget is `2 + 2 × corners`; only reached corners release their extra budget. Immediate turns over 120° remain forbidden even at corners.
- Explore all valid entry phases instead of the first valid phase. A single fixed 12,000-node budget replaces independent 4,000-node continuation budgets. Every rejected branch remains in the histogram. Search is deterministic in the simulator and browser worker.
- All entry and exit stances use the 30° facing limit; removed the earlier 35° first/last-stance tolerance. All measured walking stances agree within the reviewer's 30° limit.
- Arrival half-stride comes from a full authored support interval at arrival depth, without collision rejection or a two-pixel floor. A blocked hypothetical next step and a short exit fragment cannot shrink the measurement. This corrects telemetry; it does not move those four unreachable arrivals.

Unit tests cover the middle-run rule, cumulative reversal, corner location and one-use allowance, heading budget including the stop edge, start-only pivot enumeration, motor pivot/stop structure, entry alternatives, shortest-route corner extraction, and collision-independent authored stride measurement.

## Simulator and unchanged reviewer gates

Every retained completed simulator run invoked `facing_stance.py` (including `route_corners`), `arrival_vs_standable.py`, `lockcheck.py`, and `walkstats.py`, through [review29.py](../review29.py). An early corner-refactor syntax error produced no completed corpus; it was fixed before the retained `29-corners` run. No browser was used during the simulator iterations.

| Run | Half stride | Within one stride | Beyond one stride | Facing | Flicker walks | Reversal walks | Max lock px | Off-floor / object contacts |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
'''
for n,half,one,beyond,denom,lock,off in [('26',12,26,90,116,59.63,'nonzero / 0'),('27',27,44,74,118,0,'0 / 0'),('28',103,113,15,128,1.32,'0 / 0')]:
 p=out/'validation'/('facing-'+n+'.json');f=json.load(open(p));text+=f"| Brief {n} | {half}/{denom} | {one}/{denom} | {beyond} | {f['passed']}/139 | {f['flicker']} | {f['reversals']} | {lock} | {off} |\n"
for name in runs:
 a=data[name];r=json.load(open(base/name/'review29.json'));f=[w['facing'] for w in r];stats=[l.split() for l in open(base/name/'walkstats.log') if '.json' in l];denom=a['hasArrival']-a['travelled'];text+=f"| [{name}](../sim/{name}/gates.log) | {a['halfStride']}/{denom} | {a['oneStride']}/{denom} | {a['beyondStride']} | {sum(w['pass_'] for w in f)}/139 | {sum(bool(w['flicker']) for w in f)} | {sum(bool(w['reversals']) for w in f)} | {max(w['lock']['maxExcursion_px'] or 0 for w in r)} | {sum(int(v[3].split('/')[0]) for v in stats)} / {sum(int(v[-1]) for v in stats)} |\n"
text+='''
The historical facing columns were freshly recomputed with the improved reviewer, not copied from the older 26/27 reports. Historical arrival/safety columns retain their reported definitions and original stride telemetry. Final source: [review29.json](../sim/29-facing/review29.json), [arrival gate](../sim/29-facing/arrival_vs_standable.log), [walkstats](../sim/29-facing/walkstats.log), [diagnostics and full histograms](../sim/29-facing/diagnostics.json).

The unchanged full-walk facing gate remains **120/139**, not a universal pass. Its three remaining flicker flags are inside/exit-bus_platform, road/exit-far, and alley/exit-far: each joins an outgoing plan's final run to a new scene's first run. Each scene's plan separately has zero flicker and zero reversals. Those supplemental per-scene checks do not override the full-walk gate. Other failures include zero-walking-stance stops and heading budgets computed over completed/partial trajectories or concatenated scene transfers. Two reviewer-style stuck starts remain. The source rules are per plan; the report does not silently exempt any walk.

## Requested arrival misses and named limitations

All five requested cases remain **implementation limitations**, not proofs of geometric unreachability. Removing restart pivots exposes much larger misses in lobby/far-right and some other formerly improving walks. The phase-search and strict-corner iterations did not solve these. Plots show brief 28 on the left and the final result on the right: white start, red body trajectory, yellow target, blue raw floor, green clearance.

| Named limitation | 28 → 29 residual to nearest standable px | Final half-stride px | Expanded nodes | Dominant rejection categories | Evidence |
|---|---:|---:|---:|---|---|
'''
for scene,walk in cases:
 a=next(w for w in final['walks'] if w['scene']==scene and w['walk']==walk);b=next(w for w in before['walks'] if w['scene']==scene and w['walk']==walk);hist=json.load(open(out/scene/(walk+'-rejections.json')))['rejections'];top=', '.join(f'{k}: {v}' for k,v in sorted(hist.items(),key=lambda kv:-kv[1])[:4]);text+=f"| L29-{scene}-{walk} | {b['standableDistancePx']:.1f} → {a['standableDistancePx']:.1f} | {a['halfStridePx']:.2f} | {a['search']['expanded']} | {top} | [histogram](../sim/29-facing/{scene}/{walk}-rejections.json), [trajectory](29-trajectories/{scene}-{walk}.png) |\n"
text+='''
The four previously degenerate half-strides are now: inside/unreachable **65.47 px**, alley/unreachable **55.27 px**, pier/unreachable **79.98 px**, grocery/unreachable **72.29 px** (previously 2 px each). Their anchors are unchanged. These count as telemetry corrections, not four arrival-motion fixes.

### Complete residual limitation inventory

Every final residual beyond half a stride is named below, including regressions. `nearest-reachable` describes the bounded action search, not floor connectivity.

| Limitation | Half-stride multiples | Distance px | Search outcome | Histogram |
|---|---:|---:|---|---|
'''
for w in final['walks']:
 if w['halfStrideRatio'] is not None and w['halfStrideRatio']>1:
  text+=f"| L29-{w['scene']}-{w['walk']} | {w['halfStrideRatio']:.2f} | {w['standableDistancePx']:.1f} | {w['search']['reason']} | [counts](../sim/29-facing/{w['scene']}/{w['walk']}-rejections.json) |\n"
text+='\n## Final browser and regression verification\n\n- **8/8 browser equivalence PASS**: outside, inside, road, alley × near-left/near-right, with exact equality of every logged field, **zero differences and maximum numeric difference 0**. [Comparison](../equivalence-29/diff-report.json), [captured-source audit](../sim/29-facing/validation/browser-source-audit.json). MP4s and contact sheets accompany the logs. The first outside walk was recaptured after the final generic planner-key change; all eight final captures match current source hashes.\n- The final `29-confirm` simulator run matches **all 139 frame logs byte-for-byte** against `29-facing`, with all four gates rerun. [Confirmation](../sim/29-facing/validation/confirmation.json), [confirmation gates](../sim/29-confirm/gates.log). This confirms that retaining first-run state in the generic unconstrained planner did not change the measured motor plans.\n- **498 tests / 53 files PASS**, typecheck PASS, lint PASS, **`verify:art --generated` all scenes PASS**. [Tests](../sim/29-facing/validation/tests.log), [typecheck](../sim/29-facing/validation/typecheck.log), [lint](../sim/29-facing/validation/lint.log), [art](../sim/29-facing/validation/art.log).\n- **Town replay 133 FAIL**, on the first depot-left walk: residual **73.1289 px**, reported full authored half-stride **72.8098 px**. It never completed the town circuit. [Failure record](../sim/29-facing/validation/town-133.json), [log](../sim/29-facing/validation/town.log). This remains an explicit acceptance blocker, not a passed replay. Its ledger window recorded **12 cached / 0 uncached calls** (overlapping other QA checks).\n- The initial QA launch omitted `/api` from `VITE_API_BASE_URL`, so restore/save requests returned 404; the launch environment was corrected. An initial use of the generic render runner lacked required frame counts and produced no proof clips. Both were superseded by the existing exact-equivalence harness, with complete fresh captures. No dotenv file changed.\n- Final brief-29 call audit: **100 cached / 0 uncached calls**. The API child had provider credentials absent, and the existing network guard blocked external fetch/HTTP. [Audit](../sim/29-facing/validation/call-audit.json).\n- QA browser sessions closed. **API 4317 and game 8080 stopped**, verified no listeners. Owner ports **4410/8090 were untouched**. [Port check](../sim/29-facing/validation/stopped-ports.json). Task-created probes, unused capture plans, empty frame staging and scratch formatting/test logs were removed; simulator runs, verification logs, videos and plots are retained.\n- Production commits: `d263569` route/history search rules; `748dc7f` one continuous motor plan and authored stride telemetry; `68edbe0` strict entry/exit facing and single-search budget; `382934c` first-run duplicate state and alternative-entry test. Every commit carries the requested co-author trailer. [Final production source hashes](../sim/29-facing/validation/source-sha256.json).\n\nSupplemental per-location analysis reports **146 scene segments, zero flicker, zero reversals, zero agreement failures, eight zero-stance segments and four change-limit failures**. [Segment evidence](../sim/29-facing/validation/location-facing.json). It does not replace the unchanged 120/139 whole-walk facing result.\n\nNo paid calls, push, merge, deployment, GitHub settings change, key write, dotenv edit, asset generation, or reviewer-tool edit was performed. Full Footfall path/scale/depth/video and visual sign-off are not recertified by these four gates or eight browser walks. The arrival regression and failed town replay keep this brief and the overall goal unaccepted.\n'

report.write_text(text);print(report)
