import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { segment } from '../../api/src/services/occluders';
async function main(){
 const root=resolve('/Users/gorkolas/Developer/anima');
 const source=resolve(root,'adventures/shadow-over-innsmouth/public/generated/13d3201fecf81993b9d9fc2ba3ea8f492b5f6dc9e325271c7570999da5e8f387.png');
 const bytes=readFileSync(source),hash=createHash('sha256').update(bytes).digest('hex');
 const [w,h]=execFileSync('magick',['identify','-format','%w %h',source],{encoding:'utf8'}).split(' ').map(Number);
 const path=await segment(bytes,{name:'painted depot visible wooden floor',bounds:[.01,.65,.99,.99]},w,h);
 if(!path)throw new Error('Floor segmentation missing');
 const raster=execFileSync('magick',[path,'-resize','192x108!','-colorspace','gray','-threshold','50%','-depth','8','gray:-']);
 const result={mask:{width:192,height:108,data:Array.from(raster,v=>v>127?1:0)},source:path,brief:'07',reason:'Explicit segmentation of cached edited anchor; unchanged-pixel inheritance too sparse'};
 writeFileSync(resolve(root,'api/data/perception',hash+'.json'),JSON.stringify(result));
 console.log(JSON.stringify({hash,path,cells:result.mask.data.filter(Boolean).length}));
}
main().catch(e=>{console.error(e.message);process.exitCode=1});
