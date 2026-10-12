import sys,json,importlib.util,statistics,shutil
from pathlib import Path
from PIL import Image
import numpy as np
root=Path.cwd();v=sys.argv[1];p=root/'adventures/shadow-over-innsmouth/public/assets/sprites/hermes';d=root/'tmp/hermes-depth-06';name=f'hermes-walk-{v}';base=p/name
spec=importlib.util.spec_from_file_location('factory',root/'packages/sprite-tools/scripts/sprite-factory.py');factory=importlib.util.module_from_spec(spec);spec.loader.exec_module(factory)
# Quantify visible height with robust alpha (>127) to exclude the old sheet's faint fringe.
def bounds(im): return im.getchannel('A').point(lambda a:255 if a>127 else 0).getbbox()
def sheet_frames(path):
 m=json.loads(path.with_suffix('.json').read_text());im=Image.open(path.with_suffix('.png')).convert('RGBA');return [im.crop(((i%m['cols'])*m['frameWidth'],(i//m['cols'])*m['frameHeight'],(i%m['cols']+1)*m['frameWidth'],(i//m['cols']+1)*m['frameHeight'])) for i in range(m['frameCount'])]
ref=sheet_frames(p/'hermes-fal-veo-transparent-loop');idle=sheet_frames(p/'hermes-idle-v2-normalized');frames=[Image.open(f).convert('RGBA') for f in sorted((d/v/'raw').glob('frame-*.png'))]; loop=json.loads((d/v/'loop-detection.json').read_text());frames=frames[loop['start_frame']:loop['end_frame']]
refheights=[bounds(i)[3]-bounds(i)[1] for i in ref]; idleheights=[bounds(i)[3]-bounds(i)[1] for i in idle];heights=[bounds(i)[3]-bounds(i)[1] for i in frames]; target=statistics.median(refheights);factor=target/statistics.median(heights)
result=[];out=d/v/'normalized';out.mkdir(exist_ok=True)
scaled_frames=[im.resize((round(im.width*factor),round(im.height*factor)),Image.Resampling.LANCZOS) for im in frames]
boxes=[bounds(im) for im in scaled_frames]; anchor_x=(min(b[0] for b in boxes)+max(b[2] for b in boxes))/2; anchor_y=max(b[3] for b in boxes)
for i,scaled in enumerate(scaled_frames):
 canvas=Image.new('RGBA',(612,1059));x=round(306-anchor_x);y=1059-anchor_y;canvas.alpha_composite(scaled,(x,y));f=out/f'frame-{i:03}.png';canvas.save(f);result.append(f)
factory.create_phaser_sheet(result,base,24,8)
factory.write_loop_preview(result,base.with_name(name+'-preview-3x').with_suffix('.mp4'),fps=24,loops=3,bg_color='magenta')
factory.write_magenta_contact_sheet(result,d/f'{v}-loop-sheet.png',8)
manifest={};manifest['loop']=json.loads((d/v/'loop-detection.json').read_text());manifest['normalization']={'reference':'hermes-fal-veo-transparent-loop','frameSize':[612,1059],'alphaThreshold':127,'referenceHeightMedian':target,'referenceHeightRange':[min(refheights),max(refheights)],'idleHeightMedian':statistics.median(idleheights),'inputHeightMedian':statistics.median(heights),'uniformScale':factor,'feetAnchor':[0.5,1],'method':'uniform scale to reference median height; one global center and bottom anchor across the entire loop; preserve foot travel and body bob','outputHeightRange':[bounds(Image.open(f))[3]-bounds(Image.open(f))[1] for f in result]};manifest['generation']=json.loads((d/f'{v}-video.mp4.manifest.json').read_text());manifest['backgroundRemoval']=json.loads((d/('away-local-matte.manifest.json' if v=='away' else f'{v}-bria.webm.manifest.json')).read_text());manifest['keyframe']={'reused':str(p/f'hermes-{v}-keyframe.png')};manifest['loopPreview']=str(base.relative_to(root))+'-preview-3x.mp4';manifest['qcMagenta']=str(d.relative_to(root)/f'{v}-loop-sheet.png');base.with_suffix('.manifest.json').write_text(json.dumps(manifest,indent=2)+'\n');print(manifest['normalization'])
# Clean pipeline QC duplicate (review remains in tmp).
base.with_name(name+'-qc-magenta').with_suffix('.png').unlink(missing_ok=True)
