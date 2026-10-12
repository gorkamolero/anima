"""Restore provider raster to input canvas, then register by integer translation only."""
import importlib.util,json,sys
from pathlib import Path
import cv2,numpy as np
from PIL import Image,ImageDraw
spec=importlib.util.spec_from_file_location('stops','packages/sprite-tools/scripts/matched-standing.py');s=importlib.util.module_from_spec(spec);spec.loader.exec_module(s)
s.matte=s.key
h,step,attempt=sys.argv[1:4];d=Path('tmp/walkqa/verification-18')/h/(step+'-'+attempt)
a=Image.open(d/'source.png').convert('RGB');raw=Image.open(d/'raw.png').convert('RGB');b=raw.resize(a.size,Image.Resampling.LANCZOS)
r=next(r for r in json.loads(Path('tmp/walkqa/verification-16b/sources.json').read_text()) if r['heading']==h)
x,y=[round(r['contact'][r['contact']['planted']][k]) for k in ['x','y']]
# Local physical planted boot search, bounded to exclude the other boot.
box=(x-23,y-28,x+23,min(y+5,a.height));margin=16
aa=np.asarray(a.convert('L'));bb=np.asarray(b.convert('L'))
x0,y0,x1,y1=box;sx0=max(0,x0-margin);sy0=max(0,y0-margin);sx1=min(a.width,x1+margin);sy1=min(a.height,y1+margin)
score=cv2.matchTemplate(bb[sy0:sy1,sx0:sx1],aa[y0:y1,x0:x1],cv2.TM_CCOEFF_NORMED);_,conf,_,loc=cv2.minMaxLoc(score);dx=x0-(sx0+loc[0]);dy=y0-(sy0+loc[1]);dst=Image.new('RGB',a.size,(128,128,128));dst.paste(b,(dx,dy));dst.save(d/'registered.png');s.matte(dst).save(d/'registered-alpha.png')
pa,pb=np.array(s.matte(a)),np.array(s.matte(dst));ys=np.where(pa[:,:,3]>127)[0];top,bottom=ys.min(),ys.max()+1
metrics={}
for name,lo,hi in [('head',0,.23),('torso',.25,.62),('legs',.65,1)]:
 y0,y1=int(top+(bottom-top)*lo),int(top+(bottom-top)*hi)
 centers=[]
 for p in [pa,pb]:
  weight=p[y0:y1,:,3].astype(float);yy,xx=np.indices(weight.shape);centers.append(np.array([(xx*weight).sum()/weight.sum(),((yy+y0)*weight).sum()/weight.sum()]))
 metrics[name+'CentroidSourcePx']=float(np.linalg.norm(centers[1]-centers[0]))
 mask=(pa[y0:y1,:,3]>127)&(pb[y0:y1,:,3]>127)
 metrics[name+'RgbMAE']=float(np.abs(pa[y0:y1,:,:3].astype(float)-pb[y0:y1,:,:3]).mean(2)[mask].mean())
info=dict(heading=h,step=step,attempt=int(attempt),sourceSize=a.size,providerSize=raw.size,canvasConversion='fixed raster resampling to input dimensions; no fitted scaling',translation=[dx,dy],plantedBootCorrelation=conf,**metrics)
(d/'registration.json').write_text(json.dumps(info,indent=2)+'\n')
out=Image.new('RGB',(a.width*3,a.height+30),(128,128,128));draw=ImageDraw.Draw(out)
for i,(label,im) in enumerate([('PREVIOUS',a),('EDIT REGISTERED',dst),('DIFFERENCE x3',Image.fromarray(np.minimum(255,np.abs(np.array(a).astype(float)-np.array(dst))*3).astype('uint8')))]):out.paste(im,(i*a.width,30));draw.text((i*a.width+5,5),label,fill='white')
out.save(d/'comparison.png');print(json.dumps(info))
