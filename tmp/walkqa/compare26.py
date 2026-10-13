"""Strict frame-log comparison of the single final capture as walks finish."""
import pathlib,sys,json,subprocess,time
root=pathlib.Path('tmp/walkqa/harness-26');sim=pathlib.Path('tmp/walkqa/sim/26-final')
while True:
 reports=[]
 for p in root.glob('*/*-events.json'):
  name=p.name.removesuffix('-events.json');left=p.parent/(name+'.json');right=sim/p.parent.name/(name+'.json');out=p.parent/(name+'-diff.json')
  if not out.exists() or out.stat().st_mtime < max(left.stat().st_mtime,right.stat().st_mtime):
   result=subprocess.run([sys.executable,'tmp/walkqa/diff26.py',str(left),str(right),str(out)],capture_output=True,text=True,check=True)
   report=json.loads(out.read_text());print(p.parent.name,name,'MATCH' if report['equal'] else f"DIFF {report['differences']}",flush=True)
  reports.append(json.loads(out.read_text()))
 result={'complete':len(reports)==139,'equal':len(reports)==139 and all(r['equal'] for r in reports),'compared':len(reports),'matched':sum(r['equal'] for r in reports),'walks':reports}
 (root/'diff-report.json').write_text(json.dumps(result,indent=2))
 if len(reports)==139 or '--once' in sys.argv:break
 time.sleep(5)
