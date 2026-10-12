import os,json,base64,urllib.request,datetime
from pathlib import Path
root=Path('tmp/walkqa/verification-16b/calibration-retry');root.mkdir(exist_ok=True)
prompt='Measure a visible known-height architectural object to calibrate a 1.75 metre adult in this illustration. Prefer the actual door opening (exclude roof, porch and door frame). Return JSON only: {"label":string,"rect":{"x":number,"y":number,"width":number,"height":number},"realHeightM":number,"horizonY":number,"reason":string}. All image coordinates normalized 0..1. Rect bottom is the object ground position. Use a plausible standard door height, distinguish the actual door opening from the building. Horizon should be the visible sea horizon. Do not estimate an imaginary person or extrapolate to the foreground.'
(root/'calibration-prompt.txt').write_text(prompt)
assert not (root/'calibration-response.json').exists()
im=Path('adventures/shadow-over-innsmouth/public/generated/5ca32cfdd011640725ee52cf1e1d8fbd07a6ce6bdb34d4f5df52206964b4b53a.png').read_bytes()
data={'model':'google/gemini-2.5-pro','messages':[{'role':'user','content':[{'type':'text','text':prompt},{'type':'image_url','image_url':{'url':'data:image/png;base64,'+base64.b64encode(im).decode()}}]}],'response_format':{'type':'json_object'}}
with Path('tmp/walkqa/calls.md').open('a') as f:f.write('\n| Brief 16b F21 calibration | '+datetime.datetime.now(datetime.timezone.utc).isoformat()+' | pier visible door measurement | google/gemini-2.5-pro, one vision call |\n')
r=urllib.request.Request('https://openrouter.ai/api/v1/chat/completions',data=json.dumps(data).encode(),headers={'Authorization':'Bearer '+os.environ['OPENROUTER_API_KEY'],'Content-Type':'application/json'})
with urllib.request.urlopen(r,timeout=90) as res:out=json.load(res)
(root/'calibration-response.json').write_text(json.dumps(out,indent=2));obj=json.loads(out['choices'][0]['message']['content']);(root/'calibration.json').write_text(json.dumps(obj,indent=2));print(obj)
