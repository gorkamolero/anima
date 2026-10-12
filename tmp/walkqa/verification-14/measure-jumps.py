"""Measure the actual rendered cut transforms; includes entry, not later stop, for starts."""
import json,math
from pathlib import Path
import numpy as np
from PIL import Image,ImageDraw
ROOT=Path('tmp/walkqa/proof-14');SPR=Path('adventures/shadow-over-innsmouth/public/assets/sprites/hermes')
meta={p.stem:json.loads(p.read_text()) for p in SPR.glob('*.json') if not p.name.endswith('manifest.json')};cache={};table=[];acceptance={'frames':0,'alphaHistogramMismatches':[],'badAlpha':[],'unmatchedCuts':[],'maxAnchorError':0.,'clips':[]}
def sprite(r):
 key=(r['texture'],r['frame'])
 if key not in cache:
  m=meta[key[0]];w,h=m['frameWidth'],m['frameHeight'];i=key[1];im=Image.open(SPR/m['image']).convert('RGBA');cache[key]=im.crop((i%m['cols']*w,i//m['cols']*h,(i%m['cols']+1)*w,(i//m['cols']+1)*h))
 return cache[key]
def center(r,lo,hi):
 im=sprite(r);a=np.array(im.getchannel('A'));ys=np.where(a>127)[0];t,b=ys.min(),ys.max()+1;y0,y1=int(t+(b-t)*lo),int(t+(b-t)*hi);ww=a[y0:y1].astype(float);yy,xx=np.indices(ww.shape);x=(ww*xx).sum()/ww.sum();y=(ww*(yy+y0)).sum()/ww.sum();return np.array([r['x']+(x-im.width/2)*r['scale']*(-1 if r['flip'] else 1),r['y']+(y-im.height)*r['scale']])
def layer(r,box):
 im=sprite(r)
 if r['flip']:im=im.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
 size=(round(im.width*r['scale']*2),round(im.height*r['scale']*2));im=im.resize(size,Image.Resampling.LANCZOS)
 out=Image.new('RGBA',((box[2]-box[0])*2,(box[3]-box[1])*2));out.alpha_composite(im,(round((r['x']-box[0])*2-size[0]/2),round((r['y']-box[1])*2-size[1])));return out
def sole(r,foot):
 m=meta[r['texture']]
 if 'bootSoles' in m:q=m['bootSoles'][r['frame']][foot]
 else:q=m['reviewedFreeBootSoles'][str(r['frame'])][foot]
 return np.array([r['x']+(q['x']-m['frameWidth']/2)*r['scale']*(-1 if r['flip'] else 1),r['y']+(q['y']-m['frameHeight'])*r['scale']])
def lower_iou(a,b,walk,box):
 alpha=np.array(sprite(walk).getchannel('A'));ys=np.where(alpha>127)[0];hip=ys.min()+.62*(ys.max()+1-ys.min())
 screen_y=walk['y']+(hip-sprite(walk).height)*walk['scale'];y=max(0,round((screen_y-box[1])*2))
 aa=np.array(a.getchannel('A'))[y:]>127;bb=np.array(b.getchannel('A'))[y:]>127
 return float((aa&bb).sum()/max(1,(aa|bb).sum()))
for scene in ['road','depot','starts']:
 for p in sorted((ROOT/scene).glob('*.json')):
  if p.name.endswith('partial.json'):continue
  rows=json.loads(p.read_text())
  if not isinstance(rows,list) or not rows or 'contact' not in rows[0]:continue
  stop=next((i for i in range(1,len(rows)) if rows[i-1]['walking'] and not rows[i]['walking']),None)
  cut=1 if scene=='starts' else stop
  if cut is None:raise ValueError('No stop '+str(p))
  before,after=rows[cut-1],rows[cut];walk=after if scene=='starts' else before
  distances=[float(np.linalg.norm(center(before,*region)-center(after,*region))) for region in [(0,.23),(.25,.62)]]
  rec={'scene':scene,'heading':p.stem,'kind':'start' if scene=='starts' else 'stop','cutFrames':[cut-1,cut],'walkFrame':walk['frame'],'support':after['contact']['planted'],'headScreenPx':distances[0],'torsoScreenPx':distances[1],'within4px':max(distances)<=4,'beforeTexture':before['texture'],'afterTexture':after['texture'],'beforeScale':before['scale'],'afterScale':after['scale'],'cut':after['contact'].get('cut')};table.append(rec)
  box=(math.floor(min(r['x']-sprite(r).width/2*r['scale'] for r in [before,after]))-5,math.floor(min(r['y']-sprite(r).height*r['scale'] for r in [before,after]))-5,math.ceil(max(r['x']+sprite(r).width/2*r['scale'] for r in [before,after]))+5,math.ceil(max(r['y'] for r in [before,after]))+5)
  a,b=layer(before,box),layer(after,box)
  free='R' if rec['support']=='L' else 'L'
  free_px=float(np.linalg.norm(sole(before,free)-sole(after,free)))
  rec.update(lowerBodyIoU=lower_iou(a,b,walk,box),freeFootScreenPx=free_px,withinTargets=rec['within4px'] and free_px<=8)
  out=Image.new('RGB',(a.width*3,a.height+40),'#505058');draw=ImageDraw.Draw(out)
  for k,(label,im) in enumerate([('BEFORE',a),('AFTER',b),('DEBUG OVERLAY ONLY',Image.blend(a,b,.5))]):
   bg=Image.new('RGBA',a.size,'#828282');bg.alpha_composite(im);out.paste(bg.convert('RGB'),(k*a.width,40));draw.text((k*a.width+5,5),label,fill='white')
  draw.text((5,22),f'{scene}/{p.stem} head {distances[0]:.2f}px torso {distances[1]:.2f}px legs IoU {rec["lowerBodyIoU"]:.3f} free boot {free_px:.2f}px; 2x',fill='white');out.save(p.with_name(p.stem+'-cut-overlay-2x.png'))
  for i,r in enumerate(rows):
   acceptance['frames']+=1
   if not r.get('alphaAudit') or r['alphaAudit']['rendered']!=r['alphaAudit']['normal']:acceptance['alphaHistogramMismatches'].append([scene,p.stem,i])
   if r['alpha']!=1 or r.get('blend'):acceptance['badAlpha'].append([scene,p.stem,i])
   if r['contact'].get('cut',{}).get('matched') is False:acceptance['unmatchedCuts'].append([scene,p.stem,i])
   foot=r['contact']['planted'];anchor=r['contact']['anchor'];m=meta[r['texture']];c=m['contacts'][r['frame']][foot]
   x=r['x']+(c['x']-m['frameWidth']/2)*r['scale']*(-1 if r['flip'] else 1);y=r['y']+(c['y']-m['frameHeight'])*r['scale'];acceptance['maxAnchorError']=max(acceptance['maxAnchorError'],math.hypot(x-anchor['x'],y-anchor['y']))
  acceptance['clips'].append({'scene':scene,'heading':p.stem,'frames':len(rows),'stopFrame':stop})
(ROOT/'jumps.json').write_text(json.dumps(table,indent=2)+'\n');Path('tmp/walkqa/verification-14/acceptance.json').write_text(json.dumps(acceptance,indent=2)+'\n')
print(json.dumps(table,indent=2));print(json.dumps(acceptance,indent=2))
