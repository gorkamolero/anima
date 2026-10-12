import json,pathlib
root=pathlib.Path(__file__).resolve().parents[3]/'tmp/walkqa'
for scene in ['depot-outside','depot-inside','road','alley']:
 d=json.loads((root/'geometry-07'/scene/'navigation.json').read_text());m=d['area']['mask'];rows=[]
 for y in range(m['height']):
  runs=[];start=None
  for x in range(m['width']+1):
   on=x<m['width'] and m['data'][y*m['width']+x]
   if on and start is None:start=x
   if not on and start is not None:runs.append((x-start,start,x-1));start=None
  if runs:
   n,l,r=max(runs)
   if n>=25:rows.append((y,l,r))
 beats=[]
 if rows:
  far,near=rows[len(rows)//5],rows[len(rows)*4//5]
  for name,(y,l,r) in [('far',far),('near',near)]:
   a=[(l+(r-l)*.1+.5)*1920/m['width'],(y+.5)*1080/m['height']];b=[(l+(r-l)*.9+.5)*1920/m['width'],a[1]]
   beats.append({'name':'side-'+name,'start':a,'click':b,'frames':120})
  for name,start,end in [('away',near,far),('toward',far,near)]:
   a=[(start[1]+start[2]+1)/2*1920/m['width'],(start[0]+.5)*1080/m['height']];b=[(end[1]+end[2]+1)/2*1920/m['width'],(end[0]+.5)*1080/m['height']]
   beats.append({'name':name+'-depth','start':a,'click':b,'frames':120})
 (root/(scene+'-07-plan.json')).write_text(json.dumps({'place':d['location'],'beats':beats},indent=2))
 print(scene,[(b['name'],b['start'],b['click']) for b in beats])
