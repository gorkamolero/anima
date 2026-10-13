"""Compare cycle direction to measured ground velocity, relative to camera view ray."""
import json,sys,math
SECTORS=['right','away-right','away','away-left','left','toward-left','toward','toward-right']
def check(rows):
 bad=[];count=0;switches=0;length=0;last=None
 for i,(a,b) in enumerate(zip(rows,rows[1:]),1):
  if not(a.get('walking') and b.get('walking')) or b['contact'].get('settling') or b['contact'].get('drawn') or a.get('location')!=b.get('location'):continue
  ga,gb=a['contact']['ground'],b['contact']['ground'];dx,dz=gb['x']-ga['x'],gb['y']-ga['y'];distance=math.hypot(b['x']-a['x'],b['y']-a['y'])
  if math.hypot(dx,dz)<1e-7:continue
  length+=distance;heading=b['contact']['heading'];angle=math.atan2(dz,dx)+math.atan2(gb['x'],gb['y']);expected=SECTORS.index(heading)*math.pi/4;delta=abs(math.atan2(math.sin(angle-expected),math.cos(angle-expected)));count+=1
  if delta>math.pi/6:bad.append(i)
  if last and last!=heading:switches+=1
  last=heading
 rate=1-len(bad)/max(1,count);limit=length/300
 return dict(pass_=count>0 and rate>=.95 and switches<=limit,flagged=bad,frames=count,agreement=rate,switches=switches,pathPixels=length,maxSwitches=limit)
if __name__=='__main__':
 if '--self-test' in sys.argv:
  rows=[dict(x=i*10,y=500,walking=True,contact=dict(ground=dict(x=i*.001,y=10),heading='right')) for i in range(40)];assert check(rows)['pass_'];rows[10]['contact']['heading']='away';rows[11]['contact']['heading']='away';rows[12]['contact']['heading']='away';assert not check(rows)['pass_'];print('PASS: wrong-cycle frames rejected')
 else:print(json.dumps(check(json.load(open(sys.argv[1])))))
