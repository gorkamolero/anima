"""Read-only orchestration of reviewer gates on headless logs."""
import json,pathlib,sys,subprocess,collections,math
sys.path.insert(0,'tmp/walkqa/tools')
import floorcheck20,scalecheck,facing_stance,pathopt,behavior22,draworder
import slide26
root=pathlib.Path(sys.argv[1]);selected=set(sys.argv[2:]);results=[]
if selected and (root/'checks.json').exists():results=[r for r in json.loads((root/'checks.json').read_text())['walks'] if r['scene']+'/'+r['walk'] not in selected]
for event in sorted(root.glob('*/*-events.json')):
 if selected and event.parent.name+'/'+event.name.removesuffix('-events.json') not in selected:continue
 p=event.with_name(event.name.replace('-events',''));rows=json.loads(p.read_text());e=json.loads(event.read_text());geometry=json.loads((p.parent/'navigation.json').read_text());area=json.loads((p.parent/'area.json').read_text())
 result={'scene':p.parent.name,'walk':p.stem,'checks':{}}
 for name,fn in [('slideRatio',lambda:slide26.check(rows)),('floor',lambda:floorcheck20.check(rows,area)),('scale',lambda:scalecheck.check(rows,area)),('facing',lambda:facing_stance.check(rows)),('path',lambda:pathopt.check(rows,e,geometry)),('behavior',lambda:behavior22.check(rows,e)),('draworder',lambda:draworder.check(rows))]:
  try: value=fn()
  except Exception as exc:value={'pass_':False,'error':str(exc)}
  result['checks'][name]=value
  p.with_name(p.stem+'-check-'+name+'.json').write_text(json.dumps(value))
 lock=subprocess.run([sys.executable,'tmp/walkqa/tools/lockcheck.py',str(p)],capture_output=True,text=True,check=True)
 value=json.loads(lock.stdout);value['pass_']=value['maxExcursion_px'] is not None and value['maxExcursion_px']<=1.5;result['checks']['lock']=value
 p.with_name(p.stem+'-lockcheck.txt').write_text(lock.stdout)
 a=rows[-1]['contact'].get('arrival');target=rows[-1].get('target');anchor=rows[-1]['contact']['anchor']
 result['arrival']={'distance':math.dist([anchor['x'],anchor['y']],[target['x'],target['y']]) if target else None,'halfStride':a.get('halfStride') if a else None,'absorbedDistance':a.get('absorbedDistance',0) if a else 0}
 result['pass_']=all(v.get('pass_',False) for v in result['checks'].values());results.append(result)
 (root/'checks.json').write_text(json.dumps({'walks':results,'passes':dict(collections.Counter(k for r in results for k,v in r['checks'].items() if v.get('pass_'))),'allPass':sum(r['pass_'] for r in results)},indent=2))
 print(p.parent.name,p.stem,' '.join(k for k,v in result['checks'].items() if not v.get('pass_')),flush=True)
subprocess.run([sys.executable,'tmp/walkqa/tools/walkstats.py',str(root)],stdout=open(root/'walkstats.log','w'),check=True)
