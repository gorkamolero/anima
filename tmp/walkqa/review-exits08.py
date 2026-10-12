import pathlib,json,subprocess
from PIL import Image,ImageDraw
root=pathlib.Path('tmp/walkqa/exits-08');report=[]
for folder in root.iterdir():
 if not (folder/'render.json').exists():continue
 legs=['door-outside-to-inside','door-inside-to-outside'] if folder.name=='depot-door' else ['out','back'];panels=[]
 for leg in legs:
  a=json.loads((folder/(leg+'.json')).read_text());dest=a[-1]['location'];changes=[i for i in range(1,len(a))if a[i]['location']!=a[i-1]['location']];arrival=next((i for i,r in enumerate(a)if r['location']==dest and r['visible']),0);walking=sum(r['visible'] and r['walking'] and r['location']==dest for r in a)
  indices=sorted(set([max(0,(changes[0] if changes else 1)-1),min(len(a)-1,arrival+6),len(a)-1]));paths=[]
  for n in indices:
   p=folder/f'{leg}-review-{n:04}.png';subprocess.run(['ffmpeg','-v','error','-y','-i',str(folder/(leg+'.mp4')),'-vf',f'select=eq(n\\,{n})','-frames:v','1',str(p)],check=True);im=Image.open(p).resize((960,540));ImageDraw.Draw(im).text((8,180),f'{leg} frame {n}, location {a[n]["location"]}, walking {a[n]["walking"]}',fill='yellow',stroke_width=2,stroke_fill='black');panels.append(im);paths.append(str(p))
  report.append({'exit':folder.name,'leg':leg,'changes':changes,'source':a[0]['location'],'destination':dest,'arrivalWalking':walking,'frames':paths})
 if len(panels)==6:
  sheet=Image.new('RGB',(2880,1080))
  for i,im in enumerate(panels):sheet.paste(im,((i%3)*960,(i//3)*540))
  sheet.save(folder/'review-sheet.png')
pathlib.Path('tmp/walkqa/verification-08/exits-review.json').write_text(json.dumps(report,indent=2))
