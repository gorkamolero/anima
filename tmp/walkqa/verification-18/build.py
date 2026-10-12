"""Build drawn sheets and mirrored review sheets; install only the accepted away pair."""
import copy,importlib.util,json,hashlib
from pathlib import Path
from PIL import Image,ImageDraw
import numpy as np
ROOT=Path('tmp/walkqa/verification-18');SPR=Path('adventures/shadow-over-innsmouth/public/assets/sprites/hermes')
spec=importlib.util.spec_from_file_location('key','packages/sprite-tools/scripts/matched-standing.py');k=importlib.util.module_from_spec(spec);spec.loader.exec_module(k)
records=json.loads(Path('tmp/walkqa/verification-16b/sources.json').read_text())
for h in ['side','away-right']:
 r=next(r for r in records if r['heading']==h);d=ROOT/h
 frames=[Image.open(Path('tmp/walkqa/verification-16b/sources')/(h+'-first-alpha.png')).convert('RGBA'),Image.open(d/'A-1/registered-alpha.png'),Image.open(d/('B-2' if h=='side' else 'B-1')/'registered-alpha.png')]
 w,hgt=frames[0].size;cycle=json.loads((SPR/(r['cycle']+'.json')).read_text());contact=copy.deepcopy(r['contact']);contact.update(cycle['reviewedFreeBootSoles'][str(r['frame'])]);contacts=[copy.deepcopy(contact),copy.deepcopy(contact),copy.deepcopy(contact)]
 free='L' if contact['planted']=='R' else 'R';contacts[2][free]={'x':286 if h=='side' else 368,'y':1011 if h=='side' else 1034}
 status='REJECTED: planted boot redrawn, upper-body seam exceeds 4px' if h=='side' else 'candidate accepted by eye; runtime verification pending'
 sheet=Image.new('RGBA',(w*3,hgt))
 for i,frame in enumerate(frames):sheet.paste(frame,(i*w,0));frame.save(d/f'frame-{i}.png')
 sheet.save(d/'stop-sheet.png')
 meta=dict(name='candidate-'+h,image='stop-sheet.png',frameWidth=w,frameHeight=hgt,frameCount=3,cols=3,rows=1,fps=24,contacts=contacts,switchFrames=[],status=status,sourceFrame=r['frame'],reference=r['cycle'])
 (d/'stop-sheet.json').write_text(json.dumps(meta,indent=2)+'\n')
 for mirror in [False,True]:
  review=Image.new('RGB',(w*3,hgt+42),(128,128,128));draw=ImageDraw.Draw(review)
  for i,frame in enumerate(frames):
   if mirror:frame=frame.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
   review.paste(frame,(i*w,42),frame);draw.text((i*w+10,8),['EXIT','A: ARMS','B: REST'][i],fill='white')
   for foot,q in contacts[i].items():
    if foot=='planted':continue
    x=(w-1-q['x'] if mirror else q['x'])+i*w;y=q['y']+42
    draw.ellipse((x-4,y-4,x+4,y+4),fill='cyan' if foot==contact['planted'] else 'yellow')
  draw.text((10,24),status,fill='white');review.save(d/('review-mirrored.png' if mirror else 'review.png'))
 if h=='away-right':
  name='hermes-passing-stand-away-right';installed=Image.new('RGBA',sheet.size)
  for i,frame in enumerate(reversed(frames)):installed.paste(frame,(i*w,0))
  installed.save(SPR/(name+'.png'))
  m={**meta,'name':name,'image':name+'.png','contacts':list(reversed(contacts)),'bootSoles':[{f:q for f,q in c.items() if f!='planted'} for c in reversed(contacts)],'settleFrames':[2,1,0], 'normalization':{'reference':r['cycle'],'sourceFrame':r['frame'],'method':'fixed provider raster to walk-canvas conversion, integer translation only; local grey key', 'registration':[json.loads((d/(step+'-1')/'registration.json').read_text()) for step in ['A','B']]}}
  m.pop('status');(SPR/(name+'.json')).write_text(json.dumps(m,indent='\t')+'\n')
# This before/after is labelled candidate, so the rejected side cannot be mistaken for shipped art.
before=Image.open('tmp/walkqa/logs/stands15.png');out=Image.new('RGB',(before.width,1020),'#686868');out.paste(before,(0,22));draw=ImageDraw.Draw(out);draw.text((10,5),'BEFORE: stands15.png (all five brief-15 poses)',fill='white')
for i,h in enumerate(['side','away-right']):
 frame=Image.open(ROOT/h/'frame-2.png');frame.thumbnail((300,480));out.paste(frame,(i*420+60,540),frame);draw.text((i*420+20,520),h+(' REJECTED' if h=='side' else ' DRAWN REST'),fill='white')
draw.text((850,600),'Away / toward / toward-right unchanged.',fill='white');out.save(ROOT/'before-after.png')
print('Sheets built; away-right installed, side rejected and not installed.')
