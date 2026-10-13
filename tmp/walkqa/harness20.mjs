import {mkdirSync,readFileSync,writeFileSync,existsSync,rmSync,readdirSync} from 'node:fs';
import {spawn,spawnSync} from 'node:child_process';
import {once} from 'node:events';
import {homedir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
async function playwright(){
 if(process.env.PLAYWRIGHT_MODULE)return import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
 try{return await import('playwright');}catch(error){
  const cache=join(homedir(),'.npm','_npx');
  for(const name of existsSync(cache)?readdirSync(cache):[]){const module=join(cache,name,'node_modules/playwright/index.mjs');if(existsSync(module))return import(pathToFileURL(module).href);}
  throw new Error('Install Playwright or set PLAYWRIGHT_MODULE to its index.mjs',{cause:error});
 }
}
const {chromium}=await playwright();
const root='tmp/walkqa/harness-20';
const experiment=process.argv.find(a=>a.startsWith('--experiment='))?.split('=')[1];
const outputRoot=experiment?root+'/experiments/'+experiment:root;
const corpus=JSON.parse(readFileSync('tmp/walkqa/corpus-places.json'));
const scenes={outside:'outside',inside:'inside',road:'place-f2d0a7f7f76225002663',alley:'place-2635d8cd03bce818a634',...Object.fromEntries(Object.entries(corpus).map(([k,v])=>[k,v.id]))};
const browser=await chromium.launch({channel:'chromium',headless:true,args:['--use-angle=metal']});
const page=await browser.newPage({viewport:{width:1920,height:1080}});
page.on('pageerror',e=>console.error('PAGE ERROR',String(e)));
page.on('console',m=>{if(m.type()==='error')console.error('BROWSER ERROR',m.text());});
const selectedWalk=process.argv.find(a=>a.startsWith('--walk='))?.split('=')[1];
const selected=process.argv.find(a=>a.startsWith('--scene='))?.split('=')[1];
try {
if(['tight-stop','heading-and-stop'].includes(experiment))await page.route('**/CharacterMotor.ts*',async route=>{const response=await route.fetch();let source=await response.text();const marker='distance <= halfStride &&';if(!source.includes(marker))throw Error('Experiment source mismatch');source=source.replace(marker,'distance <= Math.min(12, halfStride) &&');if(experiment==='heading-and-stop'){const marker='if (score >= here - 0.01)';if(!source.includes(marker))throw Error('Heading experiment source mismatch');source=source.replace(marker,`const hg=toMetres(this.area.perspective,this.target),gg=toMetres(this.area.perspective,this.path[1]??goal);const requiredHeading=headingFromGround(gg.x-hg.x,gg.y-hg.y,this.heading,hg,0);if(heading!==requiredHeading)continue;${marker}`);}mkdirSync(outputRoot,{recursive:true});writeFileSync(outputRoot+'/experimental-motor.js',source);await route.fulfill({response,body:source});});
if(experiment?.startsWith('baseline-')){
 const overrides=JSON.parse(readFileSync(outputRoot+'/baseline-overrides.json'));
 await page.route('**/api/occluders/*',async route=>{const response=await route.fetch();const data=await response.json(),id=new URL(route.request().url()).pathname.split('/').pop();for(const object of data.occluders??[]){if(overrides[id]?.[object.id])object.baseline=overrides[id][object.id];}await route.fulfill({response,json:data});});
}
await page.goto('http://localhost:8080/?mute=1&walkqa=20');
await page.waitForFunction(()=>window.__anima?.scene.world&&!window.__anima.scene.openWorldBusy);
await page.evaluate(()=>{localStorage.setItem('anima.world.session','walkqa-20-'+Date.now());});
await page.reload();await page.waitForFunction(()=>window.__anima?.scene.world&&!window.__anima.scene.openWorldBusy);
async function initQa(){await page.evaluate(async()=>{await window.__anima.captureFrame({stepMs:0,width:1920,format:'png'});const s=window.__anima.scene;window.qaEvents=[];for(const key of ['triggerExit','emitOpenWorldState']){const orig=s[key];s[key]=function(...args){window.qaEvents.push({frame:window.qaFrame??-1,type:key,data:JSON.parse(JSON.stringify(args[0])),location:s.locationId(),walking:s.hermesMotor.walking});return orig.apply(this,args);};}});}
await initQa();
async function enter(place){await page.evaluate(async place=>{const a=window.__anima,s=a.scene;let done=false,error;s.enterLocation(place).then(()=>done=true).catch(e=>{error=String(e);done=true;});for(let i=0;!done&&i<1000;i++){a.step(100);await new Promise(r=>setTimeout(r,10));}if(!done||error)throw Error(error??'enter timeout');s.setPlacementDebugEnabled(false);if(!s.geometryReady)throw Error('geometry unavailable');},place);}
async function geometry(){return page.evaluate(()=>{const s=window.__anima.scene;return {location:s.locationId(),area:s.walkArea,exits:s.sceneExits,objects:s.objectLayers.map(l=>l.data),interactables:s.interactables,background:s.activeScene().background};});}
for(const [name,place]of Object.entries(scenes)){
if(selected&&selected!==name)continue;
const out=outputRoot+'/'+name;mkdirSync(out,{recursive:true});await enter(place);
const clean=await page.evaluate(async()=>{const s=window.__anima.scene;const visible=s.hermesSprite.visible;s.hermesSprite.visible=false;const png=await window.__anima.captureFrame({stepMs:0,width:1920,format:'png'});s.hermesSprite.visible=visible;return png;});writeFileSync(out+'/background.png',Buffer.from(clean.split(',')[1],'base64'));
const geo=await geometry();writeFileSync(out+'/navigation.json',JSON.stringify(geo));
const areas={[place]:{...geo.area,mask:geo.area.rawMask??geo.area.mask}};
writeFileSync(out+'/area.json',JSON.stringify({...geo,area:areas[place],areas}));
if(process.argv.includes('--probe')){console.log(name,geo.area.mask.data.filter(Boolean).length,geo.exits.length,geo.interactables.length);continue;}
const plan=JSON.parse(readFileSync(root+'/'+name+'/plan.json'));writeFileSync(out+'/plan.json',JSON.stringify(plan,null,2));
for(const beat of plan.beats){
if(selectedWalk&&beat.name!==selectedWalk)continue;
if(existsSync(out+'/'+beat.name+'-events.json')&&!process.argv.includes('--redo'))continue;
await page.reload();await page.waitForFunction(()=>window.__anima?.scene.world&&!window.__anima.scene.openWorldBusy);await initQa();
await enter(place);
const setup=await page.evaluate(beat=>{const s=window.__anima.scene;s.hermesMotor.heading='right';const a=s.walkArea,m=s.hermesMotor,raw=a.rawMask??a.mask,clear=a.clearanceMask??a.mask;const on=(mask,x,y)=>{const ix=Math.floor(x*mask.width/1920),iy=Math.floor(y*mask.height/1080);return ix>=0&&iy>=0&&ix<mask.width&&iy<mask.height&&mask.data[iy*mask.width+ix]>0;};const candidates=[];for(let i=0;i<a.mask.data.length;i++)if(a.mask.data[i]){const x=(i%a.mask.width+.5)*1920/a.mask.width,y=(Math.floor(i/a.mask.width)+.5)*1080/a.mask.height;candidates.push({x,y,d:(x-beat.start[0])**2+(y-beat.start[1])**2});}candidates.sort((a,b)=>a.d-b.d);let valid=false;for(const p of candidates){m.place(p);const h=s.hermesSprite,meta=m.pose.cycle,c=meta.contacts[m.pose.frame];valid=['L','R'].every(f=>{const x=h.x+(c[f].x-meta.frameWidth/2)*h.scaleX*(h.flipX?-1:1),y=h.y+(c[f].y-meta.frameHeight)*h.scaleX;return on(raw,x,y)&&on(clear,x,y);});if(valid)break;}if(!valid)throw Error('No safe standing start in scene');window.qaFrame=-1;window.qaEvents=[];let click=beat.click;if(beat.object){click=null;for(let y=70;y<940&&!click;y+=5)for(let x=0;x<1920;x+=5){if(s.findInteractableAtPoint(x,y)?.name===beat.object){click=[x,y];break;}}if(!click)throw Error('No object hit pixel');}const preview=s.previewWalk(...click).map(p=>({x:p.x,y:p.y}));return {click,preview,start:{x:s.hermesSprite.x,y:s.hermesSprite.y},exits:s.sceneExits};},beat);
const frames=[],events=[];let idle=0;const maxFrames=Number(process.argv.find(a=>a.startsWith('--max-frames='))?.split('=')[1]??2400);let timedOut=false;
const encoder=spawn('ffmpeg',['-y','-v','error','-f','image2pipe','-framerate','24','-i','-','-c:v','libx264','-preset','fast','-crf','16','-pix_fmt','yuv420p',out+'/'+beat.name+'.mp4']);let encerr='';encoder.stderr.on('data',d=>encerr+=d);
await page.evaluate(click=>window.__anima.click(...click),setup.click);
for(let i=0;i<maxFrames+12;i++){
if(i===maxFrames){timedOut=true;await page.evaluate(()=>{window.qaEvents.push({type:"capture-timeout",frame:window.qaFrame});window.__anima.scene.hermesMotor.stop(true);});}
let frameTimer;const {png,...row}=await Promise.race([page.evaluate(async i=>{window.qaFrame=i;let row;const a=window.__anima;const png=await a.captureFrame({stepMs:1000/24,width:1920,format:'png',onFrame:()=>{const s=a.scene,h=s.hermesSprite,m=s.hermesMotor;row={t:i/24,visible:h.visible,x:h.x,y:h.y,scale:h.scaleX,flip:h.flipX,texture:h.texture.key,frame:Number(h.frame.name),walking:m.walking,contact:m.snapshot(),path:m.path.map(p=>({x:p.x,y:p.y})),target:m.goal?{x:m.goal.x,y:m.goal.y}:null,location:s.locationId(),ui:s.openWorldBusy,inputBlocked:s.inputBlocked,arriving:s.arrivingExit,object:s.selectedInteractable?.name,depth:h.depth,occluders:s.objectLayers.map(l=>({id:l.data.id,depth:l.image.depth,baseline:l.data.baseline,bounds:(()=>{const b=l.image.getBounds();return {x:b.x,y:b.y,width:b.width,height:b.height}})()})).concat([s.katSprite,s.katSeatedSprite].filter(k=>k?.visible).map(k=>{const b=k.getBounds(),f=k.frame;return {id:k.texture.key,depth:k.depth,baseline:[{x:b.x,y:k.y},{x:b.right,y:k.y}],bounds:{x:b.x,y:b.y,width:b.width,height:b.height},sprite:{texture:k.texture.key,cutX:f.cutX,cutY:f.cutY,width:f.cutWidth,height:f.cutHeight,flip:k.flipX}};}))};}});return {png,...row};},i),new Promise((_,reject)=>{frameTimer=setTimeout(()=>reject(Error('Capture snapshot timeout at '+name+'/'+beat.name+' frame '+i)),30000);})]);clearTimeout(frameTimer);
frames.push(row);if(!encoder.stdin.write(Buffer.from(png.split(',')[1],'base64')))await once(encoder.stdin,'drain');
if(!areas[row.location]&&row.visible&&!row.ui){const g=await geometry();areas[g.location]={...g.area,mask:g.area.rawMask??g.area.mask};}
idle=(!row.walking&&!row.ui&&!row.arriving&&!row.inputBlocked)?idle+1:0;
if(idle>=12&&i>=27)break;
if(i%120===0)writeFileSync(out+'/'+beat.name+'.partial.json',JSON.stringify(frames));
}
encoder.stdin.end();const [code]=await once(encoder,'close');if(code)throw Error(encerr);
writeFileSync(out+'/'+beat.name+'.json',JSON.stringify(frames));
writeFileSync(out+'/'+beat.name+'-events.json',JSON.stringify({beat,setup,events:await page.evaluate(()=>window.qaEvents),completed:idle>=12&&!timedOut,timedOut},null,2));
writeFileSync(out+'/area.json',JSON.stringify({...geo,area:areas[place],areas}));
spawnSync('ffmpeg',['-y','-v','error','-i',out+'/'+beat.name+'.mp4','-vf',`fps=6,scale=320:-1,tile=6x${Math.ceil(frames.length/24)}`,'-frames:v','1',out+'/'+beat.name+'-sheet.png']);
rmSync(out+'/'+beat.name+'.partial.json',{force:true});console.log(name,beat.name,frames.length,timedOut?'TIMEOUT':idle>=12?'stopped':'INCOMPLETE');
}
}
}finally{await browser.close();}
