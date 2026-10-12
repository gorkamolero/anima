import json, math
from pathlib import Path
from PIL import Image,ImageDraw
ROOT=Path('tmp/walkqa/proof-11'); SPR=Path('adventures/shadow-over-innsmouth/public/assets/sprites/hermes')
meta={p.stem:json.loads(p.read_text()) for p in SPR.glob('*.json') if not p.name.endswith('manifest.json')}
results=[]
for scene in ['road','depot']:
 for p in sorted((ROOT/scene).glob('*.json')):
  if p.name.endswith('partial.json'): continue
  rows=json.loads(p.read_text())
  if not isinstance(rows,list) or not rows or 'contact' not in rows[0]:continue
  end=next((i for i,r in enumerate(rows) if i>5 and not r['walking']),len(rows)-1)
  final=rows[end]; source=sorted(p.with_name(p.stem+'-frames').glob('*.png'))
  if not source:continue
  ix=list(range(max(0,end-5),end+1));s=final['scale'];h=1059*s
  x0=int(min(rows[i]['x'] for i in ix)-612*s/2-20);x1=int(max(rows[i]['x'] for i in ix)+612*s/2+20)
  y0=int(min(rows[i]['y']-1059*rows[i]['scale'] for i in ix)-8);y1=int(max(rows[i]['y'] for i in ix)+15)
  w,hh=(x1-x0)*2,(y1-y0)*2
  out=Image.new('RGB',(w*3,(hh+28)*2),'#222')
  for j,i in enumerate(ix):
   crop=Image.open(source[i]).crop((x0,y0,x1,y1)).resize((w,hh),Image.Resampling.NEAREST)
   out.paste(crop,((j%3)*w,(j//3)*(hh+28)+28));ImageDraw.Draw(out).text(((j%3)*w+5,(j//3)*(hh+28)+5),f'{scene} {p.stem} frame {i}'+(' STANDING' if i==end else ''))
  out.save(p.with_name(p.stem+'-last6-2x.png'))
  maximum=0
  for row in rows:
   foot=row['contact']['planted'];anchor=row['contact']['anchor']
   for pose in [row]+([row['blend']] if row.get('blend') else []):
    m=meta[pose['texture']];c=m['contacts'][pose['frame']][foot]
    x=pose['x']+(c['x']-m['frameWidth']/2)*pose['scale']*(-1 if pose['flip'] else 1)
    y=pose['y']+(c['y']-m['frameHeight'])*pose['scale'];maximum=max(maximum,math.hypot(x-anchor['x'],y-anchor['y']))
  results.append({'scene':scene,'clip':p.stem,'finalHeading':final['contact']['heading'],'standing':final['texture'],'flip':final['flip'],'stopFrame':end,'maxAnchorErrorIncludingBlend':maximum,'settleFrames':sum(1 for r in rows if r['contact'].get('transition',{}).get('stopping'))})
(ROOT/'results.json').write_text(json.dumps(results,indent=2)+'\n');print(json.dumps(results,indent=2))
