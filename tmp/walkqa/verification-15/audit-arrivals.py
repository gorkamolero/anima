import hashlib,json,math
from pathlib import Path
out=Path('tmp/walkqa/verification-15');proof=Path('tmp/walkqa/proof-15');records=[]
for scene in ['road','depot','starts']:
 plan=json.loads((out/(scene+'-plan.json')).read_text())
 for beat in plan['beats']:
  p=proof/scene/(beat['name']+'.json');rows=json.loads(p.read_text());r=rows[-1];c=r['contact'];a=c.get('arrival');cut=c.get('cut');actual=math.hypot(r['x']-a['target']['x'],r['y']-a['target']['y']) if a else None
  record={'scene':scene,'heading':beat['name'],'actualFinalPosition':[r['x'],r['y']],'target':a['target'] if a else None,'actualDistance':actual,'reportedDistance':a['distance'] if a else None,'halfStride':a['halfStride'] if a else None,'withinHalfStride':bool(a and actual<=a['halfStride']+1e-6),'predictionError':abs(actual-a['distance']) if a else None,'waitFrames':cut['waitFrames'] if cut else None,'cycleFrames':cut['cycleFrames'] if cut else None,'withinOneCycle':bool(cut and cut['waitFrames']<cut['cycleFrames']),'settlingSeconds':sum(bool(x['contact'].get('settling')) for x in rows)/24,'matched':bool(cut and cut['matched']),'finalHeading':c['heading']};records.append(record)
(out/'arrivals.json').write_text(json.dumps(records,indent=2)+'\n')
base=json.loads((out/'reviewer-tool-sha256.json').read_text());check={p:hashlib.sha256(Path(p).read_bytes()).hexdigest()==h for p,h in base.items()};(out/'reviewer-tools-unchanged.json').write_text(json.dumps(check,indent=2)+'\n');assert all(check.values())
print('cuts',len(records),'arrivals',sum(r['withinHalfStride'] for r in records),'matched',sum(r['matched'] for r in records),'max prediction error',max(r['predictionError'] or 0 for r in records),'max stop seconds',max(r['settlingSeconds'] for r in records))
