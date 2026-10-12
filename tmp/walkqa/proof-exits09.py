import pathlib,json,subprocess
from PIL import Image,ImageDraw
root=pathlib.Path('tmp/walkqa');report=[]
for name in ['outside-left','outside-right','road-left','road-left-1','road-left-2','road-far','alley-far','depot-door']:
 folder=root/'proof-09/exits'/name
 legs=['door-outside-to-inside','door-inside-to-outside'] if name=='depot-door' else ['out','back'];panels=[]
 for leg in legs:
  a=json.loads((folder/(leg+'.json')).read_text());changes=[i for i in range(1,len(a))if a[i]['location']!=a[i-1]['location']];dest=a[-1]['location'];arrival=next((i for i,r in enumerate(a)if r['location']==dest and r['visible']),0)
  indices=sorted(set([max(0,changes[0]-1),changes[0],min(len(a)-1,changes[0]+1),arrival,len(a)-1])) if changes else [0,len(a)-1]
  paths=[]
  for n in indices:
   p=folder/f'{leg}-review-{n:04}.png';subprocess.run(['ffmpeg','-v','error','-y','-i',str(folder/(leg+'.mp4')),'-vf',f'select=eq(n\\,{n})','-frames:v','1',str(p)],check=True);im=Image.open(p).resize((768,432));ImageDraw.Draw(im).text((8,160),f'{leg} frame {n}; x={a[n]["x"]:.1f}, y={a[n]["y"]:.1f}; walking={a[n]["walking"]}',fill='yellow',stroke_width=2,stroke_fill='black');panels.append(im);paths.append(str(p))
  r=a[arrival];crop=Image.open(folder/f'{leg}-review-{arrival:04}.png');x=max(0,min(1540,round(r['x']-190)));y=max(0,round(r['y']-420));crop=crop.crop((x,y,x+380,min(1080,round(r['y']+40))));crop.resize((crop.width*2,crop.height*2)).save(folder/(leg+'-arrival-2x.png'))
  report.append({'exit':name,'leg':leg,'clip':str(folder/(leg+'.mp4')),'changes':changes,'source':a[0]['location'],'destination':dest,'firstVisible':{'frame':arrival,'x':r['x'],'y':r['y'],'scale':r['scale']},'arrivalWalking':sum(r['visible'] and r['walking'] and r['location']==dest for r in a),'frames':paths})
 sheet=Image.new('RGB',(768*5,432*2))
 for i,im in enumerate(panels):sheet.paste(im,((i%5)*768,(i//5)*432))
 sheet.save(folder/'review-sheet.png')
(root/'verification-09/proof-exits-review.json').write_text(json.dumps(report,indent=2))
