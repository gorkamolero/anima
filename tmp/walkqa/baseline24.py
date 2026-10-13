"""Apply corrected gates to retained 23 measurements with the original sprites."""
import sys,pathlib,subprocess,json,tempfile,shutil,os
sys.path.insert(0,str(pathlib.Path('tmp/walkqa/tools').absolute()))
import pixelheight,facing_stance,draworder
root=pathlib.Path('tmp/walkqa/harness-23');out=pathlib.Path('tmp/walkqa/harness-24/baseline23');out.mkdir(exist_ok=True)
original=draworder.SPR
with tempfile.TemporaryDirectory(prefix='anima-brief24-baseline-') as temporary:
 sprite=pathlib.Path(temporary)/"hermes";sprite.mkdir();(sprite.parent/"kat").symlink_to((original.parent/"kat").resolve(),target_is_directory=True);draworder.SPR=sprite;pixelheight.ROOT=sprite
 for p in original.glob('*'):
  if p.suffix in ['.png','.json']:
   (sprite/p.name).write_bytes(subprocess.check_output(['git','show','83e5099:'+str(p)]))
 draworder.CATALOG=json.loads((root/'occluder-catalog.json').read_text())
 results=[]
 for event in root.glob('*/*-events.json'):
  name=event.name.removesuffix('-events.json');p=event.parent/(name+'.json');rows=json.loads(p.read_text());height=json.loads((event.parent/(name+'-check-height.json')).read_text());turns=json.loads((event.parent/(name+'-check-turns.json')).read_text())
  for r,q in zip(rows,height['rows']):
   if 'censored' in q:continue
   for o in r.get('occluders',[]):
    if r['depth']<o['depth'] and draworder.exact_overlap(r,o,draworder.meta(r['texture'])):
     q['censored']='occluder overlap';break
  height=pixelheight.summarize(height['rows']);facing=facing_stance.check(rows,turns['cornersOver25Degrees'])
  result=dict(scene=event.parent.name,walk=name,height=height,facing=facing);results.append(result)
  print(event.parent.name,name,height['pass_'],facing['pass_'],flush=True)
 (out/'corrected-gates.json').write_text(json.dumps(results))
 (out/'summary.json').write_text(json.dumps(dict(walks=len(results),height=sum(x['height']['pass_'] for x in results),facing=sum(x['facing']['pass_'] for x in results)),indent=2))
