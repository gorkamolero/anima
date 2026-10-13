import {readFileSync,readdirSync,mkdirSync,writeFileSync} from 'node:fs';
import{homedir}from'node:os';
let pw;const base=homedir()+'/.npm/_npx';for(const d of readdirSync(base)){try{pw=await import(base+'/'+d+'/node_modules/playwright/index.mjs');break}catch{}}
const browser=await pw.chromium.launch({channel:'chromium',headless:true,args:['--use-angle=metal']});
const page=await browser.newPage({viewport:{width:1920,height:1080}});
const out='tmp/walkqa/harness-22/size-trials';mkdirSync(out,{recursive:true});
try{
await page.goto('http://localhost:8080/?mute=1');await page.waitForFunction(()=>window.__anima?.scene.world&&!window.__anima.scene.openWorldBusy);
const snapshots=await page.evaluate(async()=>{
const s=window.__anima.scene,m=s.hermesMotor,h=s.hermesSprite;
m.heading='away';m.place({x:970,y:950});
const original=m.update.bind(m);m.update=()=>{};
const c=m.pose.cycle.contacts[m.pose.frame][m.foot],fw=m.pose.cycle.frameWidth,fh=m.pose.cycle.frameHeight;
const anchor={...m.anchor},scale=h.scaleX;const factor=1030.5/987;
const results=[];
for(const [name,kx,ky] of [['baseline',1,1],['uniform',factor,factor],['vertical',1,factor]]){
h.setScale(scale*kx,scale*ky);h.setPosition(anchor.x-(c.x-fw/2)*h.scaleX*(h.flipX?-1:1),anchor.y-(c.y-fh)*h.scaleY);
const png=await window.__anima.captureFrame({stepMs:0,width:1920,format:'png'});
results.push({name,scaleX:h.scaleX,scaleY:h.scaleY,factor,anchor,png});
}
m.update=original;return results;
});
for(const {png,...result} of snapshots){writeFileSync(out+'/'+result.name+'.png',Buffer.from(png.split(',')[1],'base64'));writeFileSync(out+'/'+result.name+'.json',JSON.stringify(result,null,2));}
}finally{await browser.close()}
