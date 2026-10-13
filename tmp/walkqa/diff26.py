import json,sys,math
from pathlib import Path
left,right=map(Path,sys.argv[1:3]);out=Path(sys.argv[3]);details=[];count=0;maximum=0

def diff(a,b,path):
 global count,maximum
 if isinstance(a,(float,int)) and not isinstance(a,bool) and isinstance(b,(float,int)) and not isinstance(b,bool):
  error=abs(a-b);maximum=max(maximum,error)
  if error<=1e-6:return
 elif type(a)==type(b):
  if isinstance(a,dict):
   for k in sorted(a.keys()|b.keys()):
    if k not in a or k not in b:record(path+'.'+k,a.get(k,'<missing>'),b.get(k,'<missing>'))
    else:diff(a[k],b[k],path+'.'+k)
   return
  if isinstance(a,list):
   if len(a)!=len(b):record(path+'.length',len(a),len(b))
   for i,(x,y) in enumerate(zip(a,b)):diff(x,y,path+f'[{i}]')
   return
  if a==b:return
 record(path,a,b)
def record(path,a,b):
 global count
 count+=1
 if len(details)<100:details.append({'path':path,'browser':a,'simulator':b})
a=json.loads(left.read_text());b=json.loads(right.read_text());diff(a,b,'frames')
report={'browser':str(left),'simulator':str(right),'equal':count==0,'differences':count,'maxNumericDifference':maximum,'examples':details}
out.parent.mkdir(parents=True,exist_ok=True);out.write_text(json.dumps(report,indent=2));print(json.dumps({k:v for k,v in report.items() if k!='examples'}));print(json.dumps(details[:8],indent=2))
