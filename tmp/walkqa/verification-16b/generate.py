import os,json,base64,urllib.request,urllib.error,sys,datetime,shutil
from pathlib import Path
ROOT=Path('tmp/walkqa/verification-16b')
PROMPT='Static camera. The character stops walking and settles into a relaxed stand: the planted foot stays exactly where it is, the other foot comes down beside it, arms relax to his sides. No turning, no camera motion, flat grey background.'
def request(url,data=None):
 r=urllib.request.Request(url,data=json.dumps(data).encode() if data else None,headers={'Authorization':'Key '+os.environ['FAL_KEY'],'Content-Type':'application/json'})
 with urllib.request.urlopen(r,timeout=60) as response:return json.load(response)
mode,name=sys.argv[1:3];d=ROOT/name;d.mkdir(exist_ok=True);record=d/'request.json'
if mode=='submit':
 assert not (d/'input.json').exists(), 'Never duplicate submission'
 jobs=list(ROOT.glob('*/input.json'));assert len(jobs)<12
 heading=sys.argv[3];model=sys.argv[4]
 data=json.loads(sys.argv[5]); data['prompt']=PROMPT
 first,last=('image_url','tail_image_url') if 'kling' in model else ('start_image_url','end_image_url') if model.startswith('alibaba/') or model=='fal-ai/wan-flf2v' else ('first_frame_url','last_frame_url')
 data[first]=heading+'-first.png';data[last]=heading+'-last.png'
 for k in [first,last]:shutil.copyfile(ROOT/'sources'/data[k],d/data[k])
 (d/'input.json').write_text(json.dumps({'model':model,**data},indent=2))
 for k in [first,last]:data[k]='data:image/png;base64,'+base64.b64encode((d/data[k]).read_bytes()).decode()
 with Path('tmp/walkqa/calls.md').open('a') as f:f.write(f'\n| Brief 16b first-last attempt {len(jobs)+1} | {datetime.datetime.now(datetime.timezone.utc).isoformat()} | {name} | {model}, submission attempted |\n')
 try:r=request('https://queue.fal.run/'+model,data)
 except urllib.error.HTTPError as e:
  (d/'error.json').write_text(json.dumps({'status':e.code,'body':e.read().decode()}));print(name,'HTTP',e.code);sys.exit(1)
 record.write_text(json.dumps(r,indent=2));print(name,r['request_id'])
else:
 r=json.loads(record.read_text());s=request(r['status_url']);print(name,s['status'])
 if s['status']=='COMPLETED' and not (d/'raw.mp4').exists():
  result=request(r['response_url']);(d/'result.json').write_text(json.dumps(result,indent=2));urllib.request.urlretrieve(result['video']['url'],d/'raw.mp4');print(name,'downloaded')
