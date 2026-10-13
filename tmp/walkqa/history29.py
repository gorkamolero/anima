import sys,json,pathlib,collections
sys.path.insert(0,'tmp/walkqa/tools')
import facing_stance
run=sys.argv[1];root=pathlib.Path('tmp/walkqa/sim')/run
results=[]
for w in json.load(open(root/'run.json'))['results']:
 p=root/w['scene']/(w['walk']+'.json');rows=json.load(open(p))
 results.append(dict(scene=w['scene'],walk=w['walk'],**facing_stance.check(rows,facing_stance.route_corners(str(p),rows))))
print(json.dumps(dict(run=run,passed=sum(w['pass_'] for w in results),flicker=sum(bool(w['flicker']) for w in results),reversals=sum(bool(w['reversals']) for w in results),agreement=sum(w['agreement']<.95 for w in results),changeLimit=sum(w['headingChanges']>w['changeLimit'] for w in results),walks=results),indent=2))
