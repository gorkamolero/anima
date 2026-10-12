import pathlib,json,subprocess
from PIL import Image,ImageDraw
root=pathlib.Path('tmp/walkqa'); result=[]
for p in sorted((root/'exits-07').glob('*/*.mp4')):
 rows=json.loads(p.with_suffix('.json').read_text());cross=[i for i in range(1,len(rows)) if rows[i]['location']!=rows[i-1]['location']];idx=sorted(set([0,len(rows)-1]+[j for i in cross for j in [i-1,i,min(i+1,len(rows)-1)]]));paths=[]
 for i in idx:
  dest=p.parent/(p.stem+f'-f{i:04}.png');subprocess.run(['ffmpeg','-v','error','-y','-i',str(p),'-vf',f'select=eq(n\\,{i})','-frames:v','1',str(dest)],check=True);paths.append(str(dest.relative_to(root)))
 sheet=Image.new('RGB',(640*len(paths),380),'white');d=ImageDraw.Draw(sheet)
 for j,f in enumerate(paths):
  im=Image.open(root/f);im.thumbnail((640,360));sheet.paste(im,(640*j,20));d.text((640*j,2),pathlib.Path(f).name,fill='black')
 sheet.save(p.parent/(p.stem+'-sheet.png'))
 result.append({'clip':str(p.relative_to(root)),'transitions':cross,'locations':list(dict.fromkeys(r['location'] for r in rows)),'frames':paths})
(root/'verification-07/exits.json').write_text(json.dumps(result,indent=2));print(json.dumps(result,indent=2))
