import {spawnSync} from 'node:child_process';import {writeFileSync,readFileSync} from 'node:fs';
const e=s=>{const r=spawnSync('agent-browser',['--session','walkqa15-depot','eval','--stdin'],{input:s,encoding:'utf8',maxBuffer:3e6});if(r.status)throw Error(r.stderr);return JSON.parse(r.stdout)};
e('location.reload();true');for(let i=0;i<300;i++){if(e('(()=>{window.__anima?.step(100);return !!window.__anima?.scene.world&&!window.__anima.scene.openWorldBusy})()'))break;await new Promise(r=>setTimeout(r,100));}
const out=[];
for(const scene of ['road','depot','starts']){
 const plan=JSON.parse(readFileSync(`tmp/walkqa/verification-15/${scene}-plan.json`));e(`(()=>{window.__ready=false;window.__anima.scene.enterLocation('${plan.place}').then(()=>window.__ready=true);return true})()`);for(let i=0;i<300;i++){if(e('(()=>{window.__anima.step(100);return window.__ready})()'))break;await new Promise(r=>setTimeout(r,100));}e('window.__anima.captureFrame({stepMs:0}).then(()=>true)');
 for(const beat of plan.beats){out.push(e(`(()=>{const b=${JSON.stringify(beat)},s=window.__anima.scene,m=s.hermesMotor,h=s.hermesSprite;m.heading=b.facing??'away';m.place({x:b.start[0],y:b.start[1]});void m.walk(s.previewWalk(b.walk[0],b.walk[1]),b.heading);let n=0,settling=0;while(m.walking&&n++<600){m.update(1000/24);if(m.snapshot().settling)settling++;}const c=m.snapshot();return {scene:'${scene}',name:b.name,n,settlingSeconds:settling/24,position:[h.x,h.y],...c};})()`));}
}
writeFileSync('tmp/walkqa/verification-15/simulation.json',JSON.stringify(out,null,2));console.log(out.map(r=>({scene:r.scene,name:r.name,h:r.heading,arrival:r.arrival?.distance,half:r.arrival?.halfStride,matched:r.cut?.matched,settling:r.settlingSeconds,n:r.n})));
