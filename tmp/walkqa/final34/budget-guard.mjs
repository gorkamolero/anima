// Evidence runner only: cap outgoing paid queue submissions, without altering derivation.
import {appendFileSync, existsSync, readFileSync} from 'node:fs';
import {resolve} from 'node:path';
const ledger=resolve(process.env.BRIEF34_ROOT,'provider-attempts.jsonl');
const prior=existsSync(ledger)?readFileSync(ledger,'utf8').trim().split('\n').filter(Boolean).map(JSON.parse):[];
const count={image:prior.filter(x=>x.kind==='image').length,geometry:prior.filter(x=>x.kind==='geometry').length};
const original=globalThis.fetch;
globalThis.fetch=async function(input,init){
 const u=new URL(typeof input==='object'&&'url' in input?input.url:input);
 const method=(init?.method??input?.method??'GET').toUpperCase();
 if(u.hostname==='queue.fal.run'&&method==='POST'&&!u.pathname.includes('/requests/')){
  const kind=/nano-banana.*\/edit/.test(u.pathname)?'image':/sam|depth/.test(u.pathname)?'geometry':'forbidden';
  if(kind==='forbidden'||count[kind]>=(kind==='image'?3:40))throw Error('Brief 34 paid-call budget stop: '+kind);
  count[kind]++;
  appendFileSync(ledger,JSON.stringify({at:new Date().toISOString(),kind,model:u.pathname,attempt:count[kind]})+'\n');
 }
 return original(input,init);
};
