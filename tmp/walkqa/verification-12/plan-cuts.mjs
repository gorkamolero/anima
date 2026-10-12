import {spawnSync} from 'node:child_process';
import {readFileSync,writeFileSync} from 'node:fs';
const e=s=>{const r=spawnSync('agent-browser',['--session','walkqa12','eval','--stdin'],{input:s,encoding:'utf8',maxBuffer:30e6});if(r.status)throw Error(r.stderr||r.stdout);return JSON.parse(r.stdout)};
e('location.reload();true');
for(let i=0;i<300;i++){if(e('(()=>{window.__anima?.step(100);return !!window.__anima?.scene.world&&!window.__anima.scene.openWorldBusy})()'))break;await new Promise(r=>setTimeout(r,100));}
// Pure motor simulation locates all final headings under the new entry/exit policy.
for(const [name,place,starts] of [['road','place-f2d0a7f7f76225002663',[[1097.5,847.5],[957.5,927.5],[960,900],[1200,880]]],['depot','outside',[[1467.5,927.5],[1237.5,977.5],[1300,925],[1450,970]]]]){
 e(`(()=>{window.__ready=false;window.__anima.scene.enterLocation('${place}').then(()=>window.__ready=true);return true})()`);
 for(let i=0;i<300;i++){if(e('(()=>{window.__anima.step(100);return window.__ready})()'))break;await new Promise(r=>setTimeout(r,100));}
 e('window.__anima.captureFrame({stepMs:0}).then(()=>true)');
 const results=[];
 for(const start of starts){
 results.push(...e(`(()=>{const s=window.__anima.scene,m=s.hermesMotor,h=s.hermesSprite,found=[];for(const dx of [-240,-120,0,120,240])for(const dy of [-70,0,70]){if(!dx&&!dy)continue;m.heading='away';m.place({x:${start[0]},y:${start[1]}});const initial={x:h.x,y:h.y};const goal={x:initial.x+dx,y:initial.y+dy};void m.walk(s.previewWalk(goal.x,goal.y));let n=0;while(m.walking&&n++<300)m.update(1000/24);const c=m.snapshot();if(!m.walking&&n>6&&n<300&&c.arrival&&c.cut?.matched)found.push({heading:c.heading,start:[initial.x,initial.y],walk:[goal.x,goal.y],frames:n,end:{x:h.x,y:h.y},texture:h.texture.key});}return found})()`));
 }
 const beats=[];for(const d of ['left','right','away','toward','away-left','away-right','toward-left','toward-right']){const choices=results.filter(r=>r.heading===d).sort((a,b)=>a.frames-b.frames);console.log(name,d,choices.length,choices[0]);if(choices[0])beats.push({...choices[0],name:d,heading:undefined,frames:12,facing:'away'});}
 writeFileSync(`tmp/walkqa/verification-12/${name}-candidates.json`,JSON.stringify(results));writeFileSync(`tmp/walkqa/verification-12/${name}-plan.json`,JSON.stringify({place,beats}));
 if(name==='depot'){
 const starts=e(`(()=>{const s=window.__anima.scene,m=s.hermesMotor,h=s.hermesSprite,out=[];for(const d of ['left','right','away','toward','away-left','away-right','toward-left','toward-right']){for(const start of [[1467.5,927.5],[1300,925],[1237.5,977.5]]){m.heading=d;m.place({x:start[0],y:start[1]});const goal={x:h.x+(d.includes('left')?-180:d.includes('right')?180:0),y:h.y+(d.startsWith('away')?-70:d.startsWith('toward')?70:0)};void m.walk([goal],d);const c=m.snapshot();if(m.walking&&c.heading===d){out.push({name:d,heading:d,facing:d,start,walk:[goal.x,goal.y],frames:12,captureStart:true});break;}}}return out})()`);
 writeFileSync('tmp/walkqa/verification-12/starts-plan.json',JSON.stringify({place,beats:starts}));console.log('starts',starts.length);
 }
}
