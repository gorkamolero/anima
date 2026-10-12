import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { getWorldDb } from '../../../api/src/services/world.js';
import { calibrateGround, referenceLandmark } from '../../../api/src/services/ground-calibration.js';
const root=resolve('tmp/walkqa/verification-16b');
const previous=JSON.parse(await readFile(resolve(root,'places-before.json'),'utf8')).find((p:any)=>p.id==='place-96acfd3d8faaf8f903fe');
const measured=JSON.parse(await readFile(resolve(root,'door-reference.json'),'utf8'));
const reference={label:measured.label,rect:measured.rect,realHeightM:measured.realHeightM};
const calibration=calibrateGround({horizonY:measured.horizonY,referenceFootY:0.62,referenceHeight:0.45,scaleReference:reference});
const place=structuredClone(previous);const g=place.ground;
g.horizonY=calibration.horizonY;g.scaleSlope=calibration.slope;g.scaleReference=reference;
g.walkArea.perspective.horizonY=g.horizonY;g.walkArea.perspective.slope=g.scaleSlope;
g.walkArea.scaleClamp.max=Math.max(1.5,(g.freeWalkBounds.maxY-g.horizonY)*g.scaleSlope);
for(const point of g.groundLine.points)point.scaleFactor=Math.max(0.05,(point.y-g.horizonY)*g.scaleSlope);
// The visible pier is planar. Replace saturated depth samples with the measured plane.
for(const region of g.regions??[])for(const p of region.scaleAtY)p.scaleFactor=Math.max(0.18,(p.y-g.horizonY)*g.scaleSlope);
g.notes=[...(g.notes??[]),'Brief 16b: scale derived from visible hut door and sea horizon; previous imagined adult and synthetic landmark rejected. Floor unchanged. Reference localized by assistant, not unattended provider detection.'];
const path=resolve('adventures/shadow-over-innsmouth/public',place.background.slice(1).replace(/\.png$/,'.landmarks.json'));
const before=JSON.parse(await readFile(path,'utf8'));
// Original landmarks are retained by the first run; replay uses the immutable evidence.
if (!process.argv.includes('--replay')) await writeFile(resolve(root,'pier-landmarks-before.json'),JSON.stringify(before,null,2));
const landmarks={image:place.background.split('/').at(-1),space:'game',template:place.template,horizonY:g.horizonY,figureCalibration:1,landmarks:[referenceLandmark(reference)]};
await writeFile(resolve(root,'pier-after.json'),JSON.stringify(place,null,2));
await writeFile(resolve(root,'pier-landmarks-after.json'),JSON.stringify(landmarks,null,2));
await (await getWorldDb()).execute({sql:'UPDATE places SET data=? WHERE id=?',args:[JSON.stringify(place),place.id]});
await writeFile(path,JSON.stringify(landmarks,null,2));
console.log(JSON.stringify({before:{horizonY:previous.ground.horizonY,slope:previous.ground.scaleSlope},after:calibration,predictedAt918:1059*0.5*(918-g.horizonY)*g.scaleSlope},null,2));
