"""Check actual click effects and transition counts, without treating idle as success."""
import json,sys,math,pathlib
NAV={g["location"]:g for f in pathlib.Path("tmp/walkqa/harness-20").glob("*/navigation.json") for g in [json.loads(f.read_text())]}

def check(rows,event):
 beat=event['beat'];events=event['events'];moving=[i for i,r in enumerate(rows) if r['walking'] and not r['contact'].get('settling')];triggers=[e for e in events if e['type']=='triggerExit'];states=[e for e in events if e['type']=='emitOpenWorldState'];errors=[e for e in states if e['data'].get('status')=='error'];flags=[];result={'walkingFrames':len(moving),'errors':errors,'flagged':flags,'completed':event['completed']}
 if beat.get('coverageFailure'):result.update(pass_=False,reason=beat['coverageFailure']);return result
 if beat.get('exit'):
  destination=beat.get('expectedDestination');locations=[r['location'] for r in rows];arrival=next((i for i,r in enumerate(rows) if r['visible'] and r['location']!=locations[0]),None)
  side=None
  if arrival is not None:
   foot=rows[arrival]['contact']['anchor'];kind=beat.get('exitKind');dest=locations[-1]
   if kind=='edge-left':side=foot['x']>=1890
   elif kind=='edge-right':side=foot['x']<=30
   elif dest in NAV:
    nav=NAV[dest];back=next((x for x in nav['exits'] if x.get('to')==locations[0]),None)
    if back:
     points=back['region'];side=min(q['x'] for q in points)-100<=foot['x']<=max(q['x'] for q in points)+100 and min(q['y'] for q in points)-100<=foot['y']<=max(q['y'] for q in points)+100
  result['arrivalSidePass']=side
  result.update(pass_=side is True and destination is not None and len(triggers)==1 and locations[-1]!=locations[0] and (not destination or locations[-1]==destination) and arrival is not None and event['completed'] and not errors,triggerCount=len(triggers),destination=locations[-1],expectedDestination=destination,arrivalFrame=arrival,arrivalContact=rows[arrival]['contact']['anchor'] if arrival is not None else None,arrivalHeading=rows[arrival]['contact']['heading'] if arrival is not None else None)
 elif beat.get('object'):
  options=[e for e in states if e['data'].get('status')=='options'];result.update(pass_=bool(moving) and bool(options) and all(not e['walking'] for e in options) and event['completed'] and not errors,optionsFrames=[e['frame'] for e in options])
 else:
  preview=event['setup']['preview'];target=preview[-1] if preview else None;last=rows[-1];arrival=last['contact'].get('arrival');distance=math.hypot(last['x']-target['x'],last['y']-target['y']) if target else None
  result.update(pass_=bool(moving) and event['completed'] and not triggers and not errors and distance is not None and distance<=12,nearestReachable=target,finalDistance=distance,motorArrival=arrival,unexpectedExits=len(triggers))
 return result
if __name__=='__main__':
 if '--self-test' in sys.argv:
  rows=[dict(x=i,y=0,visible=True,location='a',walking=True,contact={}) for i in range(20)];e=dict(beat={'name':'floor'},setup={'preview':[dict(x=19,y=0)]},events=[],completed=True);assert check(rows,e)['pass_'];assert not check([{**r,'walking':False} for r in rows],e)['pass_'];print('PASS: dropped floor click rejected')
 else:print(json.dumps(check(json.load(open(sys.argv[1])),json.load(open(sys.argv[2])))))
