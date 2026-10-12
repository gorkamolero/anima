import json
from pathlib import Path
from PIL import Image,ImageDraw
s=Path('adventures/shadow-over-innsmouth/public/assets/sprites/hermes');o=Path('tmp/walkqa/verification-14')
candidates={'side':('hermes-fal-veo-transparent-loop',[11,28,29]),'away':('hermes-walk-away',[0,1,11,12]),'away-right':('hermes-walk-away-right',[8,9,21,29,30,44]),'toward':('hermes-walk-toward',[0,12,13,24]),'toward-right':('hermes-walk-toward-right',[7,8,19])}
for d,(n,ix) in candidates.items():
 m=json.loads((s/(n+'.json')).read_text());im=Image.open(s/m['image']);w,h=m['frameWidth'],m['frameHeight'];sheet=Image.new('RGB',(400*(len(ix)+1),360),'#828282');dr=ImageDraw.Draw(sheet)
 for j,i in enumerate(ix+[-1]):
  fr=Image.open(o/'edits'/f'{d}-registered.png').convert('RGBA') if i<0 else im.crop((i%m['cols']*w,i//m['cols']*h,(i%m['cols']+1)*w,(i//m['cols']+1)*h)).convert('RGBA')
  bg=Image.new('RGBA',(w,h),'#828282');bg.alpha_composite(fr);dd=ImageDraw.Draw(bg)
  for x in range(100,500,25):dd.line((x,800,x,h),fill='#999999');dd.text((x,810),str(x),fill='white')
  for y in range(850,h,25):dd.line((100,y,500,y),fill='#999999');dd.text((105,y),str(y),fill='white')
  sheet.paste(bg.crop((100,800,500,h)),(j*400,55));dr.text((j*400+5,5),f'{d} frame {i} '+(str(m['contacts'][i]) if i>=0 else 'standing'),fill='white')
 sheet.save(o/(d+'-boot-grid.png'))
(o/'passing-candidates.json').write_text(json.dumps(candidates,indent=2)+'\n')
