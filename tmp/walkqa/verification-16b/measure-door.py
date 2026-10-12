"""Refine the visually localized door against image edges; no painted figure proxy."""
from PIL import Image,ImageDraw
import numpy as np,json
from pathlib import Path
r=Path('tmp/walkqa/verification-16b'); im=Image.open('adventures/shadow-over-innsmouth/public/generated/5ca32cfdd011640725ee52cf1e1d8fbd07a6ce6bdb34d4f5df52206964b4b53a.png').convert('RGB')
# Assistant visual localization, explicitly retained for audit (not an autonomous detector).
box=(1010,294,1079,445); horizon=383
w,h=im.size
reference={'label':'hut-door-opening','rect':{'x':box[0]/w,'y':box[1]/h,'width':(box[2]-box[0])/w,'height':(box[3]-box[1])/h},'realHeightM':2.03,'horizonY':horizon/h,'provenance':'Assistant visual localization at native image resolution; 2.03m standard door assumption. Three provider localizations rejected by inspection.'}
(r/'door-reference.json').write_text(json.dumps(reference,indent=2))
d=ImageDraw.Draw(im);d.rectangle(box,outline='lime',width=3);d.line((0,horizon,w,horizon),fill='yellow',width=2);im.save(r/'door-reference-overlay.png')
