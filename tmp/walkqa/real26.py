"""Frame sequences decoded from real final clips for stop/crossing review."""
import pathlib,json,cv2,math
from PIL import Image,ImageDraw
root=pathlib.Path('tmp/walkqa/harness-26');out=root/'real-review';out.mkdir(exist_ok=True)
index=json.load(open('tmp/walkqa/sim/26-final/visual-index.json'))['walks']
selected={'outside':'diagonal-away','inside':'exit-bus_platform','road':'exit-far','alley':'near-right','pier':'near-right','church':'near-right','lobby':'object','grocery':'object','square':'object','stepped-street':'exit-far'}
for scene,name in selected.items():
 rows=json.load(open(root/scene/(name+'.json')));entry=next(r for r in index if r['scene']==scene and r['walk']==name)
 stop=next((i for i in range(len(rows)-1,-1,-1) if rows[i]['walking']),max(0,len(rows)-12))
 frames=sorted(set(max(0,min(len(rows)-1,i)) for i in [stop-4,stop-2,stop-1,stop,stop+1,stop+2,stop+4,stop+8]+[c['frame']+d for c in entry['crossingsTurns'] for d in [-1,0,1]]))
 cap=cv2.VideoCapture(str(root/scene/(name+'.mp4')));board=Image.new('RGB',(4*320,math.ceil(len(frames)/4)*260),(20,20,20));draw=ImageDraw.Draw(board)
 for j,i in enumerate(frames):
  cap.set(cv2.CAP_PROP_POS_FRAMES,i);ok,f=cap.read();assert ok
  im=Image.fromarray(cv2.cvtColor(f,cv2.COLOR_BGR2RGB));r=rows[i];x,y=r['x'],r['y'];im=im.crop((round(x)-320,round(y)-440,round(x)+320,round(y)+40)).resize((320,240));a,b=j%4*320,j//4*260;board.paste(im,(a,b));draw.text((a+3,b+242),f'{scene}/{name} #{i}',fill='white')
 cap.release();board.save(out/(scene+'.jpg'),quality=92)
