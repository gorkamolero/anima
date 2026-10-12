"""Review exact final captures; preserve full alpha counts and event frames."""
import pathlib,json,subprocess,shutil
from PIL import Image,ImageChops,ImageDraw
root=pathlib.Path('tmp/walkqa');proof=root/'proof-09';pub=pathlib.Path('adventures/shadow-over-innsmouth/public');sprites=pub/'assets/sprites/hermes';cache={};report=[]
groups=[('road','left-tree-e55fac','tree'),('road','right-lobster-trap-d0a0fc','trap'),('depot-pergola','pergola-b60423','pergola')]
for scene,obj,prefix in groups:
 folder=proof/'crossings'/scene;geo=json.loads((folder/'navigation.json').read_text());o=next(o for o in geo['objects']if o['id']==obj);b=o['bbox'];op=next(pub.rglob(o['png']));oa=Image.open(op).getchannel('A').resize((round(b['w']),round(b['h'])));
 for video in sorted(folder.glob(prefix+'-*.mp4')):
  rows=json.loads(video.with_suffix('.json').read_text());scan=[]
  for i,r in enumerate(rows):
   behind=r['depth']<next(v['depth']for v in r['occluders']if v['id']==obj);t=r['texture']
   if t not in cache:
    m=json.loads((sprites/(t+'.json')).read_text());cache[t]=(m,Image.open(sprites/m['image']).getchannel('A'))
   m,im=cache[t];f=r['frame'];fw,fh=m['frameWidth'],m['frameHeight'];sx=f%m['cols']*fw;sy=f//m['cols']*fh
   body=im.crop((sx,sy,sx+fw,sy+fh)).resize((round(fw*r['scale']),round(fh*r['scale'])))
   if r['flip']:body=body.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
   left=round(r['x']-body.width/2);top=round(r['y']-body.height);part=body.crop((round(b['x']-left),round(b['y']-top),round(b['x']-left)+oa.width,round(b['y']-top)+oa.height));n=sum(v>127 for v in ImageChops.multiply(oa,part).getdata());scan.append({'frame':i,'behind':behind,'overlapPixels':n})
  switches=[i for i in range(1,len(scan))if scan[i]['behind']!=scan[i-1]['behind']];overlaps=[r for r in scan if r['behind']and r['overlapPixels']];best=max(overlaps,key=lambda r:r['overlapPixels'])if overlaps else {'frame':0,'overlapPixels':0}
  events=[('baseline',i)for i in switches]
  if overlaps:events += [('alpha-entry',overlaps[0]['frame']),('alpha-exit',overlaps[-1]['frame'])]
  events += [('max-overlap',best['frame'])];paths=[]
  for label,i in events:
   r=rows[i];box=(max(0,round(r['x']-180)),max(0,round(r['y']-400)),min(1920,round(r['x']+180)),min(1080,round(r['y']+60)));panels=[]
   for n in sorted(set([max(0,i-1),i,min(len(rows)-1,i+1)])):
    p=folder/f'{video.stem}-f{n:04}.png'
    if not p.exists():subprocess.run(['ffmpeg','-v','error','-y','-i',str(video),'-vf',f'select=eq(n\\,{n})','-frames:v','1',str(p)],check=True)
    crop=Image.open(p).crop(box);crop=crop.resize((crop.width*2,crop.height*2));ImageDraw.Draw(crop).text((8,8),f'{label} f{n}: alpha={scan[n]["overlapPixels"]}, behind={scan[n]["behind"]}',fill='yellow',stroke_width=2,stroke_fill='black');panels.append(crop);paths.append(str(p))
   strip=Image.new('RGB',(sum(p.width for p in panels),max(p.height for p in panels)));x=0
   for im in panels:strip.paste(im,(x,0));x+=im.width
   strip.save(folder/f'{video.stem}-{label}-{i:04}-2x.png')
  (folder/(video.stem+'-alpha-scan.json')).write_text(json.dumps(scan))
  report.append({'clip':str(video),'object':obj,'switches':switches,'maximumBehindOverlap':best,'firstBehindOverlap':overlaps[0]['frame']if overlaps else None,'lastBehindOverlap':overlaps[-1]['frame']if overlaps else None,'frames':sorted(set(paths))})
 # One continuous roundtrip per required object, including approach waypoints.
 legs=sorted(folder.glob(prefix+'-*.mp4'))
 plan=json.loads((root/'verification-09'/('road-crossings-plan.json'if scene=='road'else'pergola-wide-plan.json')).read_text());names=[b['name']for b in plan['beats']if b['name'].startswith(prefix+'-')]
 out=proof/'roundtrips'/obj;out.mkdir(parents=True,exist_ok=True);manifest=out/'concat.txt';manifest.write_text(''.join("file '"+str((folder/(name+'.mp4')).resolve())+"'\n"for name in names));subprocess.run(['ffmpeg','-v','error','-y','-f','concat','-safe','0','-i',str(manifest),'-c','copy',str(out/'roundtrip.mp4')],check=True);manifest.unlink();combined=[]
 for name in names:combined+=json.loads((folder/(name+'.json')).read_text())
 (out/'roundtrip.json').write_text(json.dumps(combined));shutil.copyfile(folder/'area.json',out/'area.json')
(root/'verification-09/proof-crossings-review.json').write_text(json.dumps(report,indent=2))
