import json,pathlib,math
root=pathlib.Path(__file__).resolve().parents[3]/'tmp/walkqa'
report=[]
def baseline(o,x):
 ps=o['baseline']
 if not ps:return o['bbox']['y']+o['bbox']['h']
 if x<=ps[0]['x']:return ps[0]['y']
 for a,b in zip(ps,ps[1:]):
  if x<=b['x']:return b['y'] if a['x']==b['x'] else a['y']+(b['y']-a['y'])*(x-a['x'])/(b['x']-a['x'])
 return ps[-1]['y']
for scene in ['depot-outside','depot-inside','road','alley']:
 d=json.loads((root/'geometry-07'/scene/'navigation.json').read_text());m=d['area']['mask']
 pts=[((i%m['width']+.5)*1920/m['width'],(i//m['width']+.5)*1080/m['height']) for i,v in enumerate(m['data']) if v]
 for o in d['objects']:
  box=o['bbox'];mid=box['x']+box['w']/2
  behind=[p for p in pts if box['x']<=p[0]<=box['x']+box['w'] and p[1]<baseline(o,p[0])-8]
  front=[p for p in pts if box['x']<=p[0]<=box['x']+box['w'] and p[1]>baseline(o,p[0])+25]
  folder=root/'occlusion-07'/scene/o['id'];folder.mkdir(parents=True,exist_ok=True)
  row={'scene':scene,'object':o['id'],'behindCells':len(behind),'frontCells':len(front),'overlay':str(root/'walkareas'/(scene+'.png'))}
  if behind and front:
   b=min(behind,key=lambda p:(p[0]-mid)**2+(p[1]-(baseline(o,p[0])-35))**2)
   f=min(front,key=lambda p:(p[0]-b[0])**2+(p[1]-(baseline(o,p[0])+90))**2)
   plan={'place':d['location'],'beats':[{'name':'front-to-behind','start':f,'click':b,'frames':180},{'name':'behind-to-front','click':f,'frames':180}]}
   (folder/'plan.json').write_text(json.dumps(plan,indent=2));row.update(status='capture-required',start=f,behind=b)
  else:row['status']='no navigable '+('behind' if not behind else 'front')+' cells under object span'
  (folder/'reachability.json').write_text(json.dumps(row,indent=2));report.append(row)
 exits=[]
 for e in d['exits']:
  a=e.get('approach')
  if not a:continue
  start=min(pts,key=lambda p:(p[0]-(a['x']+(150 if a['x']<960 else -150)))**2+(p[1]-min(920,a['y']+80))**2)
  exits.append({'name':e['id'],'start':start,'exit':e['id'],'frames':180})
 folder=root/'exits-07'/scene;folder.mkdir(parents=True,exist_ok=True)
 (folder/'plan.json').write_text(json.dumps({'place':d['location'],'beats':exits},indent=2))
(root/'verification-07'/'occluder-reachability.json').write_text(json.dumps(report,indent=2))
print(json.dumps(report,indent=2))
