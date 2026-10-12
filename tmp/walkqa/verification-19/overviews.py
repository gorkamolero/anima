from pathlib import Path
import json,math
from PIL import Image,ImageDraw
P=Path('tmp/walkqa/proof-19')
for scene in ['road','depot','starts']:
 entries=[]
 for p in sorted((P/scene).glob('*.json')):
  if p.name.endswith('.partial.json'):continue
  rows=json.loads(p.read_text())
  if not isinstance(rows,list) or not rows or 'contact' not in rows[0]:continue
  i=0 if scene=='starts' else len(rows)-1;r=rows[i];files=sorted(p.with_name(p.stem+'-frames').glob('*.png'));s=r['scale'];im=Image.open(files[i]);box=(int(r['x']-306*s-8),int(r['y']-1059*s-8),int(r['x']+306*s+8),int(r['y']+8));im=im.crop(box);im.thumbnail((300,500));entries.append((p.stem,im))
 if not entries:continue
 out=Image.new('RGB',(1200,530*math.ceil(len(entries)/4)),'#333');d=ImageDraw.Draw(out)
 for i,(name,im) in enumerate(entries):x=i%4*300;y=i//4*530;out.paste(im,(x+(300-im.width)//2,y+25));d.text((x+5,y+5),scene+'/'+name,fill='white')
 out.save(P/(scene+'-rests.png'))
