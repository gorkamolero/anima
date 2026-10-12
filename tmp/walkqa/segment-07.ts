import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { segment } from '../../api/src/services/occluders';
const root=resolve('/Users/gorkolas/Developer/anima/adventures/shadow-over-innsmouth/public/backgrounds');
// Boxes reviewed against the actual 1920x1080 source, not inherited old art.
const scenes=[
 {stem:'bus-station-kat-seated-composite-v1', objects:[
  {name:'Fishing net pile',bounds:[1130/1920,625/1080,1445/1920,856/1080]},
  {name:'Left fishing net pile',bounds:[424/1920,690/1080,866/1920,896/1080]},
  {name:'Bench',bounds:[792/1920,625/1080,1208/1920,892/1080]},
  {name:'Pergola',bounds:[605/1920,223/1080,1298/1920,866/1080]},
 ]},
 {stem:'arkham-bus-depot-flat-2d',objects:[
  {name:'bench',bounds:[899/1920,610/1080,1420/1920,862/1080]},
 ]}
];
async function main(){
for(const scene of scenes){
 const path=resolve(root,scene.stem+'.png'),bytes=readFileSync(path);
 const [w,h]=execFileSync('magick',['identify','-format','%w %h',path],{encoding:'utf8'}).split(' ').map(Number);
 for(const object of scene.objects){const mask=await segment(bytes,object,w,h);console.log(JSON.stringify({scene:scene.stem,object:object.name,mask}));}
 const labelsPath=resolve(root,scene.stem+'.interactables.json');
 const labels=JSON.parse(readFileSync(labelsPath,'utf8'));
 for(const object of scene.objects){const i=labels.interactables.findIndex((v:any)=>v.name===object.name);if(i>=0)labels.interactables[i]=object;else labels.interactables.push(object);}
 writeFileSync(labelsPath,JSON.stringify(labels,null,'\t')+'\n');
}

}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
