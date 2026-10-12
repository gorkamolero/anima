from pathlib import Path
from PIL import Image,ImageDraw
import numpy as np,json
r=Path('tmp/walkqa/verification-17/f21');im=Image.open('adventures/shadow-over-innsmouth/public/generated/5ca32cfdd011640725ee52cf1e1d8fbd07a6ce6bdb34d4f5df52206964b4b53a.png').convert('RGB');d=ImageDraw.Draw(im)
m=np.array(Image.open(r/'door/mask-00.png').convert('L'))>127;y,x=np.where(m);box=[int(x.min()),int(y.min()),int(x.max()+1),int(y.max()+1)];d.rectangle(box,outline='lime',width=3)
for p in sorted((r/'sea').glob('mask-*.png')):
 m=np.array(Image.open(p).convert('L'))>127;tops=np.argmax(m,axis=0)[m.any(axis=0)];counts=np.bincount(tops,minlength=m.shape[0]);h=int(np.argmax(counts));print(p.name,'mode',h,'support',int(counts[h]),'top quantiles',np.quantile(tops,[0,.1,.5,.9,1]).tolist());d.line((0,h,im.width,h),fill='yellow',width=2)
print('door',box);im.save(r/'detected-overlay.png')
