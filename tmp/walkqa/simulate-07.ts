import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import {CharacterMotor} from '../../packages/engine/src/characters/CharacterMotor';
import {findPath} from '../../packages/engine/src/walkarea/navigation';
import {contactOnScreen,type FootPose} from '../../packages/engine/src/characters/footLock';
const spr='adventures/shadow-over-innsmouth/public/assets/sprites/hermes/';
const meta=(name:string)=>({...JSON.parse(readFileSync(spr+name+'.json','utf8')),name});
const cycles={side:meta('hermes-fal-veo-transparent-loop'),away:meta('hermes-walk-away'),toward:meta('hermes-walk-toward'),'away-right':meta('hermes-walk-away-right'),'toward-right':meta('hermes-walk-toward-right')};
for(const scene of process.argv.slice(2).length?process.argv.slice(2):['road','alley','depot-outside','depot-inside']){
 const {area,exits}=JSON.parse(readFileSync(`tmp/walkqa/geometry-07/${scene}/navigation.json`,'utf8'));
 const plan=JSON.parse(readFileSync(`tmp/walkqa/${scene}-${process.env.PLAN_SUFFIX??"07"}-plan.json`,'utf8'));
 mkdirSync(`tmp/walkqa/simulation-07/${scene}`,{recursive:true});
 writeFileSync(`tmp/walkqa/simulation-07/${scene}/area.json`,JSON.stringify({area:{...area,mask:area.rawMask}}));
 for(const beat of plan.beats){
 let pose:FootPose={cycle:meta('hermes-idle-v2-normalized'),frame:0,flipX:false};
 const target={x:960,y:850,scale:.5,setPosition(x:number,y:number){this.x=x;this.y=y},setScale(s:number){this.scale=s},setDepth(){}};
 const motor=new CharacterMotor(target,area,()=>{},{current:()=>pose,select(d){return {cycle:cycles[d.startsWith('away-')?'away-right':d.startsWith('toward-')?'toward-right':d==='away'?'away':d==='toward'?'toward':'side'],flipX:d==='right'||d.endsWith('-left')}},show(p){pose=p}});
 const start=beat.start??plan.start;motor.place({x:start[0],y:start[1]});
 let click=beat.click;
 if(beat.exit){const e=exits.find(e=>e.id===beat.exit||e.kind===beat.exit);if(!e){console.log(scene,beat.name,"MISSING EXIT");continue;}click=[e.region.reduce((n,p)=>n+p.x,0)/e.region.length,e.region.reduce((n,p)=>n+p.y,0)/e.region.length]}
 if(!click)continue;
 const dest={x:click[0],y:click[1]},path=findPath(area.mask,target,dest),goal=path.at(-1);
 const pos={x:target.x,y:target.y};void motor.walk(path.slice(1));
 const log=[];
 for(let i=0;i<2400;i++){
 motor.update(1000/24);
 log.push({x:target.x,y:target.y,scale:target.scale,texture:pose.cycle.name,frame:pose.frame,flip:pose.flipX,walking:motor.walking,contact:motor.snapshot()});
 if(!motor.walking)break;
 }
 writeFileSync(`tmp/walkqa/simulation-07/${scene}/${beat.name}.json`,JSON.stringify(log));
 console.log(scene,beat.name,log.length,'frames',Math.round(Math.hypot(target.x-pos.x,target.y-pos.y)),'px',Math.round(Math.hypot(target.x-goal.x,target.y-goal.y)),'to goal',motor.arrival?'arrived':'STOP',JSON.stringify(motor.snapshot().heading));
 }
}
