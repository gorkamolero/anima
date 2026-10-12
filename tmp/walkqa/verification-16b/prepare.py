import json,hashlib
from pathlib import Path
from PIL import Image
r=Path('tmp/walkqa/verification-16b'); s=Path('adventures/shadow-over-innsmouth/public/assets/sprites/hermes')
(r/'reviewer-tool-sha256.json').write_text(json.dumps({str(p):hashlib.sha256(p.read_bytes()).hexdigest() for p in Path('tmp/walkqa/tools').glob('*') if p.is_file()},indent=2))
records=[]
for a in json.loads(Path('tmp/walkqa/verification-16/sources.json').read_text()):
 h=a['heading']; name='hermes-idle-v2-normalized' if h=='side' else 'hermes-stand-away-right' if h=='away-right' else 'hermes-passing-stand-'+h
 m=json.loads((s/(name+'.json')).read_text()); im=Image.open(s/m['image']).convert('RGBA').crop((0,0,612,1059))
 foot=a['contact']['planted']; restFoot='L' if h=='side' else foot; c=m['contacts'][0][restFoot]; target=a['contact'][foot]; dx=target['x']-c['x']; dy=target['y']-c['y']
 im=im.transform(im.size,Image.Transform.AFFINE,(1,0,-dx,0,1,-dy),Image.Resampling.BICUBIC); im.save(r/'sources'/f'{h}-last-alpha.png')
 bg=Image.new('RGBA',im.size,(128,128,128,255));bg.alpha_composite(im);bg.convert('RGB').save(r/'sources'/f'{h}-last.png')
 for suffix in ['', '-alpha']:(r/'sources'/f'{h}-first{suffix}.png').write_bytes(Path(f'tmp/walkqa/verification-16/sources/{h}{suffix}.png').read_bytes())
 records.append({**a,'restAsset':name,'restSupportFoot':restFoot,'restTranslation':[dx,dy]})
(r/'sources.json').write_text(json.dumps(records,indent=2))
