#!/usr/bin/env python3
"""Brief 13: locally key fal edits, restore walk canvas, translate upper body only.
Source edits/manifests are retained in tmp/walkqa/verification-13/edits.
No remote calls. Old keyframe/standing sprites remain unchanged.
"""
import json, importlib.util
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage
ROOT=Path(__file__).resolve().parents[3]
SPR=ROOT/'adventures/shadow-over-innsmouth/public/assets/sprites/hermes'
OUT=ROOT/'tmp/walkqa/verification-13/edits'
spec=importlib.util.spec_from_file_location('tracking',Path(__file__).with_name('root-motion.py'))
tracking=importlib.util.module_from_spec(spec);spec.loader.exec_module(tracking)
# Reviewed physical shoe landmarks. They retain the walk track's within-shoe
# inset (not a bounding-box midpoint masquerading as an anatomical contact).
CHOICES={'side':(2,{'L':(333,1042),'R':(248,1014)}),
 'away':(2,{'L':(290,1016),'R':(340.40,1035.66)}),
 'away-right':(2,{'L':(270,1006),'R':(348,1027)}),
 'toward':(2,{'L':(351.02,1011.73),'R':(263,1022)}),
 'toward-right':(1,{'L':(384,1011),'R':(269.76,1032.60)})}
def key(im):
 rgb=np.array(im.convert('RGB')).astype(float)
 grey=(np.ptp(rgb,axis=2)<15)&(rgb.mean(2)>95)&(rgb.mean(2)<160)
 labels,_=ndimage.label(~grey);sizes=np.bincount(labels.ravel());sizes[0]=0
 body=ndimage.binary_fill_holes(labels==sizes.argmax());body[rgb.shape[0]//2:]&=~grey[rgb.shape[0]//2:]
 interior=ndimage.binary_erosion(body,iterations=2)
 _,indices=ndimage.distance_transform_edt(~interior,return_indices=True)
 fg=rgb[tuple(indices)];bg=np.median(rgb[grey],axis=0);delta=fg-bg
 alpha=np.clip(((rgb-bg)*delta).sum(2)/np.maximum((delta*delta).sum(2),1),0,1)
 alpha[interior]=1;alpha[~ndimage.binary_dilation(body)]=0
 cleaned=np.clip((rgb-(1-alpha[...,None])*bg)/np.maximum(alpha[...,None],.001),0,255)
 return Image.fromarray(np.dstack([cleaned,alpha*255]).astype('uint8'))
def main():
 records=[]
 for d,(walk,frame) in json.loads((OUT/'selection.json').read_text()).items():
  attempt,points=CHOICES[d];source=Image.open(OUT/f'{d}-source.png').convert('RGBA');raw=Image.open(OUT/f'{d}-{attempt}.png')
  im=key(raw).resize(source.size,Image.Resampling.LANCZOS)
  a=np.array(source);ys,xs=np.where(a[:,:,3]>127);top=int(ys.min());height=int(ys.max()+1-top)
  reg=tracking.register(a,np.array(im),[max(0,int(xs.min())-5),top,min(source.width,int(xs.max())+6),top+int(height*.62)],radius=100,masked=True)
  offset=(-round(reg['dx']),-round(reg['dy']));aligned=Image.new('RGBA',source.size);aligned.alpha_composite(im,offset)
  name=f'hermes-matched-stand-{d}';aligned.save(SPR/(name+'.png'))
  meta={'name':name,'image':name+'.png','frameWidth':source.width,'frameHeight':source.height,'frameCount':1,'cols':1,'rows':1,'fps':24,'contacts':[{**{f:{'x':x,'y':y} for f,(x,y) in points.items()},'planted':'L'}],'switchFrames':[],
    'normalization':{'reference':walk,'sourceFrame':frame,'editAttempt':attempt,'sourceCanvas':list(source.size),'generatedCanvas':list(raw.size),'translation':list(offset),'upperBodyRegistration':reg,'method':'restore full canvas dimensions, local grey key, translation-only upper-body registration; reviewed shoe landmarks','origin':[.5,1]}}
  (SPR/(name+'.json')).write_text(json.dumps(meta,indent=2)+'\n');records.append(meta)
  bg=Image.new('RGBA',source.size,'magenta');bg.alpha_composite(aligned);draw=ImageDraw.Draw(bg)
  for f,(x,y) in points.items():draw.ellipse((x-5,y-5,x+5,y+5),fill='cyan' if f=='L' else 'yellow');draw.text((x+8,y-18),f,fill='white')
  bg.resize((source.width*2,source.height*2),Image.Resampling.NEAREST).save(OUT/f'{d}-contacts-2x.png')
 (OUT/'normalization.json').write_text(json.dumps(records,indent=2)+'\n')
if __name__=='__main__':main()
