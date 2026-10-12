import {fal} from '../../packages/sprite-tools/node_modules/@fal-ai/client/src/index.js';
import {readFile,writeFile,appendFile,access} from 'node:fs/promises';
const [kind,view]=process.argv.slice(2),dir='tmp/hermes-depth-06';
if(!['video','bria'].includes(kind)||!['away','toward'].includes(view))throw Error('Invalid arguments');
const output=`${dir}/${view}-${kind}.${kind==='edit'?'png':kind==='video'?'mp4':'webm'}`;
try{await access(output);console.log('Already exists '+output);process.exit(0)}catch{}
if(!process.env.FAL_KEY)throw Error('Missing FAL_KEY');
fal.config({credentials:process.env.FAL_KEY});
const ledger='tmp/walkqa/calls.md',text=(await readFile(ledger,'utf8')).split('# Brief 06 paid-call ledger')[1];
if((text.match(new RegExp(`\\| ${kind} \\|`,'g'))||[]).length>=2)throw Error('Call limit');
async function upload(p,type){return fal.storage.upload(new Blob([await readFile(p)],{type}));}
let model,input;
if(kind==='edit'){
 model='fal-ai/nano-banana-2/edit';
 const source=JSON.parse(await readFile('adventures/shadow-over-innsmouth/public/assets/sprites/hermes/hermes-walk-away.manifest.json','utf8')).keyframe;
 const prompt=source.prompt.replace('Perfectly straight BACK VIEW, looking directly away from camera, back of head and jacket visible, NO face visible, glasses only temples near ears.', view==='away-right'?'THREE-QUARTER BACK VIEW, facing diagonally away and toward SCREEN RIGHT at 45 degrees. Back and right-facing profile visible, face mostly hidden. Both shoes point diagonally toward screen right and away.':'THREE-QUARTER FRONT VIEW FACING RIGHT. CRITICAL: his nose must point to the RIGHT EDGE of the image, never left. We see the front of his chest and the left side of his face, his left ear is visible on the LEFT side of his head. Rotate his entire body toward the RIGHT SIDE OF THE IMAGE by 45 degrees from straight front view. His LEFT hip satchel appears on SCREEN LEFT. BOTH shoe toes point toward the lower RIGHT corner of the image. Face and front of jacket visible. Do not copy the facing direction of the reference images. He is about to walk diagonally toward the viewer and toward SCREEN RIGHT.');
 const urls=[];for(const ref of source.references)urls.push(await upload(ref,ref.endsWith('jpeg')?'image/jpeg':'image/png'));
 input={prompt,image_urls:urls,aspect_ratio:'9:16',num_images:1,output_format:'png',limit_generations:true};
}else if(kind==='video'){
 model='fal-ai/kling-video/v3/standard/image-to-video';
 input={start_image_url:await upload(`adventures/shadow-over-innsmouth/public/assets/sprites/hermes/hermes-${view}-keyframe.png`,'image/png'),duration:'5',generate_audio:false,prompt:`This exact character walks ${view==='away'?'directly away from the camera, perfectly straight BACK VIEW':'directly toward the camera, perfectly straight FRONT VIEW'} throughout. Walking IN PLACE for a looping adventure game sprite. Camera tracks with him at exactly his walking speed, so his body stays centered and the SAME SIZE throughout, no shrinking, no enlargement, no drift. Walking in place with long confident strides. Exaggerated long forward and backward leg extension, clear deep heel-to-toe steps, soles travel a long distance in the image. Brisk purposeful adult walk, about two steps per second, never tiny shuffling steps. Camera slightly elevated so the long depth strides are visible. Alternating planted steps, arms swing in opposition, subtle body bob. Full body and shoes always visible, generous margins. Preserve exact orientation, character identity, clothes, satchel, proportions and painterly linework. Never turn, rotate or change direction. Flat uniform gray background, no floor line, no cast shadows, no props or scene. Silent.`,negative_prompt:'cropped feet, turning, rotation, sliding, drifting, shrinking, growing, zoom, running, slow motion, change of view, moving across frame, scene, shadows'};
}else{
 model='bria/video/background-removal';input={video_url:await upload(`${dir}/${view}-video.mp4`,'video/mp4'),background_color:'Transparent',output_container_and_codec:'webm_vp9',preserve_audio:false};
}
await appendFile(ledger,`| ${kind} | ${model} | ${view} | submission attempted ${new Date().toISOString()} |\n`);
const pending=`${output}.request.json`;
try{
 const q=await fal.queue.submit(model,{input});
 await writeFile(pending,JSON.stringify({model,input,requestId:q.request_id,output},null,2));
 console.log('Queued',kind,view,q.request_id);
 await appendFile(ledger,`  Request ${q.request_id} (${view}, ${kind}).\n`);
 await fal.queue.subscribeToStatus(model,{requestId:q.request_id,logs:false});
 const r=await fal.queue.result(model,{requestId:q.request_id});
 const url=kind==='edit'?r.data.images[0].url:r.data.video?.url||r.data.url;
 const resp=await fetch(url);if(!resp.ok)throw Error('Download failed');
 await writeFile(output,new Uint8Array(await resp.arrayBuffer()));
 await writeFile(`${output}.manifest.json`,JSON.stringify({model,input,requestId:q.request_id,output},null,2));
 console.log('Saved',output);await appendFile(ledger,`  Completed ${q.request_id}: ${output}\n`);
}catch(e){console.error('Generation failed',e.message);await appendFile(ledger,`  Failed ${kind} ${view}: ${e.message}\n`);process.exitCode=1;}
