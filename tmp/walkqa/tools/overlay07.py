"""Render actual runtime floor/support geometry over its source scene."""
import json, pathlib, sqlite3
from PIL import Image, ImageDraw, ImageFilter
ROOT=pathlib.Path(__file__).resolve().parents[3]
PUBLIC=ROOT/'adventures/shadow-over-innsmouth/public'
OUT=ROOT/'tmp/walkqa/walkareas';OUT.mkdir(exist_ok=True)
db=sqlite3.connect(ROOT/'api/data/world.db')
for path in sorted((ROOT/'tmp/walkqa/geometry-07').glob('*/navigation.json')):
 d=json.loads(path.read_text());scene=path.parent.name
 if d['location'] in ('outside','inside'):
  bg='backgrounds/'+('bus-station-kat-seated-composite-v1.png' if d['location']=='outside' else 'arkham-bus-depot-flat-2d.png')
 else: bg=json.loads(db.execute('select data from places where id=?',(d['location'],)).fetchone()[0])['background'].lstrip('/')
 im=Image.open(PUBLIC/bg).convert('RGBA').resize((1920,1080))
 for mask,color in [(d['area']['mask'],(0,255,40,110)),(d['area']['objectFootprints'],(255,0,0,190))]:
  m=Image.frombytes('L',(mask['width'],mask['height']),bytes(255 if v else 0 for v in mask['data'])).resize(im.size,Image.Resampling.NEAREST)
  tint=Image.new('RGBA',im.size,color);tint.putalpha(m.point(lambda v:color[3] if v else 0));im=Image.alpha_composite(im,tint)
 for o in d['objects']:
  box=o['bbox'];p=(PUBLIC/bg).parent/o['png']
  alpha=Image.open(p).convert('RGBA').getchannel('A').resize((round(box['w']),round(box['h'])))
  outline=alpha.filter(ImageFilter.MaxFilter(3))
  import PIL.ImageChops
  outline=PIL.ImageChops.subtract(outline,alpha.filter(ImageFilter.MinFilter(3)))
  im.paste((0,220,255), (round(box['x']),round(box['y'])), outline)
 draw=ImageDraw.Draw(im)
 for o in d['objects']:
  pts=[(p['x'],p['y']) for p in o['baseline']]
  if len(pts)>1:draw.line(pts,fill='yellow',width=3)
  draw.text((o['bbox']['x'],o['bbox']['y']),o['label'],fill='yellow',stroke_width=1,stroke_fill='black')
 draw.rectangle((0,0,1100,32),fill='black');draw.text((10,9),f'{scene}: green = navigable floor | red = physical supports (body clearance applied to green) | cyan = occluder | yellow = baseline',fill='white')
 im.convert('RGB').save(OUT/(scene+'.png'))
 print(scene)
