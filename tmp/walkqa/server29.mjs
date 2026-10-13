import {spawn} from 'node:child_process';
import {resolve} from 'node:path';
const env=Object.fromEntries(['PATH','HOME','TMPDIR','LANG'].filter(k=>process.env[k]).map(k=>[k,process.env[k]]));
Object.assign(env,{PORT:'4317',DERIVATION_BRIEF:'29',OPENROUTER_API_KEY:'',OPENAI_API_KEY:'',FAL_KEY:'',FAL_KEY_ID:'',FAL_KEY_SECRET:'',ELEVENLABS_API_KEY:'',NODE_OPTIONS:`--import=${resolve('tmp/walkqa/network-guard27.mjs')}`});
const child=spawn('pnpm',['--filter','@anima/api','exec','tsx','src/index.ts'],{env,stdio:'inherit'});
for(const sig of ['SIGINT','SIGTERM'])process.on(sig,()=>child.kill(sig));
child.on('exit',code=>process.exit(code??0));
