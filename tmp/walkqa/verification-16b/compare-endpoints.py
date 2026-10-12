from PIL import Image,ImageDraw
from pathlib import Path
import numpy as np,sys,json
r=Path('tmp/walkqa/verification-16b');name=sys.argv[1];d=r/name;ps=sorted((d/'keyed').glob('*.png'));ims=[Image.open(r/'sources/away-first-alpha.png'),Image.open(ps[0]),Image.open(ps[min(33,len(ps)-1)]),Image.open(ps[-1]),Image.open(r/'sources/away-last-alpha.png')];out=Image.new('RGB',(5*306,560),'#aa55bb');draw=ImageDraw.Draw(out)
for i,im in enumerate(ims):
 im=im.convert('RGBA').resize((306,529));out.paste(im,(306*i,0),im);draw.text((306*i,535),['source','generated first','frame33','generated last','rest'][i],fill='white')
out.save(d/'endpoints-compare.png')
