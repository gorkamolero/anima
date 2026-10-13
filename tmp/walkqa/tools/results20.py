"""Aggregate evidence without converting missing checks or unreviewed visuals to passes."""
import pathlib,json,re,os
root=pathlib.Path(os.environ.get('WALKQA_ROOT','tmp/walkqa/harness-20'));scenes={};total=0;frames=0
for planfile in sorted(root.glob('*/plan.json')):
 scene=planfile.parent;plan=json.loads(planfile.read_text());walks={}
 for beat in plan['beats']:
  name=beat['name'];p=scene/(name+'.json');event=scene/(name+'-events.json')
  if not event.exists():walks[name]={'status':'pending'};continue
  rows=json.loads(p.read_text());frames+=len(rows);total+=1;checks={}
  for key in ['floor','behavior','scale','facing','draworder','path','height','video']:
   f=scene/(name+'-check-'+key+'.json');checks[key]=json.loads(f.read_text()) if f.exists() else {'pass_':None}
  if checks['path'].get('pass_') is not None and checks['floor'].get('clearancePass') is not None:
   checks['path']['plannedPass']=checks['path']['pass_'];checks['path']['pass_']=checks['path']['pass_'] and checks['floor']['clearancePass'];checks['path']['bodyClearanceFrames']=checks['floor']['bodyClearance']
  if checks['path'].get('pass_') is not None:
   actual=checks['path'].get('actualRatio')
   checks['path']['pass_']=checks['path']['pass_'] and actual is not None and actual<=1.05
  if checks['draworder'].get('pass_') is not None:
   checks['draworder']['pass_']=checks['draworder']['pass_'] and checks['draworder'].get('bboxFallbackFrames')==0
  f=scene/(name+'-lockcheck.txt');lock=None
  if f.exists():
   try:lock=json.loads(f.read_text().splitlines()[0])
   except Exception:pass
  checks['lock']={'pass_':lock is not None and lock.get('maxExcursion_px') is not None and lock['maxExcursion_px']<=1,'measurement':lock}
  f=scene/(name+'-freeze.txt');text=f.read_text() if f.exists() else '';match=re.search(r'frozen while walking (\d+)',text);checks['freeze']={'pass_':int(match[1])==0 if match else None,'frozen':int(match[1]) if match else None,'toolOutput':text}
  manifest=scene/(name+'-crops/manifest.json');review=json.loads(manifest.read_text()) if manifest.exists() else {};checks['visual']={'pass_':review.get('pass_') if review.get('viewed') else None}
  capture=json.loads(event.read_text())
  walks[name]={'status':'captured','completedNaturally':capture['completed'],'timedOut':capture.get('timedOut',False),'frames':len(rows),'movingFrames':sum(r['walking'] for r in rows),'checks':checks,'visualNotes':review.get('notes')}
 scenes[scene.name]={'planned':len(plan['beats']),'captured':sum(w['status']=='captured' for w in walks.values()),'walks':walks}
result={'complete':all(s['captured']==s['planned'] for s in scenes.values()) and all(w.get('checks',{}).get('visual',{}).get('pass_') is not None for s in scenes.values() for w in s['walks'].values()),'totals':{'scenes':len(scenes),'plannedWalks':sum(s['planned'] for s in scenes.values()),'capturedWalks':total,'frames':frames},'scenes':scenes}
result['captureAndReviewComplete']=result.pop('complete')
result['measurementsComplete']=all(all(c.get('pass_') is not None for c in w.get('checks',{}).values()) for s in scenes.values() for w in s['walks'].values())
result['pass_']=result['captureAndReviewComplete'] and result['measurementsComplete'] and all(w.get('completedNaturally') and all(c.get('pass_') is True for c in w['checks'].values()) for s in scenes.values() for w in s['walks'].values())
result['fixLoopComplete']=False
result['complete']=False
result['openRequirements']=['Not every defect class has two demonstrated repair attempts.', 'Full affected-scene reruns after the support fix are incomplete; targeted before/after evidence is retained.', 'Narrow-gap candidates and nearest-reachable projections need independent coverage validation.']
result['totals']['reviewedWalks']=sum(w.get('checks',{}).get('visual',{}).get('pass_') is not None for s in scenes.values() for w in s['walks'].values())
result['totals']['passingWalks']=sum(w.get('completedNaturally') and all(c.get('pass_') is True for c in w.get('checks',{}).values()) for s in scenes.values() for w in s['walks'].values())
result['totals']['timedOutWalks']=sum(w.get('timedOut',False) for s in scenes.values() for w in s['walks'].values())
(root/'results.json').write_text(json.dumps(result,indent=2));print(result['totals'])
