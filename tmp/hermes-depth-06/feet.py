import json,sys
from PIL import Image,ImageDraw
from pathlib import Path
v=sys.argv[1];p=Path('adventures/shadow-over-innsmouth/public/assets/sprites/hermes')/f'hermes-walk-{v}.json';m=json.loads(p.read_text());im=Image.open(p.with_suffix('.png'));w,h=m['frameWidth'],m['frameHeight'];out=Image.new('RGB',(6*306,((m['frameCount']+5)//6)*180),'#888888');d=ImageDraw.Draw(out)
for i in range(m['frameCount']):
 f=im.crop((i%m['cols']*w,i//m['cols']*h,(i%m['cols']+1)*w,(i//m['cols']+1)*h));f=f.crop((0,759,612,1059)).resize((306,150));x=i%6*306;y=i//6*180;out.paste(f,(x,y),f);d.text((x+5,y+153),str(i),fill='white')
 for py in [850,950,1050]:d.line((x,y+(py-759)/2,x+306,y+(py-759)/2),fill='#555555');d.text((x,y+(py-759)/2),str(py),fill='white')
out.save(f'tmp/hermes-depth-06/{v}-feet.png')
