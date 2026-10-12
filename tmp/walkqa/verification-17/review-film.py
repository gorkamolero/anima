from pathlib import Path
from PIL import Image,ImageDraw
import importlib.util
spec=importlib.util.spec_from_file_location('stops','packages/sprite-tools/scripts/interpolated-stops.py');s=importlib.util.module_from_spec(spec);spec.loader.exec_module(s)
d=Path('tmp/walkqa/verification-17/side/film');frames=[]
for i,p in enumerate(sorted(d.glob('rgb-*.png'))):
 im=s.matte(Image.open(p).convert('RGB'));im.save(d/f'frame-{i:02}.png');frames.append(im)
out=Image.new('RGB',(306*len(frames),550),'#808080');sheet=Image.new('RGBA',(612*len(frames),1059))
for i,im in enumerate(frames):
 bg=Image.new('RGBA',im.size,(128,128,128,255));bg.alpha_composite(im);out.paste(bg.convert('RGB').resize((306,530)),(306*i,20));ImageDraw.Draw(out).text((306*i+5,4),str(i),fill='white');sheet.paste(im,(612*i,0));bg.resize((1224,2118),Image.Resampling.NEAREST).save(d/f'review-{i:02}-2x.png')
out.save(d/'overview.png');sheet.save(d/'candidate-sheet.png')
for start in [0,3,6]:
 for name,box in [('limbs',(170,540,470,1059)),('upper',(120,0,520,620))]:
  w,h=(box[2]-box[0])*2,(box[3]-box[1])*2;out=Image.new('RGB',(w*3,h+20),'#808080')
  for j,i in enumerate(range(start,start+3)):
   bg=Image.new('RGBA',frames[i].size,(128,128,128,255));bg.alpha_composite(frames[i]);out.paste(bg.crop(box).resize((w,h),Image.Resampling.NEAREST),(j*w,20));ImageDraw.Draw(out).text((j*w+5,4),str(i),fill='white')
  out.save(d/f'{name}-{start}-{start+2}-2x.png')
