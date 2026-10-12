#!/usr/bin/env python3
"""Brief 14: restore full generated canvases, then register upper bodies by translation.
Preserves generated alpha. No remote calls, compositing, or changes to walk art.
"""
import importlib.util
import json
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw
ROOT=Path(__file__).resolve().parents[3]
SPR=ROOT/'adventures/shadow-over-innsmouth/public/assets/sprites/hermes'
OUT=ROOT/'tmp/walkqa/verification-14/edits'
spec=importlib.util.spec_from_file_location('tracking',Path(__file__).with_name('root-motion.py'))
tracking=importlib.util.module_from_spec(spec);spec.loader.exec_module(tracking)
def main():
 records=[]
 for d,(walk,frame) in json.loads((OUT/'selection.json').read_text()).items():
  attempt=2 if d in ['side','toward','away-right'] else 1
  source=Image.open(OUT/f'{d}-source.png').convert('RGBA');raw=Image.open(OUT/f'{d}-{attempt}.png').convert('RGBA');im=raw.resize(source.size,Image.Resampling.LANCZOS)
  a=np.array(source);ys,xs=np.where(a[:,:,3]>127);top=int(ys.min());height=int(ys.max()+1-top)
  roi=[max(0,int(xs.min())-5),top,min(source.width,int(xs.max())+6),top+int(height*.62)]
  walkmeta=json.loads((SPR/(walk+'.json')).read_text());contact=walkmeta['contacts'][frame];q=contact[contact['planted']]
  bootroi=[max(0,round(q['x']-45)),max(0,round(q['y']-55)),min(im.width,round(q['x']+45)),min(im.height,round(q['y']+15))]
  trials=[]
  for scale in np.arange(1,1.041,.005):
   scaled=im.resize((round(im.width*scale),round(im.height*scale)),Image.Resampling.LANCZOS)
   canvas=Image.new('RGBA',source.size);canvas.alpha_composite(scaled,(0,0))
   reg=tracking.register(a,np.array(canvas),roi,radius=100,masked=True)
   offset=(-round(reg['dx']),-round(reg['dy']));aligned=Image.new('RGBA',source.size);aligned.alpha_composite(canvas,offset)
   boot=tracking.register(a,np.array(aligned),bootroi,radius=70,masked=True)
   # A single isotropic scale for the entire image, fitted to the preserved
   # upper body and planted boot. No part-specific warp or compositing.
   objective=abs(boot['dy'])+100*reg['residual']
   trials.append((objective,float(scale),reg,offset,aligned,boot))
  _,scale,reg,offset,aligned,boot=min(trials,key=lambda t:t[0])
  aligned.save(OUT/f'{d}-registered.png')
  meta={'direction':d,'reference':walk,'sourceFrame':frame,'editAttempt':attempt,'sourceCanvas':list(source.size),'generatedCanvas':list(raw.size),'uniformScale':scale,'translation':list(offset),'scaleTrials':[{'scale':t[1],'objective':t[0],'boot':t[5]} for t in trials],'upperBodyRegistration':reg,'method':'restore full canvas, preserve generated alpha, single whole-image uniform scale plus upper-body translation, scale fitted to preserved planted boot'};records.append(meta)
  sheet=Image.new('RGB',(source.width*3,source.height+40),'#828282');draw=ImageDraw.Draw(sheet)
  for k,(label,img) in enumerate([('SOURCE',source),('REGISTERED EDIT',aligned),('DEBUG OVERLAY ONLY',Image.blend(source,aligned,.5))]):
   bg=Image.new('RGBA',source.size,'#828282');bg.alpha_composite(img);sheet.paste(bg.convert('RGB'),(k*source.width,40));draw.text((k*source.width+5,5),label,fill='white')
  sheet.save(OUT/f'{d}-review.png')
 (OUT/'normalization.json').write_text(json.dumps(records,indent=2)+'\n');print(json.dumps(records,indent=2))
if __name__=='__main__':main()
