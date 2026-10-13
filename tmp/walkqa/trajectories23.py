"""Independent cycle-change metrics and scene overlays; does not edit reviewer tools."""
import pathlib,json,math,sys
from PIL import Image,ImageDraw,ImageFont
root=pathlib.Path(sys.argv[1] if len(sys.argv)>1 else 'tmp/walkqa/harness-23')
headings=['right','away-right','away','away-left','left','toward-left','toward','toward-right']
colors=['#e6194b','#f58231','#ffe119','#3cb44b','#42d4f4','#4363d8','#911eb4','#f032e6']
font=ImageFont.truetype('/System/Library/Fonts/Monaco.ttf',20)
for eventfile in root.glob('*/*-events.json'):
 event=json.loads(eventfile.read_text());name=eventfile.name.removesuffix('-events.json');path=eventfile.parent/(name+'.json');rows=json.loads(path.read_text());geo=json.loads((path.parent/'navigation.json').read_text());p=geo['area']['perspective'];source=geo['location']
 def ground(q):
  ppm=p.get('pixelsPerMetre',300)
  if 'constant'in p:return(q['x']/ppm/p['constant'],-q['y']/ppm/p['constant'])
  z=1/(p['slope']*(q['y']-p['horizonY']));return((q['x']-p.get('cx',960))*z/ppm,z*p.get('focalLength',1000)/ppm)
 runs=[];cycles=[];leftSource=False
 for i,r in enumerate(rows):
  if r['location']!=source:leftSource=True
  if not r.get('walking'):continue
  cycle=(r['texture'],r.get('flip',False))
  if not cycles or cycles[-1]!=cycle:cycles.append(cycle)
  if leftSource:continue
  h=r.get('contact',{}).get('heading')
  if h in headings and (not runs or runs[-1]['heading']!=h):runs.append({'frame':i,'heading':h})
 turns=[min(abs(headings.index(a['heading'])-headings.index(b['heading'])),8-abs(headings.index(a['heading'])-headings.index(b['heading']))) for a,b in zip(runs,runs[1:])]
 route=event['setup']['preview'];angles=[]
 for a,b in zip(route,route[1:]):
  a,b=ground(a),ground(b)
  if math.dist(a,b)>1e-6:angles.append(math.atan2(b[1]-a[1],b[0]-a[0]))
 corners=sum(abs(math.atan2(math.sin(b-a),math.cos(b-a)))>25*math.pi/180 for a,b in zip(angles,angles[1:]))
 headingChanges=max(0,len(runs)-1);changes=max(0,len(cycles)-1);reversals=sum(t>2 for t in turns)
 sourceRows=[]
 for r in rows:
  if r['location']!=source:break
  sourceRows.append(r)
 start=event['setup'].get('actualStartAnchor',event['setup'].get('startAnchor',event['setup']['start']));target=event['setup']['preview'][-1] if route else None
 actualTarget=next((r['target'] for r in sourceRows if r.get('target')),target)
 final=sourceRows[-1]['contact'].get('anchor');arrival=sourceRows[-1]['contact'].get('arrival')
 result={'cycleChanges':changes,'headingChanges':headingChanges,'headingPass':reversals==0 and headingChanges<=1+corners,'metricDefinition':'cycleChanges counts texture+mirror transitions during walking, including start/settle sheets; headingChanges counts only the eight drawn directions','reversals':reversals,'cornersOver25Degrees':corners,'changeLimit':1+corners,'pass_':reversals==0 and changes<=1+corners,'runs':runs,'plannedGroundDistance':event['setup'].get('groundDistance'),'actualGroundDistance':math.dist(ground(start),ground(actualTarget)) if actualTarget else None,'actualTarget':actualTarget,'startAnchor':start,'lastAnchor':final,'endpointGroundError':math.dist(ground(final),ground(actualTarget)) if final and actualTarget else None,'search':sourceRows[0]['contact'].get('plan')}
 check=path.parent/(name+'-check-turns.json');encoded=json.dumps(result,indent=2)
 if not check.exists() or check.read_text()!=encoded:check.write_text(encoded)
 bg=Image.open(path.parent/'background.png').convert('RGB');im=Image.new('RGB',(1920,1160),'#151515');im.paste(bg,(0,80));d=ImageDraw.Draw(im)
 d.text((20,8),f'{path.parent.name}/{name} | cycles {changes}/{1+corners}, headings {headingChanges} | reversals {reversals} | start distance {result["actualGroundDistance"] or 0:.2f}m',font=font,fill='white')
 for j,h in enumerate(headings):d.text((20+j*235,42),h,font=font,fill=colors[j])
 last=None
 for r in sourceRows:
  q=(r['x'],r['y']+80);h=r.get('contact',{}).get('heading','right');c=colors[headings.index(h)] if h in headings else 'white'
  if last:d.line((last,q),fill=c,width=5)
  last=q
 for q,c in [(event['setup']['start'],'#ffffff'),(actualTarget,'#ff0000')]:
  if q:d.ellipse((q['x']-10,q['y']+70,q['x']+10,q['y']+90),outline=c,width=4)
 im.save(path.parent/(name+'-trajectory.png'))
 print(path.parent.name,name,changes,reversals,result['actualGroundDistance'])
