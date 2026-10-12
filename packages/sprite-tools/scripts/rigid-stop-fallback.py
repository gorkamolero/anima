#!/usr/bin/env python3
"""Reviewable rigid-piece fallback. No painting, warping, or translucent limbs.

The source swing leg is rigidly fitted to the target mask. The planted piece
is unchanged. A failed endpoint fit is reported, never hidden by an end cut.
"""
import json
from pathlib import Path
import cv2
import numpy as np
from PIL import Image, ImageDraw
from scipy.optimize import differential_evolution

ROOT=Path('tmp/walkqa/verification-17')
# Hand-reviewed segmentation boundaries follow the visible leg separation.
# Pixels are always intersected with the original alpha, never filled in.
REGIONS={
 'side':{'hip':620,'source':[(0,620),(316,620),(250,724),(343,945),(351,978),(300,1001),(273,1045),(0,1059)],'target':[(0,620),(317,620),(331,906),(364,977),(316,1014),(0,1059)]},
 'away-right':{'hip':610,'source':[(328,610),(612,610),(612,1059),(336,1059),(325,980),(226,900),(266,833),(376,702)],'target':[(305,610),(612,610),(612,1059),(300,1059)]},
 'away':{'hip':620,'source':[(309,620),(612,620),(612,1059),(309,1059)],'target':[(309,620),(612,620),(612,1059),(309,1059)]},
 'toward':{'hip':600,'source':[(0,600),(302,600),(302,1059),(0,1059)],'target':[(0,600),(302,600),(302,1059),(0,1059)]},
 'toward-right':{'hip':620,'source':[(301,620),(612,620),(612,1059),(303,1059),(296,923),(335,744)],'target':[(301,620),(612,620),(612,1059),(303,1059),(296,923),(335,744)]},
}
def piece(im,polygon):
 m=Image.new('L',im.size);ImageDraw.Draw(m).polygon(polygon,fill=255)
 a=np.array(im);a[:,:,3]=np.minimum(a[:,:,3],np.array(m));return a

def main():
 records=[]
 for heading,r in REGIONS.items():
  d=ROOT/heading;out=d/'rigid';out.mkdir(exist_ok=True)
  a=np.array(Image.open(d/'first-alpha.png'));b=np.array(Image.open(d/'last-alpha.png'))
  source=piece(Image.fromarray(a),r['source']);target=piece(Image.fromarray(b),r['target'])
  sm=source[:,:,3]>127;tm=target[:,:,3]>127
  ys,xs=np.where(sm);pivot=(float(xs.mean()),float(ys.mean()))
  def matrix(params):
   angle,dx,dy=params;m=cv2.getRotationMatrix2D(pivot,angle,1);m[:,2]+=[dx,dy];return m
  def moved(params,arr):return cv2.warpAffine(arr,matrix(params),(a.shape[1],a.shape[0]),flags=cv2.INTER_NEAREST)
  def loss(params):
   mask=moved(params,sm.astype('uint8'))>0
   return 1-np.logical_and(mask,tm).sum()/max(1,np.logical_or(mask,tm).sum())
  fit=differential_evolution(loss,[(-45,45),(-160,160),(-100,100)],seed=17,popsize=8,maxiter=45,polish=False)
  upper_a=a.copy();upper_a[r['hip']:]=0;upper_b=b.copy();upper_b[r['hip']:]=0
  ma=upper_a[:,:,3]>127;mb=upper_b[:,:,3]>127;iou=float((ma&mb).sum()/max(1,(ma|mb).sum()))
  planted=a.copy();planted[:r['hip']]=0;planted[source[:,:,3]>0]=0
  Image.fromarray(source).save(out/'swing-source.png');Image.fromarray(target).save(out/'swing-target.png');Image.fromarray(planted).save(out/'planted.png')
  frames=[]
  for i in range(9):
   t=i/8
   # Crossfade only common opaque interior at >=.97 IoU; boundary is a cut.
   upper=(upper_a if t<.5 else upper_b).copy()
   if iou>=.97:
    common=(upper_a[:,:,3]==255)&(upper_b[:,:,3]==255)
    upper[common,:3]=np.round(upper_a[common,:3]*(1-t)+upper_b[common,:3]*t).astype('uint8')
   result=Image.fromarray(moved(fit.x*t,source));result.alpha_composite(Image.fromarray(planted));result.alpha_composite(Image.fromarray(upper))
   result.save(out/f'frame-{i:02}.png');frames.append(result)
  sheet=Image.new('RGBA',(a.shape[1]*9,a.shape[0]));overview=Image.new('RGB',(306*9,550),'#808080');draw=ImageDraw.Draw(overview)
  for i,f in enumerate(frames):
   sheet.paste(f,(i*a.shape[1],0));bg=Image.new('RGBA',f.size,(128,128,128,255));bg.alpha_composite(f);overview.paste(bg.convert('RGB').resize((306,530)),(306*i,20));draw.text((306*i+5,4),str(i),fill='white')
   bg.resize((1224,2118),Image.Resampling.NEAREST).save(out/f'review-{i:02}-2x.png')
  sheet.save(out/'candidate-sheet.png');overview.save(out/'overview.png')
  record={'heading':heading,'upperIoU':iou,'upperMethod':'common opaque interior crossfade' if iou>=.97 else 'midpoint cut','rigidAngleTranslation':fit.x.tolist(),'swingEndpointIoU':1-float(fit.fun),'plantedPixels':'unchanged source visible pixels','status':'candidate, endpoint mismatch requires visual rejection or acceptance'}
  (out/'fit.json').write_text(json.dumps(record,indent=2));records.append(record);print(record,flush=True)
 (ROOT/'rigid-summary.json').write_text(json.dumps(records,indent=2))
if __name__=='__main__':main()
