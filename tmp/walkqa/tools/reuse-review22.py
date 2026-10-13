"""Carry an already viewed review only when every required image is byte-identical."""
import pathlib,json,hashlib
root=pathlib.Path('tmp/walkqa/harness-22')
for p in root.glob('*/*-crops/manifest.json'):
 q=json.loads(p.read_text())
 if q.get('viewed'):continue
 prior=root/'attempt-6'/p.relative_to(root)
 if not prior.exists():continue
 old=json.loads(prior.read_text())
 if not old.get('viewed'):continue
 name=p.parent.name.removesuffix('-crops');images=[p.parent.parent/(name+'-sheet.png'),*sorted(p.parent.glob('*review-*.png'))]
 hashes={str(f):hashlib.sha256(f.read_bytes()).hexdigest() for f in images}
 if hashes != old.get('reviewedImageHashes'):continue
 q.update(viewed=True,pass_=old['pass_'],notes=old['notes'],reviewedImageHashes=hashes,identicalViewedEvidence=str(prior))
 p.write_text(json.dumps(q,indent=2));print('Identical already-viewed evidence:',p)
