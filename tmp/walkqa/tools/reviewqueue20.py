"""List review sheets in plan order; this never marks them reviewed."""
import pathlib,json,sys,os
p=pathlib.Path(os.environ.get('WALKQA_ROOT','tmp/walkqa/harness-20'))/sys.argv[1];out=[]
for b in json.loads((p/'plan.json').read_text())['beats'][int(sys.argv[2]):int(sys.argv[3])]:
 n=b['name'];out += [str(p/(n+'-sheet.png'))]+[str(x) for x in sorted((p/(n+'-crops')).glob('*review*.png'))]
print(json.dumps(out))
