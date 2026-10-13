"""Assemble review images without marking any unseen walk reviewed."""
import pathlib,json,hashlib
from PIL import Image,ImageDraw
root=pathlib.Path('tmp/walkqa/harness-24');out=root/'reviewboards';out.mkdir(exist_ok=True);records=[]
for manifest in sorted(root.glob('*/*-crops/manifest.json')):
 m=json.loads(manifest.read_text());walk=manifest.parent.name.removesuffix('-crops');scene=manifest.parent.parent.name
 if m.get('viewed'):continue
 files=[manifest.parent.parent/(walk+'-sheet.png'),manifest.parent.parent/(walk+'-trajectory.png'),*sorted(manifest.parent.glob('*review-*.png'))]
 if any(not p.exists() for p in files):continue
 # All source panels retained, bounded width only; individual flags remain available.
 panels=[]
 for f in files:
  im=Image.open(f).convert('RGB');im.thumbnail((1920,6000));panels.append((f,im))
 height=sum(im.height+24 for _,im in panels);board=Image.new('RGB',(1920,height),'#222222');d=ImageDraw.Draw(board);y=0
 for f,im in panels:
  d.text((8,y+4),str(f),fill='white');board.paste(im,(0,y+24));y+=im.height+24
 target=out/(scene+'--'+walk+'.jpg');board.save(target,quality=88)
 records.append(dict(scene=scene,walk=walk,path=str(target),sources=[str(f) for f in files]))
(out/'queue.json').write_text(json.dumps(records,indent=2));print(len(records))
