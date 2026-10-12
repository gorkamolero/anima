import json,pathlib,subprocess,math
from PIL import Image,ImageDraw
root=pathlib.Path('tmp/walkqa');d=json.loads((root/'geometry-final-09/depot-outside/navigation.json').read_text());p=d['area']['perspective'];rows=[]
for x in [1100,1150,1180,1200,1240,1280,1320]:
 m=d['area']['rawMask'];ys=[y*5 for y in range(216)if m['data'][y*384+x//5] and 700<=y*5<730];lo=min(ys)if ys else None;hi=max(ys)+5 if ys else None
 rows.append({'x':x,'rearBandY':[lo,hi],'screenDepthPx':hi-lo if ys else 0,'lateralClearanceDiameterPx':.3*p['pixelsPerMetre']*p['slope']*(712.5-p['horizonY']),'note':'Lateral diameter is NOT a ground-depth measurement; this is a reconstruction/stride limitation, not proven narrow artwork.'})
(root/'verification-09/dock-strip-measurements.json').write_text(json.dumps(rows,indent=2))
exec(open('tmp/walkqa/overlay09.py').read().replace('geometry-09','geometry-final-09'))
im=Image.open(root/'walkareas-09/depot-outside.png');draw=ImageDraw.Draw(im)
for x in [1100,1180,1280]:
 draw.line((x,705,x,720),fill='white',width=3);draw.text((x-30,725),'15 px floor',fill='white',stroke_width=2,stroke_fill='black')
crop=im.crop((1000,570,1480,900));crop.resize((960,660)).save(root/'verification-09/dock-rear-strip-2x.png')
for name in ['bench','net']:
 folder=root/'proof-09/limitations/dock';a=json.loads((folder/'rear-traverse-attempt.json').read_text());i=len(a)-1
 dest=root/'verification-09'/f'{name}-attempt-end.png';subprocess.run(['ffmpeg','-v','error','-y','-i',str(folder/('rear-traverse-attempt.mp4')),'-vf',f'select=eq(n\\,{i})','-frames:v','1',str(dest)],check=True)
 im=Image.open(dest);crop=im.crop((980,440,1480,930));crop.resize((1000,980)).save(dest.with_name(name+'-attempt-end-2x.png'))
