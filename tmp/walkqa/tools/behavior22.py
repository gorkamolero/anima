"""Brief-22 half-stride sole arrival assessment, retaining the strict legacy result."""
import json,pathlib,math,sys
from behavior20 import check as legacy

def check(rows,event):
 old=legacy(rows,event);beat=event['beat']
 if beat.get('exit'):return {**old,'legacyPass':old['pass_']}
 last=rows[-1];arrival=last.get('contact',{}).get('arrival');anchor=last.get('contact',{}).get('anchor')
 target=last.get('target') if beat.get('object') else next(iter(reversed(event['setup']['preview'])),None)
 distance=math.dist((anchor['x'],anchor['y']),(target['x'],target['y'])) if anchor and target else None
 tolerance=arrival.get('halfStride') if arrival else None
 valid=distance is not None and tolerance is not None and math.isfinite(tolerance) and distance<=tolerance+1e-6
 result={**old,'legacyPass':old['pass_'],'soleDistance':distance,'halfStride':tolerance,'arrivalPass':valid}
 result['pass_']=bool(valid and old['walkingFrames'] and event['completed'] and not old['errors'] and not beat.get('coverageFailure') and (old['pass_'] if beat.get('object') else not old['unexpectedExits']))
 return result
if __name__=='__main__':
 if '--self-test' in sys.argv:
  r=[dict(x=i,y=0,visible=True,location='x',walking=True,contact={'anchor':{'x':i,'y':0},'arrival':{'halfStride':5}}) for i in range(20)];e={'beat':{},'setup':{'preview':[{'x':23,'y':0}]},'events':[],'completed':True}
  assert check(r,e)['pass_'];e['setup']['preview'][0]['x']=25;assert not check(r,e)['pass_'];print('PASS: actual sole beyond half stride rejected')
 else:
  root=pathlib.Path(sys.argv[1])
  for event in root.glob('*/*-events.json'):
   p=event.with_name(event.name.replace('-events',''));result=check(json.loads(p.read_text()),json.loads(event.read_text()));target=p.with_name(p.stem+'-check-behavior-goal22.json');encoded=json.dumps(result)
   if not target.exists() or target.read_text()!=encoded:target.write_text(encoded)
