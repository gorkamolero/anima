import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { getWorldDb } from '../../api/src/services/world.ts';
import { getPlace } from '../../api/src/routes/places.ts';
import { imagePath, ROOT, ANCHORS } from '../../api/src/lib/backgrounds.ts';
import { classifyOccluder } from '../../packages/engine/src/occlusion/occlusion.ts';
import { excludeUnscaledStairs } from '../../api/src/services/ground-repair.ts';
import { groundOverlay } from '../../api/src/services/ground-overlay.ts';
process.chdir(ROOT);
const out='tmp/walkqa/harness-21/derivation'; await mkdir(out,{recursive:true});
const corpus=JSON.parse(await readFile('tmp/walkqa/corpus-places.json','utf8'));
const scenes={outside:'outside',inside:'inside',road:'place-f2d0a7f7f76225002663',alley:'place-2635d8cd03bce818a634',...Object.fromEntries(Object.entries(corpus).map(([k,v]:any)=>[k,v.id]))};
const audit=[];
for(const [name,id] of Object.entries(scenes)){
 const place=id.startsWith('place-')?await getPlace(id):undefined;
 const nav=JSON.parse(await readFile(`tmp/walkqa/harness-20/${name}/navigation.json`,'utf8'));
 const source=imagePath(place?.background??ANCHORS[id]),stem=source.replace(/\.png$/,'');
 const stored=await readFile(stem+'.ground.json','utf8').catch(()=>null);
 const ground=place?.ground??(stored?JSON.parse(stored):{floor:nav.area.rawMask??nav.area.mask,walkArea:nav.area,horizonY:nav.area.perspective.horizonY,scaleSlope:nav.area.perspective.slope,groundLine:{points:[]}});
 const before=JSON.parse(JSON.stringify(ground));
 const objects=JSON.parse(await readFile(stem+'.occluders.json','utf8'));
 const classified=objects.map(o=>classifyOccluder(o,nav.area.perspective));
 const stairs=ground.regions?.filter(r=>r.kind==='stairs');
 if(stairs?.length){const grid=ground.floor;const mask={...grid,data:grid.data.map((_,i)=>stairs.some(r=>{const x=(i%grid.width+.5)*r.mask.width/grid.width,y=(Math.floor(i/grid.width)+.5)*r.mask.height/grid.height;return r.mask.data[Math.floor(y)*r.mask.width+Math.floor(x)]})?1:0)};excludeUnscaledStairs(ground,mask);}
 const exits=JSON.parse(await readFile(stem+'.exits.json','utf8'));
 const overlay=await groundOverlay(place?.background??ANCHORS[id],ground,'brief21-'+name,classified,exits);
 await writeFile(resolve(out,name+'.json'),JSON.stringify({before,after:ground,objects,classified,overlay},null,2));
 await writeFile(stem+'.occluders.json',JSON.stringify(classified,null,'\t')+'\n');
 if(place){place.ground=ground;await(await getWorldDb()).execute({sql:'UPDATE places SET data=? WHERE id=?',args:[JSON.stringify(place),id]});}
 else if(stored) await writeFile(stem+'.ground.json',JSON.stringify(ground,null,'\t')+'\n');
 audit.push({name,overlay,decals:classified.filter(o=>o.floorDecal).map(o=>({id:o.id,height:o.heightMetres,obstacle:o.obstacle})),removedStairCells:before.floor.data.filter(Boolean).length-ground.floor.data.filter(Boolean).length});
}
await writeFile(out+'/summary.json',JSON.stringify(audit,null,2));console.log(audit);
