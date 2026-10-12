from PIL import Image,ImageDraw
from pathlib import Path
root=Path('tmp/walkqa/verification-17')
for h in ['side','away','away-right','toward','toward-right']:
 for variant in ['', 'rigid']:
  d=root/h/variant
  for start in [0,3,6]:
   out=Image.new('RGB',(1800,1058),'#808080');draw=ImageDraw.Draw(out)
   for j,i in enumerate(range(start,start+3)):
    im=Image.open(d/f'frame-{i:02}.png').convert('RGBA');bg=Image.new('RGBA',im.size,(128,128,128,255));bg.alpha_composite(im)
    crop=bg.crop((170,540,470,1059)).resize((600,1038),Image.Resampling.NEAREST);out.paste(crop,(j*600,20));draw.text((j*600+5,4),f'{h} {variant or "RIFE"} #{i}',fill='white')
   out.save(d/f'limbs-{start}-{start+2}-2x.png')
