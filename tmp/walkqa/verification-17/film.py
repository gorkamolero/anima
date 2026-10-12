import os,json,base64,urllib.request,sys,datetime,shutil
from pathlib import Path
root=Path('tmp/walkqa/verification-17');mode,heading=sys.argv[1:3];d=root/heading/'film';d.mkdir(exist_ok=True)
def request(url,data=None):
 req=urllib.request.Request(url,data=json.dumps(data).encode() if data else None,headers={'Authorization':'Key '+os.environ['FAL_KEY'],'Content-Type':'application/json'})
 with urllib.request.urlopen(req,timeout=60) as response:return json.load(response)
if mode=='submit':
 assert not (d/'input.json').exists();assert len(list(root.glob('*/film/input.json')))<10
 params={'num_frames':7,'include_start':True,'include_end':True,'output_type':'images','image_format':'png'}
 for key,name in [('start_image_url','first.png'),('end_image_url','last.png')]:shutil.copyfile(d.parent/name,d/name);params[key]=name
 (d/'input.json').write_text(json.dumps({'model':'fal-ai/film',**params},indent=2))
 with Path('tmp/walkqa/calls.md').open('a') as f:f.write('\n| Brief 17 interpolation | '+datetime.datetime.now(datetime.timezone.utc).isoformat()+' | '+heading+' | fal-ai/film, 7 in-betweens, submission attempted |\n')
 for key in ['start_image_url','end_image_url']:params[key]='data:image/png;base64,'+base64.b64encode((d/params[key]).read_bytes()).decode()
 result=request('https://queue.fal.run/fal-ai/film',params);(d/'request.json').write_text(json.dumps(result,indent=2));print(result['request_id'])
else:
 r=json.loads((d/'request.json').read_text());status=request(r['status_url']);print(status['status'])
 if status['status']=='COMPLETED':
  result=request(r['response_url']);(d/'result.json').write_text(json.dumps(result,indent=2))
  for i,im in enumerate(result['images']):urllib.request.urlretrieve(im['url'],d/f'rgb-{i:02}.png')
  print(len(result['images']),'images downloaded')
