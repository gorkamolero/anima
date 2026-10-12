"""Brief 12 evidence builder. Does not modify reviewer-owned tools."""
import json, math, hashlib
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw
ROOT=Path('tmp/walkqa/proof-13'); SPR=Path('adventures/shadow-over-innsmouth/public/assets/sprites/hermes')
meta={p.stem:json.loads(p.read_text()) for p in SPR.glob('*.json') if not p.name.endswith('manifest.json')}
images={}; results=[]; histogram_rows=[]
def sprite(row):
 key=(row['texture'],row['frame'])
 if key not in images:
  m=meta[key[0]];w,h=m['frameWidth'],m['frameHeight'];i=key[1]
  im=Image.open(SPR/m['image']).convert('RGBA')
  images[key]=im.crop((i%m['cols']*w,i//m['cols']*h,(i%m['cols']+1)*w,(i//m['cols']+1)*h))
 return images[key]
def sheet(p,rows,source,ix,suffix):
 x0=int(min(rows[i]['x']-meta[rows[i]['texture']]['frameWidth']*rows[i]['scale']/2 for i in ix)-15)
 x1=int(max(rows[i]['x']+meta[rows[i]['texture']]['frameWidth']*rows[i]['scale']/2 for i in ix)+15)
 y0=int(min(rows[i]['y']-meta[rows[i]['texture']]['frameHeight']*rows[i]['scale'] for i in ix)-8)
 y1=int(max(rows[i]['y'] for i in ix)+12)
 w,h=(x1-x0)*2,(y1-y0)*2;out=Image.new('RGB',(w*3,(h+28)*2),'#222')
 for j,i in enumerate(ix):
  crop=Image.open(source[i]).crop((x0,y0,x1,y1)).resize((w,h),Image.Resampling.NEAREST)
  out.paste(crop,((j%3)*w,(j//3)*(h+28)+28))
  r=rows[i];ImageDraw.Draw(out).text(((j%3)*w+5,(j//3)*(h+28)+5),f'{p.parent.name} {p.stem} #{i} {r["texture"].replace("hermes-", "")}:{r["frame"]}',fill='white')
 out.save(p.with_name(p.stem+suffix))
for scene in ['road','depot','starts']:
 for p in sorted((ROOT/scene).glob('*.json')):
  if p.name.endswith('partial.json'):continue
  rows=json.loads(p.read_text())
  if not isinstance(rows,list) or not rows or 'contact' not in rows[0]:continue
  source=sorted(p.with_name(p.stem+'-frames').glob('*.png'))
  if not source:continue
  end=next((i for i,r in enumerate(rows) if i>5 and not r['walking']),len(rows)-1)
  ix=list(range(max(0,end-5),end+1));sheet(p,rows,source,ix,'-last6-2x.png')
  if scene=='starts':sheet(p,rows,source,list(range(6)),'-first6-2x.png')
  bad_alpha=[i for i,r in enumerate(rows) if r['alpha']!=1 or r.get('blend')]
  maximum=0
  for row in rows:
   foot=row['contact']['planted'];anchor=row['contact']['anchor'];m=meta[row['texture']];c=m['contacts'][row['frame']][foot]
   x=row['x']+(c['x']-m['frameWidth']/2)*row['scale']*(-1 if row['flip'] else 1)
   y=row['y']+(c['y']-m['frameHeight'])*row['scale'];maximum=max(maximum,math.hypot(x-anchor['x'],y-anchor['y']))
  check=sorted(set(ix+(list(range(6)) if scene=='starts' else [])))
  for i in check:
   r=rows[i];a=np.array(sprite(r).getchannel('A'));base=np.array(r['alphaAudit']['normal']) if r.get('alphaAudit') else np.bincount(a.ravel(),minlength=256)
   actual=np.array(r['alphaAudit']['rendered']) if r.get('alphaAudit') else np.bincount(np.rint(a.astype(float)*r['alpha']).astype('uint8').ravel(),minlength=256)
   histogram_rows.append({'scene':scene,'clip':p.stem,'frame':i,'texture':r['texture'],'sourceFrame':r['frame'],'spriteAlpha':r['alpha'],'blend':r.get('blend'),'renderedAudit':bool(r.get('alphaAudit')),'normalHistogram':base.tolist(),'transitionHistogram':actual.tolist(),'equalToNormal':bool(np.array_equal(base,actual)),'sha256':hashlib.sha256(a.tobytes()).hexdigest()})
  last=rows[end-1];m=meta[last['texture']];cut=m.get('matchedCut',{});metrics=next((r for r in cut.get('metrics',[]) if r['frame']==last['frame']),None)
  entry=next((r for r in rows if r['walking'] and not r['contact'].get('settling')),None)
  results.append({'scene':scene,'clip':p.stem,'heading':rows[end]['contact']['heading'],'cutFrame':end,'exitFrame':last['frame'],'precomputedExit':last['frame'] in cut.get('exitFrames',[]),'match':metrics,'screenScale':last['scale'],'screenHeadPx':metrics['headPx']*last['scale'] if metrics else None,'screenTorsoPx':metrics['torsoPx']*last['scale'] if metrics else None,'entryHeading':entry['contact']['heading'] if entry else None,'entryFrame':entry['frame'] if entry else None,'entryPrecomputed':entry['frame'] in meta[entry['texture']].get('matchedCut',{}).get('entryFrames',[]) if entry else False,'cut':rows[end]['contact'].get('cut'),'maxAnchorError':maximum,'badAlphaFrames':bad_alpha})
(ROOT/'results.json').write_text(json.dumps(results,indent=2)+'\n')
(ROOT/'alpha-histograms.json').write_text(json.dumps(histogram_rows,separators=(',',':'))+'\n')
print(json.dumps(results,indent=2))
