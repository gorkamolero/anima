import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {replaceReviewedPlace,placesRoutes} from '../../api/src/routes/places.ts';
import {groundOverlay} from '../../api/src/services/ground-overlay.ts';
process.chdir(new URL('../..',import.meta.url).pathname);
for(const key of ['road','alley']) {
 const candidate=JSON.parse(await readFile(`tmp/walkqa/derivation/${key}-04c-candidate.json`,'utf8'));
 const diagnostic=JSON.parse(await readFile(`tmp/walkqa/verification-04c/place-04c-${key}-review.json`,'utf8'));
 if(JSON.stringify(candidate.ground.floor)!==JSON.stringify(diagnostic.ground.floor))throw Error('Candidate differs from reviewed playback');
 const judged=JSON.parse(await readFile(`tmp/walkqa/derivation/${key}-04c-judged.json`,'utf8'));
 const overlay=`tmp/walkqa/derivation/${key}-04c-candidate-overlay.png`;
 candidate.ground.ground='derived';
 candidate.ground.verdicts=judged.ground.verdicts;
 candidate.ground.notes=[...(candidate.ground.notes??[]),'Reviewer approved 04c floor on 2026-10-12 (Brief 08); global obstacle P=1 disagrees with focused excluded-object answers.'];
 await replaceReviewedPlace(candidate.id,candidate,{approvedBy:'reviewer',date:'2026-10-12',overlay,judgeDisagreement:judged.ground.verdicts});
 const response=await placesRoutes.request(`http://localhost/places/${candidate.id}`);
 const stored=await response.json();
 if(response.status!==200 || JSON.stringify(stored.ground.floor)!==JSON.stringify(candidate.ground.floor))throw Error('Stored floor mismatch');
 const fresh=await groundOverlay(stored.background,stored.ground,`${key}-08-installed`);
 await writeFile(`tmp/walkqa/verification-08/${key}-installed.json`,JSON.stringify({id:stored.id,status:response.status,floorMatches:true,floorSha256:createHash('sha256').update(JSON.stringify(stored.ground.floor)).digest('hex'),approvedOverlay:overlay,storedOverlay:fresh,place:stored},null,2));
 console.log(key,stored.id,response.status,fresh);
}
