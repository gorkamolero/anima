import pathlib,json,subprocess
root=pathlib.Path(__file__).resolve().parents[3]/'tmp/walkqa'
def baseline(points,x):
 if x<=points[0]['x']:return points[0]['y']
 for a,b in zip(points,points[1:]):
  if x<=b['x']:return b['y'] if a['x']==b['x'] else a['y']+(b['y']-a['y'])*(x-a['x'])/(b['x']-a['x'])
 return points[-1]['y']
report=[]
for folder in sorted((root/'occlusion-07').glob('*/*')):
 if not folder.is_dir():continue
 for video in sorted(folder.glob('*.mp4')):
  rows=json.loads(video.with_suffix('.json').read_text());crossings=[]
  for i,(a,b) in enumerate(zip(rows,rows[1:]),1):
   o=next((v for v in b.get('occluders',[]) if v['id']==folder.name),None)
   if not o:continue
   if (a['depth']<next(v['depth'] for v in a['occluders'] if v['id']==folder.name)) != (b['depth']<o['depth']):crossings.append(i)
  indices=sorted(set(j for i in crossings for j in [max(0,i-1),i,min(len(rows)-1,i+1)]))
  if not indices:indices=[0,len(rows)-1]
  paths=[]
  for i in indices:
   dest=folder/(video.stem+f'-f{i:04}.png')
   subprocess.run(['ffmpeg','-v','error','-y','-i',str(video),'-vf',f'select=eq(n\\,{i})','-frames:v','1',str(dest)],check=True)
   paths.append(str(dest.relative_to(root)))
  report.append({'scene':folder.parent.name,'object':folder.name,'clip':str(video.relative_to(root)),'crossings':crossings,'frames':paths,'walkingFrames':sum(bool(r['walking']) for r in rows)})
(root/'verification-07'/'crossings.json').write_text(json.dumps(report,indent=2));print(json.dumps(report,indent=2))
