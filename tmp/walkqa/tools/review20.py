"""Produce every flagged feet crop, five seeded random crops, six stop frames,
and before/at/after images for every baseline crossing. No reviewer tool modified."""
import json,pathlib,sys,random,hashlib
import cv2,numpy as np
from PIL import Image,ImageDraw
import draworder
p=pathlib.Path(sys.argv[1]);rows=json.loads(p.read_text());out=p.parent/(p.stem+'-crops');out.mkdir(exist_ok=True)
prior=json.loads((out/'manifest.json').read_text()) if (out/'manifest.json').exists() else {}
for stale in out.glob('*review-*.png'):stale.unlink()
flags=set()
for f in p.parent.glob(p.stem+'-check-*.json'):
 d=json.loads(f.read_text())
 for v in d.get('flagged',[]):flags.add(v if isinstance(v,int) else v['frame'])
randoms=random.Random(20).sample(range(len(rows)),min(5,len(rows)));stops=list(range(max(0,len(rows)-6),len(rows)));crossings=draworder.check(rows)['crossings'];crossframes={i for c in crossings for i in [c['frame']-1,c['frame'],c['frame']+1] if 0<=i<len(rows)}
selected=flags|set(randoms)|set(stops)|crossframes;cap=cv2.VideoCapture(str(p.with_suffix('.mp4')));tiles=[];cross=[];stoptiles=[]
for i,r in enumerate(rows):
 ok,f=cap.read()
 if not ok:raise ValueError('video/log length mismatch')
 if i not in selected:continue
 im=Image.fromarray(cv2.cvtColor(f,cv2.COLOR_BGR2RGB));a=r['contact']['anchor'];x,y=round(a['x']),round(a['y']);crop=im.crop((x-80,y-80,x+80,y+80));crop.save(out/f'feet-{i:05}.png')
 tile=Image.new('RGB',(160,184));tile.paste(crop,(0,24));label=f'{i} '+('flag ' if i in flags else '')+('random ' if i in randoms else '')+('stop' if i in stops else '');ImageDraw.Draw(tile).text((3,5),label,fill='white');tiles.append(tile)
 if i in stops:
  m=draworder.meta(r['texture']);w=m['frameWidth']*r['scale'];h=m['frameHeight']*r['scale'];full=im.crop((round(r['x']-w/2-20),round(r['y']-h-20),round(r['x']+w/2+20),round(r['y']+30)));full.save(out/f'stop-{i:05}.png');full.thumbnail((240,430));tile=Image.new('RGB',(240,460));tile.paste(full,((240-full.width)//2,25));ImageDraw.Draw(tile).text((3,5),f'stop frame {i}',fill='white');stoptiles.append(tile)
 if i in crossframes:
  crop=im.crop((x-180,y-400,x+180,y+100));crop.save(out/f'crossing-{i:05}.png');tile=Image.new('RGB',(360,524));tile.paste(crop,(0,24));ImageDraw.Draw(tile).text((3,5),f'crossing frame {i}',fill='white');cross.append(tile)
cap.release()
def sheets(tiles,stem,cols,per):
 for n in range(0,len(tiles),per):
  group=tiles[n:n+per];w,h=group[0].size;im=Image.new('RGB',(cols*w,((len(group)+cols-1)//cols)*h))
  for j,t in enumerate(group):im.paste(t,((j%cols)*w,(j//cols)*h))
  im.save(out/f'{stem}-{n//per:03}.png')
sheets(tiles,'feet-review',8,64);sheets(cross,'crossing-review',3,12);sheets(stoptiles,'stop-review',6,6)
manifest=dict(flagged=sorted(flags),random=randoms,stop=stops,crossings=crossings,viewed=False)
images=[p.parent/(p.stem+'-sheet.png'),*sorted(out.glob('*review-*.png'))]
hashes={str(f):hashlib.sha256(f.read_bytes()).hexdigest() for f in images}
if prior.get('viewed') and all(prior.get('reviewedImageHashes',{}).get(k)==v for k,v in hashes.items()):
 manifest.update(viewed=True,pass_=prior['pass_'],notes=prior.get('notes',''),reviewedImageHashes=hashes)
(out/'manifest.json').write_text(json.dumps(manifest,indent=2));print(p.stem,len(tiles),len(cross))
