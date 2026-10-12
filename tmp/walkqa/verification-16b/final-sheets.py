"""Review artifacts only: every decoded frame, plus native 2x foot crops."""
from pathlib import Path
from PIL import Image, ImageDraw
import hashlib,json

root=Path('tmp/walkqa/verification-16b')
videos=[]
for d in sorted(root.iterdir()):
    if not (d/'raw.mp4').exists(): continue
    paths=sorted((d/'raw-frames').glob('*.png'))
    if not paths: continue
    body=Image.new('RGB',(153*8,285*((len(paths)+7)//8)),'#444')
    feet=Image.new('RGB',(1224*4,558*((len(paths)+3)//4)),'#444')
    bd,fd=ImageDraw.Draw(body),ImageDraw.Draw(feet)
    for i,p in enumerate(paths):
        im=Image.open(p).convert('RGB')
        x,y=i%8*153,i//8*285
        body.paste(im.resize((153,265)),(x,y));bd.text((x,y+267),str(i),fill='white')
        x,y=i%4*1224,i//4*558
        feet.paste(im.crop((0,790,612,1059)).resize((1224,538),Image.Resampling.NEAREST),(x,y))
        fd.text((x+5,y+540),f'frame {i}',fill='white')
    body.save(d/'all-frames.png');feet.save(d/'feet-full-2x.png')
    videos.append({'name':d.name,'frames':len(paths),'sha256':hashlib.sha256((d/'raw.mp4').read_bytes()).hexdigest(),'input':json.loads((d/'input.json').read_text()),'requestId':json.loads((d/'request.json').read_text())['request_id']})
(root/'videos.json').write_text(json.dumps(videos,indent=2))
print('Saved full-sequence review sheets for',len(videos),'videos')
