import {spawnSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
const failuresOnly=process.argv.includes('--failures');
const crossingsOnly=process.argv.includes('--crossings');
const objectsOnly=process.argv.includes('--objects');
const session=objectsOnly?'track1-objects':crossingsOnly?'track1-crossings':failuresOnly?'track1-failures':'track1', out='tmp/overnight/reports';
const run=(args,input)=>{const r=spawnSync('agent-browser',['--session',session,...args],{input,encoding:'utf8',maxBuffer:64*1024*1024});if(r.status)throw Error(r.stderr||r.stdout);return r.stdout.trim()};
const ev=s=>JSON.parse(run(['eval','--stdin'],s));
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const scenes=['outside','inside',...(await(await fetch('http://localhost:3001/api/places')).json()).map(p=>p.id)];
const selected=process.argv.find(a=>a.startsWith('--scenes='))?.slice(9).split(',')??scenes;
mkdirSync(`${out}/scale`,{recursive:true});
run(['network','route','**/api/narrate','--body',JSON.stringify({options:['QA disabled','QA disabled','QA disabled']})]);
for(const id of selected){
 const file=`${out}/${id}${objectsOnly?"-objects":crossingsOnly?"-crossings":failuresOnly?"-failures":""}-live.json`;
 if(process.argv.includes('--resume')&&existsSync(file))continue;
 try{
 run(['open',`http://localhost:8080/?scene=${id}&mute=1`]);
 for(let i=0;i<120;i++){if(ev(`(()=>{window.__anima?.step(100);return Boolean(window.__anima?.scene?.geometryReady && !window.__anima.scene.openWorldBusy)})()`))break;await sleep(500);}
 ev(`(()=>{const s=window.__anima.scene;window.track1Load=false;void s.enterLocation(${JSON.stringify(id)}).then(()=>window.track1Load=true);return true})()`);
 for(let i=0;i<120;i++){if(ev('(()=>{window.__anima.step(100);return window.track1Load && window.__anima.scene.geometryReady})()'))break;await sleep(500);}
 const plan=JSON.parse(readFileSync(`tmp/overnight/sim/${id}/plan.json`));
 if(failuresOnly)plan.beats=plan.beats.filter(b=>b.coverageFailure || (b.exit&&!b.expectedDestination) || (id==='place-a53d08124ed6c715c32e'&&b.object==='clouds'));
 if(crossingsOnly)plan.beats=plan.beats.filter(b=>b.name.startsWith("occluder-"));
 if(objectsOnly)plan.beats=plan.beats.filter(b=>b.object);
 if(!plan.beats.length)continue;
 // Use a short real recording for each scene's most demanding crossing; full
 // route/exit/object assertions execute at the real render clock below.
 const result=ev(`(()=>{const s=window.__anima.scene;window.track1={results:[],done:false};
 const originalFetch=s.fetchOptions,originalResolve=s.resolveNarration,originalTrigger=s.triggerExit;
 s.fetchOptions=async()=>['QA: narration disabled','QA: narration disabled','QA: narration disabled'];
 s.resolveNarration=async()=>{throw Error('Unconnected exit: generation outside five-place budget')};
 s.triggerExit=async function(e){window.track1.events.push({id:e.id,to:e.to,from:s.locationId()});return originalTrigger.call(this,e)};
 window.track1.task=(async()=>{const wait=ms=>new Promise(r=>setTimeout(r,ms));
 const load=async id=>{let done=false,failure;void s.enterLocation(id).then(()=>done=true).catch(e=>{failure=e;done=true});for(let i=0;i<3000&&!done;i++){window.__anima.step(100);await wait(10);}if(failure)throw failure;if(!done)throw Error('Location load timeout');};
 for(const b of ${JSON.stringify(plan.beats)}){
 if(s.locationId()!==${JSON.stringify(id)}){await load(${JSON.stringify(id)});}
 for(let i=0;i<400&&(s.openWorldBusy||s.arrivingExit||s.inputBlocked||!s.geometryReady);i++){window.__anima.step(100);await wait(10);}
 s.hermesMotor.place({x:b.start[0],y:b.start[1]});s.exitLatch=undefined;s.requestedExit=undefined;
 window.track1.events=[];let completed=false,error;
 const object=b.object?s.interactables.find(o=>o.name===b.object):null;
 const goal=object?null:s.previewWalk(...(s.sceneExits.find(e=>e.id===b.exit)?.approach?Object.values(s.sceneExits.find(e=>e.id===b.exit).approach):b.click)).at(-1);
 const started=performance.now();
 const walk=()=>{Promise.resolve(object?s.approachObject(object,b.click[0]):s.walkGenerated(...b.click)).then(()=>completed=true).catch(e=>{error=String(e);completed=true})};
 let clip;const audit=[];
 const onRender=()=>{const m=s.hermesMotor,h=s.hermesSprite,o=s.objectLayers.find(l=>l.data.id===b.occluder);if(!m)return;
 const q=m.snapshot();const list=s.children.getAll();let overlap=false,baseline;
 if(o){const a=h.getBounds(),v=o.image.getBounds();overlap=a.x<v.x+v.width&&a.x+a.width>v.x&&a.y<v.y+v.height&&a.y+a.height>v.y;
 const points=[...o.data.baseline].sort((a,b)=>a.x-b.x);let i=points.findIndex(p=>p.x>=m.anchor.x);if(i<=0)baseline=points[i===0?0:points.length-1]?.y;else{const a=points[i-1],z=points[i];baseline=a.y+(z.y-a.y)*(m.anchor.x-a.x)/(z.x-a.x);}}
 audit.push({t:performance.now(),delta:window.game.loop.delta,walking:m.walking,ground:q.ground,speed:q.speedMetresPerSecond,anchor:{...m.anchor},heading:q.heading,overlap,baseline,characterIndex:list.indexOf(h),occluderIndex:o?list.indexOf(o.image):-1});};
 if(${failuresOnly || crossingsOnly} || b.name==='occluder-behind'){
 clip='track1-'+${JSON.stringify(id)}+(${crossingsOnly}?'-largest-'+b.name:${failuresOnly}?'-'+b.name:'');window.game.loop.resetDelta();window.game.events.on("postrender",onRender);try{await window.__anima.record({name:clip,ms:6000,action:walk});}finally{window.game.events.off("postrender",onRender);}
 }else walk();
 for(let i=0;i<600&&(!completed||s.openWorldBusy||s.arrivingExit);i++){window.__anima.step(1000);await wait(10);}
 window.track1.results.push({beat:b,goal,completed,error,ms:performance.now()-started,location:s.locationId(),motor:s.hermesMotor.snapshot(),events:[...window.track1.events],clip,audit});
 if(!completed){s.hermesMotor.stop();s.inputBlocked=false;}
 }
 window.track1.done=true;
 })().catch(e=>{window.track1.error=String(e);window.track1.done=true}).finally(()=>{s.fetchOptions=originalFetch;s.resolveNarration=originalResolve;s.triggerExit=originalTrigger});return true})()`);
 for(let i=0;i<1800;i++){const r=ev('({done:window.track1?.done,error:window.track1?.error,count:window.track1?.results.length})');if(r.done)break;if(i%30===0)console.log(id,JSON.stringify(r));await sleep(1000);}
 const results=ev('({done:window.track1.done,error:window.track1.error,results:window.track1.results})');
 writeFileSync(file,JSON.stringify(results,null,2));
 console.log('COMPLETE',id,results.results.length,results.error??'');
 }catch(e){writeFileSync(file,JSON.stringify({error:String(e)}));console.log('ERROR',id,String(e));}
}
