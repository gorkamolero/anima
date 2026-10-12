"""Brief 18: audit every drawn seam, including reverse starts, using brief-15 projections."""
from pathlib import Path
helper=Path('tmp/walkqa/verification-15/measure-jumps.py').read_text().split("for scene in ['road','depot','starts']:")[0]
exec(compile(helper,'brief15-projection-helpers','exec'))
ROOT=Path('tmp/walkqa/proof-18');OUT=Path('tmp/walkqa/verification-18');table=[];clips=[];arrivals=[];acceptance={'frames':0,'badAlpha':[],'alphaHistogramMismatches':[],'maxAnchorError':0.,'unmatchedCuts':[]}
def walking_asset(r):return bool(meta[r['texture']].get('matchedCut'))
def same(a,b):return (a['texture'],a['frame'],a['flip'])==(b['texture'],b['frame'],b['flip'])
for scene in ['road','depot','starts']:
 for p in sorted((ROOT/scene).glob('*.json')):
  rows=json.loads(p.read_text())
  if not isinstance(rows,list) or not rows or 'contact' not in rows[0]:continue
  end=next((i for i in range(1,len(rows)) if rows[i-1]['walking'] and not rows[i]['walking']),None)
  if end is None:raise ValueError('No stop '+str(p))
  if scene=='starts':
   final=next(i for i,r in enumerate(rows) if walking_asset(r));ix=[0]+[i for i in range(1,final+1) if not same(rows[i-1],rows[i])]
  else:
   final=end;first=max(i for i in range(end) if walking_asset(rows[i]));ix=[first]+[i for i in range(first+1,end+1) if not same(rows[i-1],rows[i])]
  source=sorted(p.with_name(p.stem+'-frames').glob('*.png'))
  reviewix=sorted(set(max(0,i-1) for i in ix[1:])|set(ix))
  if scene!='starts':reviewix=sorted(set(reviewix+list(range(max(0,end-5),end+1))))
  else:reviewix=list(range(min(len(rows),max(6,final+1))))
  x0=math.floor(min(r['x']-sprite(r).width/2*r['scale'] for r in [rows[i] for i in reviewix]))-8;x1=math.ceil(max(r['x']+sprite(r).width/2*r['scale'] for r in [rows[i] for i in reviewix]))+8;y0=math.floor(min(r['y']-sprite(r).height*r['scale'] for r in [rows[i] for i in reviewix]))-8;y1=math.ceil(max(rows[i]['y'] for i in reviewix))+8
  w,h=(x1-x0)*2,(y1-y0)*2;overview=Image.new('RGB',(w*3,(h+26)*math.ceil(len(reviewix)/3)),'#222');draw=ImageDraw.Draw(overview)
  for j,i in enumerate(reviewix):
   im=Image.open(source[i]).crop((x0,y0,x1,y1)).resize((w,h),Image.Resampling.NEAREST);overview.paste(im,((j%3)*w,(j//3)*(h+26)+26));draw.text(((j%3)*w+5,(j//3)*(h+26)+5),f'{scene}/{p.stem} #{i} {rows[i]["texture"]}:{rows[i]["frame"]}',fill='white')
  overview.save(p.with_name(p.stem+'-sequence-2x.png'))
  for n,i in enumerate(ix[1:]):
   before,after=rows[i-1],rows[i];distances=[float(np.linalg.norm(center(before,*region)-center(after,*region))) for region in [(0,.23),(.25,.62)]];foot=after['contact']['planted'];free='R' if foot=='L' else 'L';freepx=float(np.linalg.norm(sole(before,free)-sole(after,free)))
   rec=dict(scene=scene,heading=p.stem,seam=n,frames=[i-1,i],before=[before['texture'],before['frame']],after=[after['texture'],after['frame']],headScreenPx=distances[0],torsoScreenPx=distances[1],freeFootScreenPx=freepx,within4px=max(distances)<=4,scale=after['scale']);table.append(rec)
   box=(x0,y0,x1,y1);a,b=layer(before,box),layer(after,box);trip=Image.new('RGB',(w*3,h+38),'#808080');dr=ImageDraw.Draw(trip)
   for col,im in enumerate([a,b,Image.blend(a,b,.5)]):trip.paste(im,(col*w,38),im)
   dr.text((5,5),f'{scene}/{p.stem} seam {n}: head {distances[0]:.2f}, torso {distances[1]:.2f}, free boot {freepx:.2f} screen px',fill='white');dr.text((5,20),'BEFORE / AFTER / DIAGNOSTIC OVERLAY ONLY (2x)',fill='white');trip.save(p.with_name(p.stem+f'-seam-{n}-2x.png'))
  for i,r in enumerate(rows):
   acceptance['frames']+=1
   if r['alpha']!=1 or r.get('blend'):acceptance['badAlpha'].append([scene,p.stem,i])
   if not r.get('alphaAudit') or r['alphaAudit']['normal']!=r['alphaAudit']['rendered']:acceptance['alphaHistogramMismatches'].append([scene,p.stem,i])
   if r['contact'].get('unmatchedCut'):acceptance['unmatchedCuts'].append([scene,p.stem,i])
   foot=r['contact']['planted'];anchor=r['contact']['anchor'];m=meta[r['texture']];c=m['contacts'][r['frame']][foot];xx=r['x']+(c['x']-m['frameWidth']/2)*r['scale']*(-1 if r['flip'] else 1);yy=r['y']+(c['y']-m['frameHeight'])*r['scale'];acceptance['maxAnchorError']=max(acceptance['maxAnchorError'],math.hypot(xx-anchor['x'],yy-anchor['y']))
  r=rows[-1];a=r['contact'].get('arrival');actual=math.hypot(r['x']-a['target']['x'],r['y']-a['target']['y']) if a else None
  arrivals.append(dict(scene=scene,heading=p.stem,actualDistance=actual,halfStride=a['halfStride'] if a else None,withinHalfStride=bool(a and actual<=a['halfStride']+1e-6),predictionError=abs(actual-a['distance']) if a else None))
  clips.append(dict(scene=scene,heading=p.stem,finalHeading=r['contact']['heading'],seams=len(ix)-1,frames=len(rows),endsAtRestByEye=r['contact']['heading'] not in ['left','right']))
(ROOT/'jumps.json').write_text(json.dumps(table,indent=2)+'\n');(OUT/'acceptance.json').write_text(json.dumps(acceptance,indent=2)+'\n');(OUT/'arrivals.json').write_text(json.dumps(arrivals,indent=2)+'\n');(ROOT/'clips.json').write_text(json.dumps(clips,indent=2)+'\n')
print('clips',len(clips),'seams',len(table),'seams pass',sum(r['within4px'] for r in table),'max head/torso',max(r['headScreenPx'] for r in table),max(r['torsoScreenPx'] for r in table),'arrivals',sum(r['withinHalfStride'] for r in arrivals));print(json.dumps(acceptance))
