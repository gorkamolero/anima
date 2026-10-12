import subprocess,sys
from pathlib import Path
from PIL import Image,ImageDraw
for heading in sys.argv[1:]:
 d=Path('tmp/walkqa/verification-16')/heading
 if not (d/'raw.mp4').exists():continue
 frames=d/'raw-frames';frames.mkdir(exist_ok=True)
 subprocess.run(['ffmpeg','-v','error','-i',str(d/'raw.mp4'),'-vf','fps=24,scale=612:1059','-y',str(frames/'%03d.png')],check=True)
 paths=sorted(frames.glob('*.png'));out=Image.new('RGB',(8*153,((len(paths[::3])+7)//8)*285),'#444444');draw=ImageDraw.Draw(out)
 for n,p in enumerate(paths[::3]):
  im=Image.open(p).resize((153,265));x=n%8*153;y=n//8*285;out.paste(im,(x,y));draw.text((x,y+265),str(int(p.stem)-1),fill='white')
 out.save(d/'overview.png')
