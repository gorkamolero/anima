"""Persist the verified scale reference in existing perception caches, preserving masks."""
import hashlib,json
from pathlib import Path
r=Path('tmp/walkqa/verification-16b');m=json.loads((r/'door-reference.json').read_text());ref={k:m[k] for k in ['label','rect','realHeightM']};im=Path('adventures/shadow-over-innsmouth/public/generated/5ca32cfdd011640725ee52cf1e1d8fbd07a6ce6bdb34d4f5df52206964b4b53a.png');key=hashlib.sha256(im.read_bytes()).hexdigest();records=[]
for p in Path('api/data/perception').glob(key+'-floor*.json'):
 d=json.loads(p.read_text());g=d.get('guidance',d)
 if not all(k in g for k in ['horizonY','referenceFootY','referenceHeight']):continue
 previous={k:g[k] for k in ['horizonY','referenceFootY','referenceHeight']};g['scaleReference']=ref;g['horizonY']=m['horizonY'];g['referenceFootY']=ref['rect']['y']+ref['rect']['height'];g['referenceHeight']=ref['rect']['height']*1.75/ref['realHeightM'];p.write_text(json.dumps(d,indent=2));records.append({'path':str(p),'previous':previous,'newReference':ref,'horizonY':m['horizonY']})
(r/'reference-cache-migration.json').write_text(json.dumps(records,indent=2));print('Updated calibration only in',len(records),'existing caches')
