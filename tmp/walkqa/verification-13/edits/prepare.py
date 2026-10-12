import json,sys,importlib.util
from pathlib import Path
import numpy as np
from PIL import Image,ImageDraw
from scipy import ndimage
ROOT=Path.cwd();SPR=ROOT/'adventures/shadow-over-innsmouth/public/assets/sprites/hermes';OUT=ROOT/'tmp/walkqa/verification-13/edits'
spec=importlib.util.spec_from_file_location('tracking',ROOT/'packages/sprite-tools/scripts/root-motion.py');track=importlib.util.module_from_spec(spec);spec.loader.exec_module(track)
def centroid(a,lo,hi):
 ys=np.where(a>127)[0];top,bottom=ys.min(),ys.max()+1;y0,y1=int(top+(bottom-top)*lo),int(top+(bottom-top)*hi);weights=a[y0:y1].astype(float)/255;yy,xx=np.indices(weights.shape);return np.array([(weights*xx).sum(),(weights*(yy+y0)).sum()])/weights.sum()
def key(im):
 rgb=np.array(im.convert('RGB')).astype(float)
 grey=(np.ptp(rgb,axis=2)<15)&(rgb.mean(2)>95)&(rgb.mean(2)<160)
 labels,_=ndimage.label(~grey);sizes=np.bincount(labels.ravel());sizes[0]=0;body=ndimage.binary_fill_holes(labels==sizes.argmax());body[rgb.shape[0]//2:]&=~grey[rgb.shape[0]//2:]
 interior=ndimage.binary_erosion(body,iterations=2);_,indices=ndimage.distance_transform_edt(~interior,return_indices=True);fg=rgb[tuple(indices)];bg=np.median(rgb[grey],axis=0);delta=fg-bg
 alpha=np.clip(((rgb-bg)*delta).sum(2)/np.maximum((delta*delta).sum(2),1),0,1);alpha[interior]=1;alpha[~ndimage.binary_dilation(body)]=0
 cleaned=np.clip((rgb-(1-alpha[...,None])*bg)/np.maximum(alpha[...,None],.001),0,255)
 return Image.fromarray(np.dstack([cleaned,alpha*255]).astype('uint8'))
records=[]
for d,(walk,i) in json.loads((OUT/'selection.json').read_text()).items():
 attempt=int(sys.argv[1]) if len(sys.argv)>1 else 1;p=OUT/f'{d}-{attempt}.png'
 if not p.exists():continue
 src=Image.open(OUT/f'{d}-source.png').convert('RGBA');raw=Image.open(p);im=key(raw).resize(src.size,Image.Resampling.LANCZOS)
 # Keep canvas-coordinate scale. Translation-only upper-body registration.
 a=np.array(src);b=np.array(im);ys,xs=np.where(a[:,:,3]>127);top=int(ys.min());height=int(ys.max()+1-top)
 reg=track.register(a,b,[max(0,int(xs.min())-5),top,min(src.width,int(xs.max())+6),top+int(height*.62)],radius=100,masked=True)
 offset=(-round(reg['dx']),-round(reg['dy']));aligned=Image.new('RGBA',src.size);aligned.alpha_composite(im,offset);aligned.save(OUT/f'{d}-{attempt}-keyed.png')
 aa=np.array(aligned.getchannel('A'));head=float(np.linalg.norm(centroid(aa,0,.23)-centroid(a[:,:,3],0,.23)));torso=float(np.linalg.norm(centroid(aa,.25,.62)-centroid(a[:,:,3],.25,.62)))
 rec=dict(direction=d,walk=walk,frame=i,attempt=attempt,rawSize=raw.size,canvas=src.size,translation=offset,registration=reg,headPx=head,torsoPx=torso);records.append(rec)
 sheet=Image.new('RGB',(src.width*4,src.height+40),'#505058');draw=ImageDraw.Draw(sheet)
 old=Image.open(SPR/('hermes-idle-v2-normalized.png' if d=='side' else f'hermes-{d}-keyframe.png')).convert('RGBA')
 if d=='side':old=old.crop((0,0,612,1059))
 old.thumbnail(src.size)
 for k,(label,img) in enumerate([('SOURCE',src),('EDIT KEYED',aligned),('OVERLAY',Image.blend(src,aligned,.5)),('OLD REFERENCE',old)]):
  bg=Image.new('RGBA',src.size,'#828282');bg.alpha_composite(img);sheet.paste(bg.convert('RGB'),(k*src.width,40));draw.text((k*src.width+5,5),label,fill='white')
 sheet.save(OUT/f'{d}-{attempt}-review.png')
(OUT/f'registration-{attempt}.json').write_text(json.dumps(records,indent=2)+'\n');print(json.dumps(records,indent=2))
for r in records:
 m=json.loads((SPR/(r['walk']+'.json')).read_text());c=m['contacts'][r['frame']];foot=c['planted'];q=c[foot];src=np.array(Image.open(OUT/(r['direction']+'-source.png')).convert('RGBA'));dst=np.array(Image.open(OUT/f'{r["direction"]}-{attempt}-keyed.png'))
 reg=track.register(src,dst,[max(0,round(q['x']-65)),max(0,round(q['y']-80)),min(src.shape[1],round(q['x']+65)),min(src.shape[0],round(q['y']+15))],radius=100,masked=True)
 print(r['direction'],'sole',foot,reg)
