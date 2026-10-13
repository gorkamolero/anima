"""Record a human/model visual inspection only after all listed sheets were viewed."""
import json,pathlib,sys,hashlib
scene,walk,result,note=sys.argv[1:5];p=pathlib.Path('tmp/walkqa/harness-20')/scene/(walk+'-crops/manifest.json');d=json.loads(p.read_text());images=[p.parent.parent/(walk+'-sheet.png'),*sorted(p.parent.glob('*review-*.png'))];d.update(viewed=True,pass_=result=='pass',notes=note,reviewedImageHashes={str(f):hashlib.sha256(f.read_bytes()).hexdigest() for f in images});p.write_text(json.dumps(d,indent=2));print(scene,walk,len(images),result)
