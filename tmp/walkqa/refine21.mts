import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { refineCachedOccluders } from '../../api/src/services/occluders.ts';
import { getPlace } from '../../api/src/routes/places.ts';
import { ANCHORS, ROOT } from '../../api/src/lib/backgrounds.ts';
import { groundOverlay } from '../../api/src/services/ground-overlay.ts';
process.chdir(ROOT);const corpus=JSON.parse(await readFile('tmp/walkqa/corpus-places.json','utf8'));
const scenes={outside:'outside',inside:'inside',road:'place-f2d0a7f7f76225002663',alley:'place-2635d8cd03bce818a634',...Object.fromEntries(Object.entries(corpus).map(([k,v]:any)=>[k,v.id]))};
const summary=[];
for(const [name,id] of Object.entries(scenes)){
 const nav=JSON.parse(await readFile(`tmp/walkqa/harness-20/${name}/navigation.json`,'utf8'));
 const place=id.startsWith('place-')?await getPlace(id):undefined;
 const image=place?.background??ANCHORS[id];
 const layers=await refineCachedOccluders(image,nav.area.perspective);
 const prior=JSON.parse(await readFile(`tmp/walkqa/harness-21/derivation/${name}.json`,'utf8'));
 const overlay=await groundOverlay(image,prior.after,'brief21-refined-'+name,layers,nav.exits);
 const info={name,layers,overlay};summary.push(info);await writeFile(`tmp/walkqa/harness-21/derivation/${name}-layers.json`,JSON.stringify(info,null,2));
 console.log(name,layers.length,layers.filter(o=>o.floorDecal).length);
}
await writeFile('tmp/walkqa/harness-21/derivation/layer-summary.json',JSON.stringify(summary,null,2));
