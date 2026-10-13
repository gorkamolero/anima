"""Build six-fps sheets, stop strips and crossing/turn triples from actual logs."""
import sys,json,pathlib,math,hashlib,random,time
sys.path.insert(0,'tmp/walkqa/tools')
import composite
from PIL import Image,ImageDraw
root=pathlib.Path(sys.argv[1]);geometries={}
for p in root.glob('*/navigation.json'):
 g=json.loads(p.read_text());geometries[g['location']]=g
manifest=[];began=time.perf_counter()
for p in sorted(root.glob('*/*-events.json')):
 name=p.name.removesuffix('-events.json');rows=json.loads(p.with_name(name+'.json').read_text());base=json.loads((p.parent/'navigation.json').read_text());cache={}
 def render(i,width):
  key=(i,width)
  if key not in cache:cache[key]=composite.render(rows[i],geometries.get(rows[i]['location'],base) if rows[i]['visible'] else base,width)
  return cache[key]
 def sheet(indices,columns,width,out):
  height=round(width*1080/1920);result=Image.new('RGB',(columns*width,math.ceil(len(indices)/columns)*(height+20)),(18,18,18));draw=ImageDraw.Draw(result)
  for j,i in enumerate(indices):
   x,y=j%columns*width,j//columns*(height+20);result.paste(render(i,width),(x,y));draw.text((x+3,y+height+3),str(i),fill='white')
  result.save(out)
 indices=list(range(0,len(rows),4));indices+=[] if indices[-1]==len(rows)-1 else [len(rows)-1]
 sheet(indices,6,320,p.with_name(name+'-sheet.png'))
 stopped=next((i for i in range(len(rows)-1,-1,-1) if rows[i]['walking']),max(0,len(rows)-12))
 stops=sorted(set(max(0,min(len(rows)-1,stopped+d)) for d in [-4,-2,-1,0,1,2,4,8]))
 sheet(stops,4,480,p.with_name(name+'-stops.png'))
 changes=[]
 for i in range(1,len(rows)):
  a,b=rows[i-1],rows[i]
  if a['location']!=b['location']:continue
  if a['contact']['heading']!=b['contact']['heading']:changes.append({'frame':i,'kind':'turn'})
  old={o['id']:o for o in a['occluders']}
  for o in b['occluders']:
   if o['id'] not in old:continue
   box=o['bounds'];m=composite.sprite(b['texture'],b['frame']);sx=b['x']-m.width*b['scale']/2
   overlap=sx<box['x']+box['width'] and sx+m.width*b['scale']>box['x'] and b['y']>box['y'] and b['y']-m.height*b['scale']<box['y']+box['height']
   if overlap and (a['depth']>old[o['id']]['depth'])!=(b['depth']>o['depth']):changes.append({'frame':i,'kind':'crossing','object':o['id']})
 cross=sorted(set(max(0,min(len(rows)-1,c['frame']+d)) for c in changes for d in [-1,0,1]))
 if cross:sheet(cross,3,640,p.with_name(name+'-crossings-turns.png'))
 # Five reproducible random feet crops plus every numeric flagged frame.
 rng=random.Random(hashlib.sha256(str(p).encode()).hexdigest());flagged=set(rng.sample(range(len(rows)),min(5,len(rows))))
 for f in p.parent.glob(name+'-check-*.json'):
  check=json.loads(f.read_text());flagged.update(i for i in check.get('flagged',[]) if isinstance(i,int) and 0<=i<len(rows));flagged.update(s['stanceStartFrame'] for s in check.get('offStances',[]))
 flags=sorted(flagged);feet=Image.new('RGB',(6*240,math.ceil(len(flags)/6)*180),(18,18,18));draw=ImageDraw.Draw(feet)
 for j,i in enumerate(flags):
  row=rows[i];anchor=row['contact']['anchor'];im=render(i,1920);crop=im.crop((round(anchor['x'])-120,round(anchor['y'])-110,round(anchor['x'])+120,round(anchor['y'])+50));x,y=j%6*240,j//6*180;feet.paste(crop,(x,y));draw.text((x+3,y+163),str(i),fill='white')
 feet.save(p.with_name(name+'-feet.png'))
 manifest.append({'scene':p.parent.name,'walk':name,'frames':len(rows),'sixFpsFrames':indices,'stopFrames':stops,'crossingsTurns':changes,'feetFrames':flags,'reviewed':False});(root/'visual-index.json').write_text(json.dumps({'elapsedMs':(time.perf_counter()-began)*1000,'walks':manifest},indent=2));print(p.parent.name,name,flush=True)
