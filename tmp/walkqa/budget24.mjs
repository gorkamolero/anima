import{readFileSync,writeFileSync,readdirSync,mkdirSync,existsSync}from'node:fs';import{homedir}from'node:os';
let pw;for(const d of readdirSync(homedir()+'/.npm/_npx')){try{pw=await import(homedir()+'/.npm/_npx/'+d+'/node_modules/playwright/index.mjs');break}catch{}}
const browser=await pw.chromium.launch({channel:'chromium',headless:true,args:['--use-angle=metal']});
try{for(const turn of [1.2]){
 const page=await browser.newPage({viewport:{width:1920,height:1080}});
 await page.route('**/footstepPlan.ts*',async route=>{const response=await route.fetch();const source=(await response.text()).replace('options.turnCost ?? 0.6','options.turnCost ?? '+turn);await route.fulfill({response,body:source})});
 await page.goto('http://localhost:8080/?mute=1&tuning=24');await page.waitForFunction(()=>window.__anima?.scene.world&&!window.__anima.scene.openWorldBusy);
 await page.evaluate(()=>window.__anima.captureFrame({stepMs:0,width:1920,format:'png'}));
 const results=[];
 for(const name of ['outside','inside','road','alley','pier','stepped-street','church','lobby','grocery','square']){
  const root='tmp/walkqa/harness-23/'+name,nav=JSON.parse(readFileSync(root+'/navigation.json')),plan=JSON.parse(readFileSync(root+'/plan.json'));
  await page.evaluate(async place=>{const a=window.__anima;let done=false,error;a.scene.enterLocation(place).then(()=>done=true).catch(e=>{done=true;error=String(e)});for(let i=0;!done&&i<1000;i++){a.step(100);await new Promise(r=>setTimeout(r,10))}if(!done||error)throw Error(error??'enter timeout')},nav.location);
  for(const b of plan.beats){
 if(!['outside/near-left','church/far-right','lobby/far-right','square/near-left'].includes(name+'/'+b.name))continue;
   const result=await page.evaluate(async b=>{const s=window.__anima.scene,m=s.hermesMotor;m.heading='right';m.place({x:b.start[0],y:b.start[1]});const start={...m.anchor},target={x:b.reachableTarget[0],y:b.reachableTarget[1]};const path=s.previewWalk(target.x,target.y).map(p=>({x:p.x,y:p.y}));const began=performance.now();m.goal=target;m.buildPlan({timeBudgetMs:30000,nodeBudget:2000000,turnCost:1.2});const planningMs=performance.now()-began,planned=m.snapshot().plan,rows=[];
    for(let i=0;i<2400;i++){m.update(1000/24);rows.push({t:i/24,x:m.target.x,y:m.target.y,scale:m.scale,heading:m.heading,contact:m.snapshot(),walking:m.walking,anchor:{...m.anchor}});if(!m.walking)break}
    return {name:b.name,start,target,path,planningMs,planned,arrival:m.arrival,rows};
   },b);result.scene=name;result.turnCost=turn;results.push(result);
  }
  mkdirSync('tmp/walkqa/harness-24/extended-budget',{recursive:true});writeFileSync('tmp/walkqa/harness-24/extended-budget/turn-'+turn+'.json',JSON.stringify(results));console.log(turn,name,results.length);
 }
 await page.close();
}}finally{await browser.close()}
