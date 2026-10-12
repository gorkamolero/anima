"""Budgeted fal queue client; credentials are read only from the environment."""
import os,json,base64,urllib.request,urllib.error,sys,datetime
from pathlib import Path
ROOT=Path('tmp/walkqa/verification-16'); MODEL='fal-ai/kling-video/v3/turbo/standard/image-to-video'
PROMPT='This exact character, who was walking, stops: he brings his trailing foot forward to plant beside the other and settles into a relaxed standing pose, both feet flat, arms at his sides. Camera completely static, character stays the same size and position, the planted foot does not move, full body in frame, flat grey background. Finish the single stopping movement promptly in the first half second, then hold completely still. Preserve the exact heading and illustrated character design. No more walking, no turn, no camera movement.'
def request(url,data=None):
 r=urllib.request.Request(url,data=json.dumps(data).encode() if data else None,headers={'Authorization':'Key '+os.environ['FAL_KEY'],'Content-Type':'application/json'})
 with urllib.request.urlopen(r,timeout=60) as response:return json.load(response)
mode=sys.argv[1]
for heading in sys.argv[2:]:
 d=ROOT/heading;d.mkdir(exist_ok=True); record=d/'request.json'
 if mode=='submit':
  if record.exists():raise RuntimeError('Already submitted; never duplicate a job')
  jobs=list(ROOT.glob('*/request.json'));assert len(jobs)<10
  image=(ROOT/'sources'/f'{heading.split("-reroll")[0]}.png').read_bytes()
  prompt = PROMPT if '-reroll' not in heading else 'A single tiny settle into standing, NOT a walking cycle. Freeze the planted boot exactly where it is in the input image throughout this entire shot. Only the other boot moves a short distance beside it, sole flat on the ground. Straighten the bent knees and relax both arms down at his sides. Complete this tiny motion immediately in 0.4 seconds, then stay completely motionless for the rest of the shot. Do not take even one additional stride. Do not lift or slide the support foot. Do not change heading, turn, scale, position, face, clothing or illustration style. Locked static camera, full body, uniform flat grey background. Both feet flat and close together, weight even, relaxed upright resting pose.'
  data={'image_url':'data:image/png;base64,'+base64.b64encode(image).decode(),'prompt':prompt,'duration':'3'}
  (d/'input.json').write_text(json.dumps({**data,'image_url':'../sources/'+heading.split('-reroll')[0]+'.png','model':MODEL},indent=2))
  with Path('tmp/walkqa/calls.md').open('a') as f:f.write(f'\n| Brief 16 Kling attempt {len(jobs)+1} | {datetime.datetime.now(datetime.timezone.utc).isoformat()} | {heading} | {MODEL}, 3s, submission attempted |\n')
  try:r=request('https://queue.fal.run/'+MODEL,data)
  except urllib.error.HTTPError as e:
   (d/'error.json').write_text(json.dumps({'status':e.code,'body':e.read().decode()}));print(heading,'HTTP',e.code);continue
  record.write_text(json.dumps(r,indent=2));print(heading,r['request_id'])
 else:
  if not record.exists():continue
  r=json.loads(record.read_text());s=request(r['status_url']);print(heading,s['status'])
  if s['status']=='COMPLETED' and not (d/'raw.mp4').exists():
   result=request(r['response_url']);(d/'result.json').write_text(json.dumps(result,indent=2));urllib.request.urlretrieve(result['video']['url'],d/'raw.mp4');print(heading,'downloaded')
