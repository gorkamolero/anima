import pathlib,sys,json,subprocess,math
sys.path.insert(0,'tmp/walkqa/tools')
import facing_stance
root=pathlib.Path(sys.argv[1]); results=[]
for w in json.load(open(root/'run.json'))['results']:
 p=root/w['scene']/(w['walk']+'.json'); rows=json.load(open(p)); a,b=rows[0],rows[-1]; target=b.get('target'); stuck=a['location']==b['location'] and target and math.dist([target['x'],target['y']],[a['x'],a['y']])>150 and math.dist([a['x'],a['y']],[b['x'],b['y']])<40
 lock=json.loads(subprocess.check_output([sys.executable,'tmp/walkqa/tools/lockcheck.py',str(p)]))
 results.append(dict(scene=w['scene'],walk=w['walk'],stuck=bool(stuck),facing=facing_stance.check(rows),lock=lock))
(root/'review28.json').write_text(json.dumps(results,indent=2))
for tool in ['arrival_vs_standable','walkstats']:
 r=subprocess.run([sys.executable,'tmp/walkqa/tools/'+tool+'.py',str(root)],capture_output=True,text=True,check=True); (root/(tool+'.log')).write_text(r.stdout); print(r.stdout if tool=='arrival_vs_standable' else r.stdout[-2000:])
print('facing',sum(r['facing']['pass_'] for r in results),'stuck',sum(r['stuck'] for r in results),'lock max',max(r['lock']['maxExcursion_px'] or 0 for r in results))
