"""Small visual review indexes; full six-frame sheets are the deliverables."""
import json
from pathlib import Path
from PIL import Image,ImageDraw
root=Path('tmp/walkqa/proof-13')
for scene in ['road','depot','starts']:
 out=Image.new('RGB',(1600,1280),'#242424');draw=ImageDraw.Draw(out)
 rows=[r for r in json.loads((root/'results.json').read_text()) if r['scene']==scene]
 for k,r in enumerate(rows):
  p=root/scene/r['clip'];log=json.loads(p.with_suffix('.json').read_text())
  ix=[0,1] if scene=='starts' else [r['cutFrame']-1,r['cutFrame']]
  box=(int(min(log[i]['x']-306*log[i]['scale'] for i in ix)-8),int(min(log[i]['y']-1059*log[i]['scale'] for i in ix)-8),int(max(log[i]['x']+306*log[i]['scale'] for i in ix)+8),int(max(log[i]['y'] for i in ix)+8))
  for j,i in enumerate(ix):
   im=Image.open(p.with_name(p.name+'-frames')/f'{i:06}.png').crop(box);im.thumbnail((185,275))
   x=(k%4)*400+j*200;y=(k//4)*640+35
   out.paste(im,(x,y));draw.text((x,y-20),f'{r["clip"]} #{i}',fill='white')
   # Bottom row in each cell: full final-six sheet, for timing/limb comparison.
  sheet=Image.open(p.with_name(p.name+('-first6-2x.png' if scene=='starts' else '-last6-2x.png')));sheet.thumbnail((390,300));out.paste(sheet,((k%4)*400,(k//4)*640+330))
 out.save(root/(scene+'-review.png'))
