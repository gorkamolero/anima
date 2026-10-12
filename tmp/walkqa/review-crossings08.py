import json,pathlib,subprocess
from PIL import Image,ImageDraw
root=pathlib.Path('tmp/walkqa'); report=[]
for scene,obj in [('alley','crate-0-55e961'),('depot-outside','fishing-net-pile-22c3fb'),('road','left-fishing-net-0-55e961'),('road','right-lobster-trap-d0a0fc')]:
 folder=root/'occlusion-08'/scene/obj
 for video in sorted(folder.glob('direct-*.mp4')):
  rows=json.loads(video.with_suffix('.json').read_text());cross=[]
  def side(r):return r['depth']<next(o['depth'] for o in r['occluders'] if o['id']==obj)
  for i in range(1,len(rows)):
   if side(rows[i])!=side(rows[i-1]):cross.append(i)
  panels=[];paths=[]
  for i in cross:
   x=rows[i]['x'];y=rows[i]['y']; box=(max(0,round(x-180)),max(0,round(y-400)),min(1920,round(x+180)),min(1080,round(y+60)))
   for n in [i-1,i,i+1]:
    p=folder/f'{video.stem}-f{n:04}.png';subprocess.run(['ffmpeg','-v','error','-y','-i',str(video),'-vf',f'select=eq(n\\,{n})','-frames:v','1',str(p)],check=True)
    im=Image.open(p);sx=im.width/1920;crop=im.crop(tuple(round(v*sx) for v in box));crop=crop.resize((crop.width*2,crop.height*2));ImageDraw.Draw(crop).text((8,8),f'{n} '+('behind' if side(rows[n]) else 'front'),fill='red');panels.append(crop);paths.append(str(p))
  if panels:
   strip=Image.new('RGB',(sum(p.width for p in panels),max(p.height for p in panels)));x=0
   for p in panels:strip.paste(p,(x,0));x+=p.width
   dest=folder/(video.stem+'-2x.png');strip.save(dest)
  report.append({'clip':str(video),'switches':cross,'frames':paths,'locations':sorted(set(r['location'] for r in rows))})
(root/'verification-08'/'review-crossings.json').write_text(json.dumps(report,indent=2));print(json.dumps(report,indent=2))
