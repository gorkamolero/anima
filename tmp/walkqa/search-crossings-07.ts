import { readFileSync,writeFileSync } from 'node:fs';
import { CharacterMotor } from '../../packages/engine/src/characters/CharacterMotor';
import { findPath,cellPoint } from '../../packages/engine/src/walkarea/navigation';
import { baselineYAt } from '../../packages/engine/src/occlusion/occlusion';
const spr='adventures/shadow-over-innsmouth/public/assets/sprites/hermes/';
const meta=(name:string)=>({...JSON.parse(readFileSync(spr+name+'.json','utf8')),name});
const idle=meta('hermes-idle-v2-normalized');
const cycles={side:meta('hermes-fal-veo-transparent-loop'),away:meta('hermes-walk-away'),toward:meta('hermes-walk-toward'),'away-right':meta('hermes-walk-away-right'),'toward-right':meta('hermes-walk-toward-right')};
const scene='depot-outside',{area,objects,location}=JSON.parse(readFileSync('tmp/walkqa/geometry-07/'+scene+'/navigation.json','utf8'));
const points=area.mask.data.flatMap((v:number,i:number)=>v?[cellPoint(area.mask,i)]:[]);
for(const object of objects){
 const behind=points.filter(p=>p.x>=object.bbox.x&&p.x<=object.bbox.x+object.bbox.w&&p.y<baselineYAt(object,p.x)-1).sort((a,b)=>(a.y-baselineYAt(object,a.x))-(b.y-baselineYAt(object,b.x)));
 if(!behind.length)continue;
 let found:any,attempts=0;
 for(const goal of behind.filter((_:any,i:number)=>i%Math.max(1,Math.floor(behind.length/12))===0).slice(0,12)){
  const fronts=points.filter(p=>p.y>baselineYAt(object,p.x)+40).sort((a,b)=>Math.hypot(a.x-goal.x,a.y-goal.y)-Math.hypot(b.x-goal.x,b.y-goal.y));
  for(const start of fronts.filter((_:any,i:number)=>i%Math.max(1,Math.floor(fronts.length/8))===0).slice(0,8)){
   attempts++;let pose={cycle:idle,frame:0,flipX:false};
   const target={...start,scale:.5,setPosition(x:number,y:number){this.x=x;this.y=y},setScale(s:number){this.scale=s},setDepth(){}};
   const motor=new CharacterMotor(target,area,()=>{},{current:()=>pose,select(d){return {cycle:cycles[d.startsWith('away-')?'away-right':d.startsWith('toward-')?'toward-right':d==='away'?'away':d==='toward'?'toward':'side'],flipX:d==='right'||d.endsWith('-left')}},show(p){pose=p}});
   motor.place(start);void motor.walk(findPath(area.mask,target,goal).slice(1));let crossed=false,frames=0;
   for(;frames<1000&&motor.walking;frames++){motor.update(1000/24);if(target.x>=object.bbox.x&&target.x<=object.bbox.x+object.bbox.w&&target.y<baselineYAt(object,target.x)-1)crossed=true;}
   if(crossed){found={start,goal,frames,endpoint:{x:target.x,y:target.y}};break;}
  }
  if(found)break;
 }
 const result={object:object.id,attempts,found:found??null};console.log(JSON.stringify(result));
 writeFileSync('tmp/walkqa/occlusion-07/'+scene+'/'+object.id+'/motor-search.json',JSON.stringify(result,null,2));
 if(found)writeFileSync('tmp/walkqa/occlusion-07/'+scene+'/'+object.id+'/plan-direct.json',JSON.stringify({place:location,beats:[{name:'direct-front-to-behind',start:[found.start.x,found.start.y],walk:[found.goal.x,found.goal.y],frames:Math.max(120,found.frames+24)},{name:'direct-behind-to-front',walk:[found.start.x,found.start.y],frames:240}]},null,2));
}
