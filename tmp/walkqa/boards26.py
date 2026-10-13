import pathlib,json,sys,math
from PIL import Image,ImageDraw
root=pathlib.Path(sys.argv[1]);out=root/'reviewboards';out.mkdir(exist_ok=True)
for scene in sorted(p for p in root.iterdir() if p.is_dir() and (p/'plan.json').exists()):
 sheets=[];feet=[]
 for beat in json.loads((scene/'plan.json').read_text())['beats']:
  name=beat['name'];p=scene/(name+'-sheet.png')
  if not p.exists():continue
  im=Image.open(p).convert('RGB');im=im.resize((960,round(im.height/2)));sheets.append((name,im))
  f=Image.open(scene/(name+'-feet.png')).convert('RGB');feet.append((name,f))
 for label,images,width in [('contacts',sheets,960),('feet',feet,1440)]:
  board=Image.new('RGB',(width,sum(im.height+24 for _,im in images)),(22,22,22));draw=ImageDraw.Draw(board);y=0
  for name,im in images:draw.text((4,y+4),scene.name+'/'+name,fill='white');board.paste(im,(0,y+24));y+=im.height+24
  board.save(out/(scene.name+'-'+label+'.jpg'),quality=90)
 print(scene.name)
