import {spawnSync} from 'node:child_process';
import {readFileSync,writeFileSync} from 'node:fs';
const e=s=>{const r=spawnSync('agent-browser',['--session','walkqa12','eval','--stdin'],{input:s,encoding:'utf8',maxBuffer:10e6});if(r.status)throw Error(r.stderr||r.stdout);return JSON.parse(r.stdout)};
const candidates=e(`(()=>{const s=window.__anima.scene,m=s.hermesMotor,h=s.hermesSprite,out=[];for(const start of [[1467.5,927.5],[1300,925],[1237.5,977.5],[1600,980],[1050,1000]])for(const dx of [40,80,120,200])for(const dy of [20,40,70,100]){m.heading='toward-right';m.place({x:start[0],y:start[1]});const initial=[h.x,h.y],goal={x:h.x+dx,y:h.y+dy};void m.walk(s.previewWalk(goal.x,goal.y),'toward-right');let n=0;while(m.walking&&n++<160)m.update(1000/24);const c=m.snapshot();if(!m.walking&&n>6&&n<160&&c.arrival&&c.heading==='toward-right'&&c.cut?.matched)out.push({name:'toward-right',heading:'toward-right',facing:'toward-right',start:initial,walk:[goal.x,goal.y],frames:12,n});}return out})()`);
writeFileSync('tmp/walkqa/verification-12/depot-missing-candidates.json',JSON.stringify(candidates));
candidates.sort((a,b)=>a.n-b.n);console.log(candidates.slice(0,4));
if(!candidates.length)throw Error('No matched stop');
const p='tmp/walkqa/verification-12/depot-plan.json',plan=JSON.parse(readFileSync(p));plan.beats.push(candidates[0]);writeFileSync(p,JSON.stringify(plan));
