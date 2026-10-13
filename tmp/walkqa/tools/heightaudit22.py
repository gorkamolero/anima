"""Explain the retained silhouette gate; does not change its verdict."""
import json,pathlib,collections
root=pathlib.Path('tmp/walkqa/harness-21');out=pathlib.Path('tmp/walkqa/harness-22')
counts=collections.Counter();examples={};textures=collections.Counter()
for path in root.glob('*/*-check-height.json'):
 q=json.loads(path.read_text());log=path.with_name(path.name.replace('-check-height',''));rows=json.loads(log.read_text())
 for i,(m,r) in enumerate(zip(q['rows'],rows)):
  if 'censored' in m:kind='censored: '+m['censored']
  elif m.get('relativeError',0)>.03:kind='render/tracking or occlusion discrepancy'
  elif m.get('normalizedHeightError',0)>.03:kind='drawing silhouette differs from canonical side pose'
  else:kind='pass'
  counts[kind]+=1
  if kind!='pass':
   textures[r['texture']]+=1
   if kind not in examples or m.get('relativeError',0)>examples[kind]['measurement'].get('relativeError',0):examples[kind]={'log':str(log),'frame':i,'measurement':m,'texture':r['texture'],'assetFrame':r['frame']}
(out/'height-audit-baseline.json').write_text(json.dumps({'counts':counts,'textures':textures,'examples':examples},indent=2))
print(dict(counts));print(json.dumps(examples,indent=2))
