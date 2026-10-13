import pathlib,json,cv2
from PIL import Image,ImageDraw
r=pathlib.Path('tmp/walkqa/harness-21');out=pathlib.Path('tmp/walkqa/harness-22/height-evidence');out.mkdir(exist_ok=True,parents=True)
cases=[('road','far-left',61),('road','near-left',31),('outside','near-left',-1),('church','deepest',-1),('alley','deepest',50)]
for scene,name,index in cases:
 p=r/scene/(name+'.json');rows=json.loads(p.read_text());i=index%len(rows);row=rows[i];cap=cv2.VideoCapture(str(p.with_suffix('.mp4')));cap.set(cv2.CAP_PROP_POS_FRAMES,i);ok,frame=cap.read();cap.release()
 if not ok:continue
 x,y=row['x'],row['y'];h=1100*row['scale'];im=Image.fromarray(cv2.cvtColor(frame,cv2.COLOR_BGR2RGB));im=im.crop((int(x-h*.45),int(y-h*1.08),int(x+h*.45),int(y+40)));im.thumbnail((550,750));tile=Image.new('RGB',(550,800));tile.paste(im,((550-im.width)//2,45));ImageDraw.Draw(tile).text((8,8),f'{scene}/{name} frame {i} | {row["texture"]}',fill='white');tile.save(out/f'{scene}-{name}-{i}.png')
