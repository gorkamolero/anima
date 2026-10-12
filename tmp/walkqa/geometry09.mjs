import {spawnSync} from 'node:child_process';import{mkdirSync,writeFileSync}from'node:fs';
const e=s=>{const r=spawnSync('agent-browser',['--session','brief09','eval','--stdin'],{input:s,encoding:'utf8',maxBuffer:30e6});if(r.status)throw Error(r.stderr||r.stdout);return JSON.parse(r.stdout)};
for(const [name,place] of [['road','place-f2d0a7f7f76225002663'],['alley','place-2635d8cd03bce818a634'],['depot-outside','outside'],['depot-inside','inside'],['outskirts','place-395743b437774b879679'],['quay','place-2a19481aac649a2e69f1'],['far-alley','place-aa7dd184a5f30fbc1f89']]){
 e(`(()=>{window.__ready=false;window.__anima.scene.enterLocation(${JSON.stringify(place)}).then(()=>window.__ready=true);return true})()`);
 for(let i=0;i<600;i++){if(e('(()=>{window.__anima.step(100);return window.__ready})()'))break;await new Promise(r=>setTimeout(r,100));}
 const d=JSON.parse(e('JSON.stringify({area:window.__anima.scene.walkArea,location:window.__anima.scene.locationId(),exits:window.__anima.scene.sceneExits,objects:window.__anima.scene.objectLayers.map(l=>l.data)})'));
 const dir='tmp/walkqa/geometry-final-09/'+name;mkdirSync(dir,{recursive:true});writeFileSync(dir+'/navigation.json',JSON.stringify(d));console.log(name);
}
