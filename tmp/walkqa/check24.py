"""Run independent checks and reviewer tools on completed harness walks."""
import pathlib,json,subprocess,sys,os
sys.path.insert(0,str(pathlib.Path("tmp/walkqa/tools").absolute()))
import facing_stance as facing
import scalecheck,draworder,pathopt,pixelheight,behavior20,floorcheck20
root=pathlib.Path(sys.argv[1] if len(sys.argv)>1 else 'tmp/walkqa/harness-20');python=sys.executable
for event in root.glob((os.environ.get('QA_SCENE') or '*')+'/*-events.json'):
 name=event.name.removesuffix('-events.json');p=event.parent/(name+'.json');rows=json.loads(p.read_text());e=json.loads(event.read_text());geo=json.loads((p.parent/'area.json').read_text());nav=json.loads((p.parent/'navigation.json').read_text())
 for key,fn in [('floor',lambda:floorcheck20.check(rows,geo)),('behavior',lambda:behavior20.check(rows,e)),('scale',lambda:scalecheck.check(rows,geo)),('facing',lambda:facing.check(rows,json.loads((p.parent/(name+'-check-turns.json')).read_text()).get('cornersOver25Degrees',0))),('draworder',lambda:draworder.check(rows)),('path',lambda:pathopt.check(rows,e,nav)),('height',lambda:pixelheight.check(p.with_suffix('.mp4'),p,p.parent/'background.png'))]:
  target=p.parent/(name+'-check-'+key+'.json')
  source=pathlib.Path('tmp/walkqa/tools')/(dict(facing='facing_stance',scale='scalecheck',floor='floorcheck20',behavior='behavior20',height='pixelheight',path='pathopt').get(key,key)+'.py')
  if target.exists() and target.stat().st_mtime>=max(source.stat().st_mtime,p.stat().st_mtime,event.stat().st_mtime,(p.parent/'navigation.json').stat().st_mtime):continue
  try:result=fn()
  except Exception as exc:result={'pass_':False,'error':str(exc),'flagged':[]}
  target.write_text(json.dumps(result));print(p.parent.name,name,key,result.get('pass_'),flush=True)
 for tool,args in [('lockcheck',[str(p)]),('freeze',[str(p.with_suffix('.mp4'))])]:
  target=p.parent/(name+'-'+tool+'.txt')
  if not target.exists():
   result=subprocess.run([python,'tmp/walkqa/tools/'+tool+'.py',*args],capture_output=True,text=True);target.write_text(result.stdout+result.stderr)
 manifest=p.parent/(name+'-crops/manifest.json')
 if not manifest.exists() or pathlib.Path('tmp/walkqa/tools/review20.py').stat().st_mtime>manifest.stat().st_mtime or any(f.stat().st_mtime>manifest.stat().st_mtime for f in p.parent.glob(name+'-check-*.json')):subprocess.run([python,'tmp/walkqa/tools/review20.py',str(p)],check=True)
if not os.environ.get('QA_SCENE'):subprocess.run([python,'tmp/walkqa/tools/walkstats.py',str(root)],stdout=open(root/'walkstats.txt','w'),check=True)
