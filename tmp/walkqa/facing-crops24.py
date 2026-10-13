"""Supplement review with the stance checker's reported off-heading samples."""
import pathlib,json,cv2,hashlib
from PIL import Image,ImageDraw
root=pathlib.Path('tmp/walkqa/harness-24');out=root/'facing-review';out.mkdir(exist_ok=True);tiles=[];records=[]
for p in sorted(root.glob('*/*-check-facing.json')):
 name=p.name.removesuffix('-check-facing.json');rows=json.loads((p.parent/(name+'.json')).read_text())
 for stance in json.loads(p.read_text()).get('offStances',[]):
  i=stance['stanceStartFrame'];r=rows[i];cap=cv2.VideoCapture(str(p.parent/(name+'.mp4')));cap.set(cv2.CAP_PROP_POS_FRAMES,i);ok,frame=cap.read();cap.release();assert ok
  x,y=r['contact']['anchor'].values();im=Image.fromarray(cv2.cvtColor(frame,cv2.COLOR_BGR2RGB)).crop((round(x)-120,round(y)-200,round(x)+120,round(y)+70));tile=Image.new('RGB',(320,310));tile.paste(im,(0,40));ImageDraw.Draw(tile).text((4,4),f'{p.parent.name}/{name}\nframe {i}: {stance["offDeg"]} degrees',fill='white');tiles.append(tile);records.append(dict(scene=p.parent.name,walk=name,**stance))
board=Image.new('RGB',(320*len(tiles),310))
for i,tile in enumerate(tiles):board.paste(tile,(320*i,0))
p=out/'off-stances.png';board.save(p);(out/'manifest.json').write_text(json.dumps(dict(viewed=False,records=records,sha256=hashlib.sha256(p.read_bytes()).hexdigest()),indent=2));print(records)
