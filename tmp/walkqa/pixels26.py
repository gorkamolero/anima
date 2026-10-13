import sys,json,pathlib,time
sys.path.insert(0,'tmp/walkqa/tools')
import composite
from PIL import ImageChops,ImageStat
reports=[]
root=pathlib.Path('tmp/walkqa/equivalence-26')
for p in sorted(root.glob('*/near-*-events.json')):
 name=p.name.removesuffix('-events.json');scene=p.parent.name
 sim=pathlib.Path('tmp/walkqa/sim/26-equivalence')/scene
 rows=json.loads((sim/(name+'.json')).read_text());geo=json.loads((sim/'navigation.json').read_text())
 for i in sorted(set([0,len(rows)//2,len(rows)-1])):
  reference=composite.load(str(p.parent/(name+'-frames')/(str(i).zfill(6)+'.png'))).convert('RGB')
  began=time.perf_counter();actual=composite.render(rows[i],geo).convert('RGB');ms=(time.perf_counter()-began)*1000
  dest=p.parent/(name+f'-composite-{i:06}.png');actual.save(dest)
  full=ImageChops.difference(reference,actual);sceneDiff=full.crop((0,172,1920,1080));stats=ImageStat.Stat(sceneDiff)
  reports.append({'scene':scene,'walk':name,'frame':i,'renderMs':ms,'fullMeanAbsoluteError':sum(ImageStat.Stat(full).mean)/3,'belowUiMeanAbsoluteError':sum(stats.mean)/3,'belowUiMaxChannelError':max(v[1] for v in sceneDiff.getextrema()),'composite':str(dest)})
(root/'pixel-report.json').write_text(json.dumps({'note':'PIL visual aid, not pixel-identical GPU rendering. Full difference includes game text/UI absent from the compositor; belowUi compares y>=172. No pixel tolerance was used as a numeric walk gate.','frames':reports},indent=2))
print(json.dumps({'frames':len(reports),'walks':len(reports)//3,'belowUiMeanRange':[min(r['belowUiMeanAbsoluteError'] for r in reports),max(r['belowUiMeanAbsoluteError'] for r in reports)],'cachedRenderMsRange':[min(r['renderMs'] for r in reports),max(r['renderMs'] for r in reports)]}))
