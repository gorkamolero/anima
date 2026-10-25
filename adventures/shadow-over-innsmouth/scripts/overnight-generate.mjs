import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
const out='tmp/overnight/reports';mkdirSync(out,{recursive:true});
const ledger=()=>readFileSync('api/data/calls.jsonl','utf8').trim().split('\n').filter(Boolean).map(l=>JSON.parse(l));
const start=ledger().length;
const requests=[
 ['alley','exterior','I go down the alley behind the old chandlery. A narrow foggy New England alley, damp cobbles, a normal two metre door, barrels and a bench.'],
 ['church','interior','I enter the church. A decaying New England church nave, a central walkable aisle, wooden pews, a visible two metre entrance door and stone pillars.'],
 ['pier','exterior','I walk onto the fishing pier. A wooden fishing pier, mooring posts, rope coils, a small hut with a two metre door and open water beyond.'],
 ['square','exterior','I enter the old market square. A cobbled town square with a fountain, benches with seats 0.45 metres high, ordinary shop doors and broad walking routes.'],
 ['cellar','interior','I descend into the cellar. A damp stone cellar, wooden barrels and crates, a visible two metre door, clear floor between the stored objects.'],
];
const results=[];
for(const [kind,template,description] of requests){
 const request={parent:'outside',to:`24 October Track 1 unseen ${kind}`,template,description};
 const before=ledger().length;const began=Date.now();
 try{const response=await fetch('http://localhost:3001/api/places',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(request)});const value=await response.json();
 results.push({kind,request,status:response.status,ms:Date.now()-began,id:value.id,ground:value.ground?.ground,error:value.error??value.ground?.reason,calls:ledger().slice(before).map(({kind,ms,cached})=>({kind,ms,cached}))});
 writeFileSync(`${out}/new-${kind}.json`,JSON.stringify(value,null,2));console.log(kind,response.status,value.id,value.ground?.ground,value.error??'');
 }catch(e){results.push({kind,request,error:String(e)});console.log(kind,String(e));}
 const calls=ledger().slice(start).map(({kind,ms,cached})=>({kind,ms,cached}));
 writeFileSync(`${out}/generation.json`,JSON.stringify({results,calls,note:'Ledger delta during each pipeline request; concurrent projects may also append. Attempt reservations and completed calls are separate.'},null,2));
}
