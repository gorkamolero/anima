import json,pathlib,math
sectors=['right','away-right','away','away-left','left','toward-left','toward','toward-right']
def facing(area,anchor,bounds,heading):
 p=area['perspective'];h=p['horizonY'];s=p['slope'];ppm=p.get('pixelsPerMetre',300);f=p.get('focalLength',1000);cx=p.get('cx',960)
 def ground(q):
  if 'constant' in p or not s:return {'x':q['x'],'y':-q['y']}
  z=1/(s*(q['y']-h));return {'x':(q['x']-cx)*z/ppm,'y':z*f/ppm}
 b=bounds;target={'x':(b[0]+b[2])*960,'y':max(b[3]*1080,h+1) if 'constant' not in p and s>0 else b[3]*1080};g=ground(anchor);t=ground(target);dx=t['x']-g['x'];dz=t['y']-g['y']
 if math.hypot(dx,dz)<1e-8:return True,0
 if heading not in sectors:return False,180
 angle=math.atan2(dz,dx);actual=sectors.index(heading)*math.pi/4;diff=abs(math.atan2(math.sin(angle-actual),math.cos(angle-actual)))*180/math.pi
 return diff<=27.51,diff
if __name__=='__main__':
 fail=[];total=0
 for path in pathlib.Path('tmp/overnight/sim').glob('*/area.json'):
  a=json.loads(path.read_text());r=json.load(open('tmp/overnight/reports/'+a['location']+'-live.json'))
  newer=pathlib.Path('tmp/overnight/reports')/(a['location']+'-objects-live.json')
  if newer.exists():r=json.loads(newer.read_text())
  for row in r['results']:
   name=row['beat'].get('object')
   if not name:continue
   total+=1;o=next(o for o in a['interactables'] if o['name']==name);ok,diff=facing(a['area'],row['motor']['anchor'],o['bounds'],row['motor'].get('heading'))
   if not ok:fail.append((a['location'],name,row['motor'].get('heading'),round(diff,1)))
 print('Independent facing:',total-len(fail),'/',total,'pass');print(*fail,sep='\n')
 json.dump({'total':total,'failures':fail},open('tmp/overnight/reports/facing.json','w'),indent=2)
