import pathlib,json,subprocess
from PIL import Image,ImageChops
root=pathlib.Path('tmp/walkqa');pub=pathlib.Path('adventures/shadow-over-innsmouth/public');sprites=pub/'assets/sprites/hermes';cache={};report=[]
for sc,obj in [('alley','crate-0-55e961'),('depot-outside','fishing-net-pile-22c3fb'),('road','left-fishing-net-0-55e961'),('road','right-lobster-trap-d0a0fc')]:
 folder=root/'occlusion-08'/sc/obj;geo=json.loads((folder/'navigation.json').read_text());o=next(o for o in geo['objects'] if o['id']==obj);b=o['bbox'];op=next(pub.rglob(o['png']));oa=Image.open(op).getchannel('A').resize((round(b['w']),round(b['h'])));
 for video in sorted(folder.glob('direct-*.mp4')):
  rows=json.loads(video.with_suffix('.json').read_text());best=(0,0)
  for i,r in enumerate(rows):
   if not r['depth']<next(o['depth'] for o in r['occluders'] if o['id']==obj):continue
   t=r['texture']
   if t not in cache:
    m=json.loads((sprites/(t+'.json')).read_text());cache[t]=(m,Image.open(sprites/m['image']).getchannel('A'))
   m,im=cache[t];f=r['frame'];fw,fh=m['frameWidth'],m['frameHeight'];sx=f%m['cols']*fw;sy=f//m['cols']*fh
   body=im.crop((sx,sy,sx+fw,sy+fh));body=body.resize((round(fw*r['scale']),round(fh*r['scale'])));
   if r['flip']:body=body.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
   left=round(r['x']-body.width/2);top=round(r['y']-body.height);part=body.crop((round(b['x']-left),round(b['y']-top),round(b['x']-left)+oa.width,round(b['y']-top)+oa.height));n=sum(v>127 for v in ImageChops.multiply(oa,part).getdata());
   if n>best[0]:best=(n,i)
  n,i=best;dest=folder/(video.stem+'-max-overlap.png');subprocess.run(['ffmpeg','-v','error','-y','-i',str(video),'-vf',f'select=eq(n\\,{i})','-frames:v','1',str(dest)],check=True)
  image=Image.open(dest);r=rows[i];x0=max(0,min(b['x'],r['x']-180));y0=max(0,min(b['y'],r['y']-400));x1=min(1920,max(b['x']+b['w'],r['x']+180));y1=min(1080,max(b['y']+b['h'],r['y']+30));ratio=image.width/1920;crop=image.crop(tuple(round(v*ratio)for v in [x0,y0,x1,y1]));crop.resize((crop.width*2,crop.height*2)).save(folder/(video.stem+'-max-overlap-2x.png'))
  report.append({'clip':str(video),'frame':i,'overlapPixels':n,'image':str(dest)})
(root/'verification-08'/'overlap.json').write_text(json.dumps(report,indent=2));print(json.dumps(report,indent=2))
