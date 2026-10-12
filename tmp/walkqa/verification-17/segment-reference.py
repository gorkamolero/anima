"""Text-only semantic references, no points or human rectangles. At most 10 calls."""
import os,json,base64,urllib.request,sys,datetime
from pathlib import Path
root=Path('tmp/walkqa/verification-17/f21');root.mkdir(exist_ok=True)
model='fal-ai/sam-3/image'
def request(url,data=None):
 r=urllib.request.Request(url,data=json.dumps(data).encode() if data else None,headers={'Authorization':'Key '+os.environ['FAL_KEY'],'Content-Type':'application/json'})
 with urllib.request.urlopen(r,timeout=60) as response:return json.load(response)
mode,prompt=sys.argv[1:3];d=root/prompt.replace(' ','-');d.mkdir(exist_ok=True)
if mode=='submit':
 assert not (d/'input.json').exists()
 assert len(list(root.glob('*/input.json')))<10
 image=Path('adventures/shadow-over-innsmouth/public/generated/5ca32cfdd011640725ee52cf1e1d8fbd07a6ce6bdb34d4f5df52206964b4b53a.png')
 data={'prompt':prompt,'apply_mask':False,'return_multiple_masks':True,'max_masks':12,'include_scores':True,'include_boxes':True,'output_format':'png'}
 (d/'input.json').write_text(json.dumps({'model':model,'image':str(image),**data},indent=2))
 with Path('tmp/walkqa/calls.md').open('a') as f:f.write('\n| Brief 17 F21 segmentation | '+datetime.datetime.now(datetime.timezone.utc).isoformat()+' | '+prompt+' | SAM3 text-only, submission attempted |\n')
 data['image_url']='data:image/png;base64,'+base64.b64encode(image.read_bytes()).decode()
 result=request('https://queue.fal.run/'+model,data);(d/'request.json').write_text(json.dumps(result,indent=2));print(prompt,result['request_id'])
else:
 r=json.loads((d/'request.json').read_text());s=request(r['status_url']);print(prompt,s['status'])
 if s['status']=='COMPLETED':
  result=request(r['response_url']);(d/'result.json').write_text(json.dumps(result,indent=2))
  for i,mask in enumerate(result['masks']):urllib.request.urlretrieve(mask['url'],d/f'mask-{i:02}.png')
  print(prompt,len(result['masks']),'masks')
