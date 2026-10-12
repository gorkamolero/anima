"""Supplement the unchanged reviewer summary with depth-matched video samples."""
from pathlib import Path
import collections,json,math
root=Path('tmp/walkqa/final-07');out=Path('tmp/walkqa/verification-07')
groups=collections.defaultdict(lambda:[0.,0,[]])
for p in sorted(root.glob('*/*.json')):
 rows=json.loads(p.read_text())
 if not isinstance(rows,list) or not rows or 'contact' not in rows[0]:continue
 for i,(a,b) in enumerate(zip(rows,rows[1:]),1):
  if not(a['walking'] and b['walking']) or a['texture']!=b['texture']:continue
  ga,gb=a['contact'].get('ground'),b['contact'].get('ground')
  if not ga or not gb:continue
  d=math.hypot(gb['x']-ga['x'],gb['y']-ga['y'])
  if d>.5:continue
  depth=int((a['y']+b['y'])/2//40)*40
  cycle=b['texture'].replace('hermes-','').replace('fal-veo-transparent-loop','side')
  g=groups[(p.parent.name,depth,cycle)];g[0]+=d;g[1]+=1;g[2].append([str(p.relative_to(root)),i])
result=[]
for (scene,y,cycle),(d,n,frames) in sorted(groups.items()):
 side=groups.get((scene,y,'side'))
 if n<24 or not side or side[1]<24:continue
 speed=d/(n/24);ref=side[0]/(side[1]/24)
 result.append(dict(scene=scene,yRange=[y,y+40],cycle=cycle,samples=n,speed=speed,side=ref,ratio=speed/ref,evidence=frames[len(frames)//2]))
(out/'depth-speed.json').write_text(json.dumps(result,indent=2))
print('40px body-depth bins; same-cycle adjacent walking frames, >=24 pairs each; mean ground speed (not per-clip median).')
for r in result:
 print(f'{r["scene"]:14s} y={r["yRange"]!s:12s} {r["cycle"]:20s} {r["speed"]:.3f} m/s side={r["side"]:.3f} ratio={r["ratio"]:.3f} n={r["samples"]} evidence={r["evidence"]}')
