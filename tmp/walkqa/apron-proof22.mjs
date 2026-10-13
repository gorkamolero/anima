import {readFileSync,readdirSync,mkdirSync,writeFileSync} from 'node:fs';import{homedir}from'node:os';
let pw;const base=homedir()+'/.npm/_npx';for(const d of readdirSync(base)){try{pw=await import(base+'/'+d+'/node_modules/playwright/index.mjs');break}catch{}}
const browser=await pw.chromium.launch({channel:'chromium',headless:true,args:['--use-angle=metal']});const page=await browser.newPage({viewport:{width:1920,height:1080}});const out='tmp/walkqa/harness-22/apron-proof';mkdirSync(out,{recursive:true});
try {
await page.goto('http://localhost:8080/?mute=1');await page.waitForFunction(()=>window.__anima?.scene.world&&!window.__anima.scene.openWorldBusy);
await page.evaluate(async()=>{const s=window.__anima.scene;let done=false;s.enterLocation('place-2635d8cd03bce818a634').then(()=>done=true);for(let i=0;!done&&i<1000;i++){window.__anima.step(100);await new Promise(r=>setTimeout(r,10));}if(!done)throw Error('enter timeout');s.setPlacementDebugEnabled(false);s.hermesMotor.stop(true);s.hermesMotor.update=()=>{};});
const rows=JSON.parse(readFileSync('tmp/walkqa/harness-21/alley/deepest.json'));
for(const i of [49,50,51]){
const png=await page.evaluate(async r=>{const s=window.__anima.scene,h=s.hermesSprite,m=s.hermesMotor;m.anchor={...r.contact.anchor};h.setTexture(r.texture,r.frame).setFlipX(r.flip).setScale(r.scale).setPosition(r.x,r.y).setDepth(r.depth);return window.__anima.captureFrame({stepMs:0,width:1920,format:'png'});},rows[i]);
writeFileSync(out+'/'+i+'.png',Buffer.from(png.split(',')[1],'base64'));
}
writeFileSync(out+'/provenance.json',JSON.stringify({source:'harness-21/alley/deepest',frames:[49,50,51],method:'Replay exact pose, position, scale and anchor against the new cached occluder layers; no movement simulation'},null,2));
}finally{await browser.close()}
