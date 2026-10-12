"""Brief 19: existing B candidates, boot-masked translation and approved boot repair."""
import copy, json, importlib.util
from pathlib import Path
import numpy as np
import cv2
from PIL import Image, ImageDraw, ImageFilter
OUT=Path('tmp/walkqa/verification-19'); OLD=Path('tmp/walkqa/verification-18/side'); SPR=Path('adventures/shadow-over-innsmouth/public/assets/sprites/hermes')
spec=importlib.util.spec_from_file_location('key','packages/sprite-tools/scripts/matched-standing.py'); k=importlib.util.module_from_spec(spec);spec.loader.exec_module(k)
a=Image.open(OLD/'A-1/registered.png').convert('RGB'); aa=np.array(a); w,h=a.size
# Only the rear/right planted boot: exclude the free boot and trousers.
mask=Image.new('L',a.size);ImageDraw.Draw(mask).rectangle((336,992,381,1024),fill=255)
mask.save(OUT/'planted-boot-mask.png'); mm=np.array(mask)>0
records=[]; candidates=[]
for n in [1,2]:
 raw=Image.open(OLD/f'B-{n}/raw.png').convert('RGB').resize(a.size,Image.Resampling.LANCZOS)
 # Masked normalized correlation restricted to the planted sole contact patch.
 template=np.array(a.convert('L'))[992:1025,336:382]
 search=np.array(raw.convert('L'))[972:1045,316:402]
 scores=cv2.matchTemplate(search,template,cv2.TM_CCOEFF_NORMED)
 _,confidence,_,point=cv2.minMaxLoc(scores)
 best=(1-confidence,20-point[0],20-point[1])
 score,dx,dy=best;b=Image.new('RGB',a.size,(128,128,128));b.paste(raw,(dx,dy));b.save(OUT/f'B{n}-registered.png');candidates.append(b)
 records.append(dict(candidate=n,translation=[dx,dy],maskedCorrelation=1-score))
# B1 has the smaller upper-body seam after sole registration.
b=candidates[0]
# Include the entire union of the redrawn planted boot and original silhouette,
# feather inward at the cuff (<=2 source pixels); restore A's exact boot/contact.
erase=Image.new('L',a.size);ImageDraw.Draw(erase).polygon([(260,1015),(282,1015),(282,1040),(260,1040)],fill=255)
b=Image.composite(Image.new('RGB',a.size,(128,128,128)),b,erase)
repair=Image.new('L',a.size);ImageDraw.Draw(repair).polygon([(282,1014),(326,989),(342,975),(345,968),(418,968),(427,1036),(282,1036)],fill=255)
repair=repair.filter(ImageFilter.GaussianBlur(.65));repair.save(OUT/'boot-repair-mask.png');b=Image.composite(a,b,repair);b.save(OUT/'B1-boot-locked.png')
frames=[Image.open('tmp/walkqa/verification-16b/sources/side-first-alpha.png').convert('RGBA'),Image.open(OLD/'A-1/registered-alpha.png').convert('RGBA'),k.key(b)]
r=next(r for r in json.loads(Path('tmp/walkqa/verification-16b/sources.json').read_text()) if r['heading']=='side');cycle=json.loads((SPR/(r['cycle']+'.json')).read_text());c=copy.deepcopy(r['contact']);c.update(cycle['reviewedFreeBootSoles'][str(r['frame'])]);contacts=[copy.deepcopy(c) for _ in frames];contacts[2]['L']={'x':249,'y':998}
for i,f in enumerate(frames):f.save(OUT/f'frame-{i}.png')
for mirror in [False,True]:
 sheet=Image.new('RGBA',(w*3,h));review=Image.new('RGB',(w*3,h+35),'gray');dr=ImageDraw.Draw(review)
 for i,f in enumerate(frames):
  if mirror:f=f.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
  sheet.paste(f,(w*i,0));review.paste(f,(w*i,35),f);dr.text((w*i+8,8),['EXIT','A: ARMS','B1: REST / PLANTED BOOT FROM A'][i],fill='white')
 suffix='-mirrored' if mirror else '';sheet.save(OUT/f'stop-sheet{suffix}.png');review.save(OUT/f'review{suffix}.png')
name='hermes-passing-stand-side';sheet=Image.new('RGBA',(w*3,h))
for i,f in enumerate(reversed(frames)):sheet.paste(f,(w*i,0))
sheet.save(SPR/(name+'.png'))
m=dict(name=name,image=name+'.png',frameWidth=w,frameHeight=h,frameCount=3,cols=3,rows=1,fps=24,contacts=list(reversed(contacts)),bootSoles=[{f:q for f,q in c.items() if f!='planted'} for c in reversed(contacts)],switchFrames=[],settleFrames=[2,1,0],sourceFrame=r['frame'],reference=r['cycle'],normalization=dict(reference=r['cycle'],sourceFrame=r['frame'],method='existing provider raster restored to source canvas; planted-boot masked integer translation; B1 planted boot restored from A with <=2px feather',registration=records,selected='B1'))
(SPR/(name+'.json')).write_text(json.dumps(m,indent='\t')+'\n');(OUT/'registration.json').write_text(json.dumps(records,indent=2)+'\n');print(records)
