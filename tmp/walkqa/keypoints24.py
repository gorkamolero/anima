"""Independent alpha-distance audit at every planted sole; complements raw kpcheck.
This cannot prove feature identity through an overlapping boot; reports that limit.
"""
import json,pathlib,cv2,numpy as np
from PIL import Image,ImageDraw
root=pathlib.Path('adventures/shadow-over-innsmouth/public/assets/sprites/hermes');out=pathlib.Path('tmp/walkqa/harness-24/art');results=[]
for name in ['hermes-fal-veo-transparent-loop','hermes-walk-away','hermes-walk-toward','hermes-walk-away-right','hermes-walk-toward-right']:
 m=json.loads((root/(name+'.json')).read_text());im=Image.open(root/m['image']);w,h=m['frameWidth'],m['frameHeight'];rows=[]
 for i,c in enumerate(m['contacts']):
  tile=im.crop((i%m['cols']*w,i//m['cols']*h,(i%m['cols']+1)*w,(i//m['cols']+1)*h));a=np.array(tile.getchannel('A'))>127;distance=cv2.distanceTransform((~a).astype('uint8'),cv2.DIST_L2,cv2.DIST_MASK_PRECISE);q=c[c['planted']];x,y=round(q['x']),round(q['y']);error=float(distance[y,x]) if 0<=x<w and 0<=y<h else 999
  rows.append(dict(frame=i,foot=c['planted'],distanceToOpaquePixel=error))
  if error>5:
   crop=tile.crop((max(0,x-90),max(0,y-90),min(w,x+90),min(h,y+50))).convert('RGBA');bg=Image.new('RGBA',crop.size,'#777777');bg.alpha_composite(crop);d=ImageDraw.Draw(bg);cx=x-max(0,x-90);cy=y-max(0,y-90);d.ellipse((cx-4,cy-4,cx+4,cy+4),outline='red',width=2);bg.save(out/f'{name}-offboot-{i}.png')
 results.append(dict(cycle=name,pass_=max(r['distanceToOpaquePixel'] for r in rows)<=5,rows=rows))
(out/'keypoint-alpha-audit.json').write_text(json.dumps(results,indent=2))
print([(r['cycle'],r['pass_'],[(q['frame'],round(q['distanceToOpaquePixel'],1)) for q in r['rows'] if q['distanceToOpaquePixel']>5]) for r in results])
