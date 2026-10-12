"""Retain every generated frame and exact source crops; no synthesized artwork."""
import json
from pathlib import Path
from PIL import Image,ImageDraw
root=Path('tmp/walkqa/verification-16')
records=[]
for d in sorted(root.glob('*')):
 if not (d/'raw.mp4').exists():continue
 paths=sorted((d/'raw-frames').glob('*.png'))
 # All 24 fps frames, numbered from zero, with no temporal gaps.
 sheet=Image.new('RGB',(153*8,285*((len(paths)+7)//8)),'#333333');dr=ImageDraw.Draw(sheet)
 for i,p in enumerate(paths):
  x=i%8*153;y=i//8*285;sheet.paste(Image.open(p).resize((153,265)),(x,y));dr.text((x+4,y+267),str(i),fill='white')
 sheet.save(d/'all-frames.png')
 # Detail panels at twice walk-canvas pixel size: first foot lift / extra stride.
 selected=[0,6,12,18,24,36]
 crop=(0,790,612,1059)
 zoom=Image.new('RGB',(1224*3,568*2),'#333333');dz=ImageDraw.Draw(zoom)
 for n,i in enumerate(selected):
  x=n%3*1224;y=n//3*568
  im=Image.open(paths[i]).crop(crop).resize((1224,538),Image.Resampling.NEAREST)
  zoom.paste(im,(x,y));dz.text((x+10,y+542),f'{d.name} frame {i}',fill='white')
 zoom.save(d/'feet-rejection-2x.png')
 request=json.loads((d/'request.json').read_text())
 records.append(dict(take=d.name,requestId=request['request_id'],frames=len(paths),accepted=False,reason='Additional walking and support-foot lift before rest; no single stationary support from frame zero to rest.'))
(root/'generation-review.json').write_text(json.dumps(records,indent=2)+'\n')
