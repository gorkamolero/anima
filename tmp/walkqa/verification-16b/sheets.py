from pathlib import Path
from PIL import Image,ImageDraw
import sys
for name in sys.argv[1:]:
 d=Path('tmp/walkqa/verification-16b')/name; ps=sorted((d/'raw-frames').glob('*.png'));out=Image.new('RGB',(8*340,((len(ps)+7)//8)*260),'#444');dr=ImageDraw.Draw(out)
 for i,p in enumerate(ps):
  im=Image.open(p).crop((220,900,390,1020)).resize((340,240));x=i%8*340;y=i//8*260;out.paste(im,(x,y));dr.text((x,y+242),str(i),fill='white')
 out.save(d/'feet-all-2x.png')
