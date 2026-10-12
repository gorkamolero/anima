import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { segment } from '../../api/src/services/occluders';
const root=resolve('/Users/gorkolas/Developer/anima/adventures/shadow-over-innsmouth/public/generated');
// Boxes reviewed against the actual 1920x1080 source, not inherited old art.
const scenes=[{stem:'67c70f3cb8a7ab38f4a2b913e1edb3229b5f5527c0b12d575d27587889120354',objects:[{name:'lamp post',bounds:[1046/1920,346/1080,1129/1920,786/1080]}]}];
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
