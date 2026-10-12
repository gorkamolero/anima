import {readFileSync,writeFileSync} from 'node:fs';
import {findPath} from '../../packages/engine/src/walkarea/navigation';
const rows=[];
for(const scene of ['road','alley','depot-outside','depot-inside']){
 const root=`tmp/walkqa/final-06/${scene}`,geo=JSON.parse(readFileSync(`${root}/navigation.json`,'utf8')),render=JSON.parse(readFileSync(`${root}/render.json`,'utf8'));
 for(const beat of render.logs){
  const log=JSON.parse(readFileSync(`${root}/${beat.name}.json`,'utf8')),last=log.at(-1),click=beat.requested.click;
  const path=findPath(geo.area.mask,log[0],{x:click[0],y:click[1]}),target=path.at(-1);
  rows.push({clip:`${scene}/${beat.name}`,walkingFrames:log.filter(r=>r.walking).length,target:{x:target.x,y:target.y},last:{x:last.x,y:last.y},shortfall:Math.hypot(last.x-target.x,last.y-target.y),arrival:log.findLast(r=>r.contact?.arrival)?.contact.arrival??null,requestedExit:beat.requested.exit??null,exitCompleted:beat.exitCompleted,object:beat.requested.object??null});
 }
}
writeFileSync('tmp/walkqa/verification-06/targets.json',JSON.stringify(rows,null,2));
