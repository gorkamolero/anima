import cv2,json,sys
from pathlib import Path
r=Path('tmp/walkqa/verification-16b')/sys.argv[1];ps=sorted((r/'raw-frames').glob('*.png'));ref=cv2.imread(str(ps[0]),0);template=ref[929:983,246:294];out=[]
for i,p in enumerate(ps):
 im=cv2.imread(str(p),0);result=cv2.matchTemplate(im[909:1003,226:324],template,cv2.TM_CCOEFF_NORMED);_,score,_,loc=cv2.minMaxLoc(result);out.append({'frame':i,'dx':loc[0]-20,'dy':loc[1]-20,'score':score})
(r/'support-tracking.json').write_text(json.dumps(out,indent=2));print(out[::6])
