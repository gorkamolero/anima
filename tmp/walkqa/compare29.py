import json,pathlib,sys,math
left=pathlib.Path('tmp/walkqa/equivalence-29');right=pathlib.Path('tmp/walkqa/sim/29-facing');results=[]
def compare(a,b,path='frames'):
 differences=[];maximum=0
 if isinstance(a,(int,float)) and not isinstance(a,bool) and isinstance(b,(int,float)) and not isinstance(b,bool):
  maximum=abs(a-b)
  if a!=b:differences.append({'path':path,'browser':a,'simulator':b})
 elif type(a)!=type(b):differences.append({'path':path,'browser':a,'simulator':b})
 elif isinstance(a,dict):
  for key in sorted(a.keys()|b.keys()):
   if key not in a or key not in b:differences.append({'path':path+'.'+key,'missing':True})
   else:
    d,m=compare(a[key],b[key],path+'.'+key);differences+=d;maximum=max(maximum,m)
 elif isinstance(a,list):
  if len(a)!=len(b):differences.append({'path':path+'.length','browser':len(a),'simulator':len(b)})
  for i,(x,y) in enumerate(zip(a,b)):
   d,m=compare(x,y,path+f'[{i}]');differences+=d;maximum=max(maximum,m)
 elif a!=b:differences.append({'path':path,'browser':a,'simulator':b})
 return differences,maximum
for scene in ['outside','inside','road','alley']:
 for walk in ['near-left','near-right']:
  a=left/scene/(walk+'.json');b=right/scene/(walk+'.json')
  if not a.exists():
   if '--partial' in sys.argv:continue
   raise SystemExit('Missing '+str(a))
  d,m=compare(json.load(open(a)),json.load(open(b)));r={'browser':str(a),'simulator':str(b),'equal':not d,'differences':len(d),'maxNumericDifference':m,'examples':d[:20]};results.append(r);a.with_name(walk+'-diff.json').write_text(json.dumps(r,indent=2))
report={'equal':len(results)==8 and all(r['equal'] for r in results),'compared':len(results),'matched':sum(r['equal'] for r in results),'differences':sum(r['differences'] for r in results),'maxNumericDifference':max((r['maxNumericDifference'] for r in results),default=0),'walks':results}
(left/'diff-report.json').write_text(json.dumps(report,indent=2));print({k:v for k,v in report.items() if k!='walks'})
