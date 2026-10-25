import {spawnSync} from 'node:child_process';
import {mkdirSync,writeFileSync} from 'node:fs';
const ev=source=>{const r=spawnSync('agent-browser',['--session','track1-scale','eval','--stdin'],{input:source,encoding:'utf8',maxBuffer:32*1024*1024});if(r.status)throw Error(r.stderr);return JSON.parse(r.stdout)};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const places=await(await fetch('http://localhost:3001/api/places')).json();
const ids=process.argv.slice(2).length?process.argv.slice(2):['outside','inside',...places.map(p=>p.id)];
mkdirSync('tmp/overnight/reports/scale',{recursive:true});
for(const id of ids){try{
 spawnSync('agent-browser',['--session','track1-scale','open',`http://localhost:8080/?scene=${id}&mute=1`],{encoding:'utf8'});
 for(let i=0;i<300;i++){if(ev('(()=>{window.__anima?.step(100);return !!window.__anima?.scene.geometryReady&&!window.__anima?.scene.openWorldBusy})()'))break;await sleep(100)}
 ev(`(()=>{window.scaleLoaded=false;void window.__anima.scene.enterLocation(${JSON.stringify(id)}).then(()=>window.scaleLoaded=true);return true})()`);
 for(let i=0;i<600;i++){if(ev('(()=>{window.__anima.step(100);return window.scaleLoaded&&window.__anima.scene.hermesSprite.visible})()'))break;await sleep(100)}
 for(const [label,fraction] of [['near',.9],['middle',.5],['far',.1]]){
 const shot=ev(`(async()=>{const s=window.__anima.scene;if(s.locationId()!==${JSON.stringify(id)}||!s.geometryReady||!s.hermesSprite.visible)throw Error('Scene not ready for scale');const m=s.walkArea.mask;const points=m.data.flatMap((v,i)=>v?[{x:((i%m.width)+.5)*1920/m.width,y:(Math.floor(i/m.width)+.5)*1080/m.height}]:[]).filter(p=>p.x>300&&p.x<1620&&p.y<1000);const ys=points.map(p=>p.y).sort((a,b)=>a-b);const targetY=ys[Math.floor((ys.length-1)*${fraction})];const p=points.reduce((a,b)=>Math.abs(b.y-targetY)*4+Math.abs(b.x-960)<Math.abs(a.y-targetY)*4+Math.abs(a.x-960)?b:a);s.hermesMotor.place(p);s.hermesMotor.face('left');return {image:await window.__anima.captureFrame({format:'png',width:1920}),anchor:s.hermesMotor.anchor,bounds:s.hermesSprite.getBounds(),location:s.locationId(),scale:s.hermesSprite.scaleX}})()`);
 const stem=`tmp/overnight/reports/scale/${id}-${label}`;writeFileSync(stem+'.png',Buffer.from(shot.image.split(',')[1],'base64'));delete shot.image;writeFileSync(stem+'.json',JSON.stringify(shot));
 }
 console.log('SCALE',id,'3 visible full-frame captures');
 }catch(e){console.log('ERROR',id,String(e))}}
