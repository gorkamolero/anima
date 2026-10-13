import {spawn} from 'node:child_process';
const env=Object.fromEntries(['PATH','HOME','TMPDIR','LANG','OPENROUTER_API_KEY'].filter(k=>process.env[k]).map(k=>[k,process.env[k]]));
Object.assign(env,{PORT:'4317',DERIVATION_BRIEF:'24',OPENAI_API_KEY:'',FAL_KEY:'',FAL_KEY_ID:'',FAL_KEY_SECRET:'',ELEVENLABS_API_KEY:''});
console.log('Generation providers disabled; OpenRouter',env.OPENROUTER_API_KEY?'available':'unavailable');
const child=spawn('pnpm',['--filter','@anima/api','exec','tsx','src/index.ts'],{env,stdio:'inherit'});
for(const sig of ['SIGINT','SIGTERM'])process.on(sig,()=>child.kill(sig));
child.on('exit',code=>process.exit(code??0));
