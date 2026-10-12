import json,subprocess,collections,math
from pathlib import Path
out=Path('tmp/walkqa/verification-06');frames=out/'failure-frames';frames.mkdir(exist_ok=True)
targets=json.loads((out/'targets.json').read_text());fail=[];speed=[]
meta={p.stem:json.loads(p.read_text()) for p in Path('adventures/shadow-over-innsmouth/public/assets/sprites/hermes').glob('*.json')}
for t in targets:
 clip=Path('tmp/walkqa/final-06')/(t['clip']+'.mp4');rows=json.loads(clip.with_suffix('.json').read_text());w=[r for r in rows if r['walking']];duration=len(w)/24
 switches=sum(a['texture']!=b['texture'] or meta[a['texture']]['contacts'][int(a['frame'])]['planted']!=meta[b['texture']]['contacts'][int(b['frame'])]['planted'] for a,b in zip(w,w[1:]));cadence=switches/duration if duration else 0
 issues=[]
 if duration<1:issues.append(f'walking {duration:.3f}s < 1s')
 if not 1.6<=cadence<=2.2:issues.append(f'cadence {cadence:.3f} outside 1.6–2.2')
 if t['requestedExit'] and not t['exitCompleted']:issues.append('requested exit did not transition')
 if not t['arrival'] and not(t['requestedExit'] and t['exitCompleted']):
  if t.get('transitioned'):issues.append(f'walk entered a physical exit before the target; {t["shortfall"]:.1f}px from endpoint')
  elif t['object']:issues.append('object approach ended without a recorded half-stride arrival')
  else:issues.append(f'natural stop without half-stride arrival; {t["shortfall"]:.1f}px from mask endpoint')
 seg=collections.defaultdict(lambda:[0.,0])
 for a,b in zip(w,w[1:]):
  ga,gb=a['contact'].get('ground'),b['contact'].get('ground')
  if not ga or not gb:continue
  d=math.hypot(gb['x']-ga['x'],gb['y']-ga['y'])
  if d>0.5:continue
  k=b['texture'];seg[k][0]+=d;seg[k][1]+=1
 for k,(d,n) in seg.items():
  if n>=12:speed.append({'clip':t['clip'],'cycle':k,'speed':d/(n/24)})
 if issues:
  idx=max((i for i,r in enumerate(rows) if r['walking']),default=0)
  png=frames/(t['clip'].replace('/','-')+f'-f{idx:04d}.png')
  subprocess.run(['ffmpeg','-y','-v','error','-i',str(clip),'-vf',f'select=eq(n\\,{idx})','-frames:v','1',str(png)],check=True)
  fail.append({**t,'issues':issues,'frame':idx,'framePath':str(png),'walkingSeconds':duration,'cadence':cadence})
(out/'open-findings.json').write_text(json.dumps(fail,indent=2));(out/'speed-segments.json').write_text(json.dumps(speed,indent=2))
for f in fail:print(f['clip']+': '+'; '.join(f['issues'])+'; '+f['framePath'])
