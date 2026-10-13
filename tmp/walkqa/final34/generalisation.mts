import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createRequire} from 'node:module';
const {generateWalkPlan}=await import(createRequire(process.cwd()+'/adventures/shadow-over-innsmouth/package.json').resolve('@anima/footfall/qa'));
import {loadWalkRecords} from '../../../adventures/shadow-over-innsmouth/scripts/walk-records.mts';
const root='tmp/walkqa/final34';
const results=[];
for(const name of ['rocky-beach','cramped-cellar','fog-graveyard']){
 const creation=JSON.parse(readFileSync(`${root}/${name}-creation.json`,'utf8'));
 const place=creation.response;
 // Failed records are deliberately not promoted to runnable scenes. Exercise the QA
 // empty-floor contract with the actual returned raster, retaining the thrown error.
 try{
  const scene=place.ground.ground==='failed'?{location:place.id,area:{mask:place.ground.floor},objects:[],interactables:[],exits:[]}:loadWalkRecords(place.id);
  const plan=generateWalkPlan(scene as any);
  mkdirSync(`${root}/plans/${name}`,{recursive:true});
  writeFileSync(`${root}/plans/${name}/plan.json`,JSON.stringify(plan,null,2));
  writeFileSync(`${root}/plans/${name}/navigation.json`,JSON.stringify(scene));
  results.push({name,id:place.id,ground:place.ground.ground,walks:plan.beats.length});
 }catch(error){results.push({name,id:place.id,ground:place.ground.ground,derivationFailure:place.ground.reason,planFailure:String(error),walks:0,simulation:'not runnable',reviewerChecks:'not runnable: no frame logs',browser:'not runnable',compositor:'not runnable'});}
}
writeFileSync(`${root}/generalisation.json`,JSON.stringify(results,null,2));console.log(results);
