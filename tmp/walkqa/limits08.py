import json,pathlib
from PIL import Image
root=pathlib.Path('tmp/walkqa');report=[]
for scene in ['road','alley','depot-outside','depot-inside']:
 d=json.loads((root/'geometry-08'/scene/'navigation.json').read_text());im=Image.open(root/'walkareas-08'/(scene+'.png'))
 for o in d['objects']:
  if not any(s in o['id']for s in ['tree','bench','crate','pergola','lobster-trap']):continue
  b=o['bbox'];line=o['baseline'];lo=min(p['x']for p in line);hi=max(p['x']for p in line)
  def by(x):
   if x<=line[0]['x']:return line[0]['y']
   for a,b in zip(line,line[1:]):
    if x<=b['x']:return a['y']+(b['y']-a['y'])*(x-a['x'])/max(.001,b['x']-a['x'])
   return line[-1]['y']
  counts={}
  for name in ['rawMask','mask']:
   m=d['area'][name];n=0
   for i,v in enumerate(m['data']):
    x=(i%m['width']+.5)*1920/m['width'];y=(i//m['width']+.5)*1080/m['height']
    if v and lo<=x<=hi and by(x)-150<=y<by(x)-15:n+=1
   counts[name]=n
  box=(max(0,round(lo-90)),max(0,round(min(p['y']for p in line)-210)),min(1920,round(hi+90)),min(1080,round(max(p['y']for p in line)+90)));crop=im.crop(box);path=root/'verification-08'/(scene+'-'+o['id']+'-support-2x.png');crop.resize((crop.width*2,crop.height*2)).save(path);report.append({'scene':scene,'object':o['id'],'rearBandCells':counts,'crop':str(path),'note':'Band within measured contact span, 15-150 px behind baseline; not by itself proof of impossibility in artwork.'})
(root/'verification-08'/'limitations.json').write_text(json.dumps(report,indent=2))
