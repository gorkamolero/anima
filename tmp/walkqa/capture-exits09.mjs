import {spawnSync} from 'node:child_process';import{readFileSync,writeFileSync,mkdirSync}from'node:fs';
const groups=[['outside-left','outside-right'],['road-left','road-left-1','road-left-2'],['road-far','alley-far','depot-door']];const group=Number(process.argv[2]);
for(const name of groups[group]){
 const plan=name.startsWith('road-left')?'tmp/walkqa/verification-09/'+name+'-plan.json':'tmp/walkqa/exits-08/'+name+'/plan.json';
 const r=spawnSync('node',['adventures/shadow-over-innsmouth/scripts/render-walk.mjs','--plan='+plan,'--out=tmp/walkqa/proof-09/exits/'+name,'--session=brief09-proof-'+group,'--retain-failures'],{encoding:'utf8',maxBuffer:1e7});
 console.log(name,r.status,r.stdout,r.stderr);if(r.status)process.exit(r.status);
}
