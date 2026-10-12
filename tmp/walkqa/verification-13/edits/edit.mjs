import {fal} from '../../../../packages/sprite-tools/node_modules/@fal-ai/client/src/index.js';
import {readFile,writeFile,appendFile,access} from 'node:fs/promises';
const dir='tmp/walkqa/verification-13/edits';
const view=process.argv[2], attempt=Number(process.argv[3]||1);
if(!['side','away','away-right','toward','toward-right'].includes(view)||![1,2].includes(attempt))throw Error('Invalid edit');
const stem=`${dir}/${view}-${attempt}`;
try {await access(stem+'.manifest.json');throw Error('Attempt already recorded; inspect it before resuming');}catch(e){if(e.code!=='ENOENT')throw e;}
if(!process.env.FAL_KEY)throw Error('FAL_KEY missing');
fal.config({credentials:process.env.FAL_KEY});
const selection=JSON.parse(await readFile(`${dir}/selection.json`,'utf8'));
const [walk,frame]=selection[view];
const meta=JSON.parse(await readFile(`adventures/shadow-over-innsmouth/public/assets/sprites/hermes/${walk}.json`,'utf8'));
const contact=meta.contacts[frame],sole=contact[contact.planted];
const prompt='Edit this exact walk frame into one standing sprite. Same character, same framing, same camera, same scale and position. He has stopped walking and stands still with both feet flat on the ground, weight even, arms relaxed at his sides. Keep head, torso, satchel, face and clothes identical; change only the legs and feet, and the arms if needed. Preserve the head and torso at their EXACT pixel coordinates and size. Preserve the planted shoe at its current position; bring the lifted shoe down beside it. Do not recenter, enlarge, straighten or redraw the upper body. Preserve the glasses, face, hair, jacket, and the bag on the same side. Keep the entire 612 by 1059 canvas and flat uniform #828282 grey background, no ground shadow, no cropping, no text.'+(attempt===2?' STRICT CORRECTION: copy all pixels above the hips unchanged, including both arms and hands in their exact original positions. The arms are already relaxed enough; DO NOT change them. Absolutely no repositioning or redrawing of the head, hair, glasses, torso or satchel. Preserve the entire planted shoe and its leg unchanged. Only lower the other raised foot to the floor beside it. This is a local single-leg-only edit, not a new drawing.':'');
const freeTarget=view==='away'?' Place the lowered left shoe sole near (296,1012), slightly behind the unchanged right shoe, on the same ground plane.':view==='away-right'?' Place the lowered left shoe sole near (303,1020), close beside and slightly behind the unchanged right shoe.':'';
const exactPrompt=prompt+freeTarget+` The planted sole landmark is at x=${Math.round(sole.x)}, y=${Math.round(sole.y)} on the 612x1059 input. Keep that shoe's shape, position and orientation exactly unchanged. Do not move it to make the stance symmetrical.`;
const input={prompt:exactPrompt,image_urls:['data:image/png;base64,'+(await readFile(`${dir}/${view}-input.png`)).toString('base64')],aspect_ratio:'auto',resolution:'1K',num_images:1,output_format:'png',limit_generations:true};
const manifest={model:'fal-ai/nano-banana-2/edit',view,attempt,source:`${view}-input.png`,prompt:exactPrompt,parameters:{...input,image_urls:undefined},submitted:new Date().toISOString()};
await writeFile(stem+'.manifest.json',JSON.stringify(manifest,null,2));
try {
 const r=await fal.subscribe(manifest.model,{input,onEnqueue:async id=>{manifest.requestId=id;await writeFile(stem+'.manifest.json',JSON.stringify(manifest,null,2));}});
 manifest.requestId=r.requestId;
 const response=await fetch(r.data.images[0].url);if(!response.ok)throw Error('Download '+response.status);
 await writeFile(stem+'.png',new Uint8Array(await response.arrayBuffer()));manifest.completed=new Date().toISOString();
 await writeFile(stem+'.manifest.json',JSON.stringify(manifest,null,2));console.log(view,attempt,'completed',r.requestId);
}catch(e){manifest.error=e.message;await writeFile(stem+'.manifest.json',JSON.stringify(manifest,null,2));console.error(e.message);process.exitCode=1;}
