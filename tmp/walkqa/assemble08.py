import pathlib,json,subprocess,shutil
root=pathlib.Path('tmp/walkqa')
for kind,groups in [('crossings',[(root/'occlusion-08'/sc/obj,["direct-front-to-behind","direct-behind-to-front"])for sc,obj in [('alley','crate-0-55e961'),('depot-outside','fishing-net-pile-22c3fb'),('road','left-fishing-net-0-55e961'),('road','right-lobster-trap-d0a0fc')]]),('exits',[(p,['door-outside-to-inside','door-inside-to-outside'] if p.name=='depot-door' else ['out','back'])for p in (root/'exits-08').iterdir() if p.is_dir() and (p/'render.json').exists()])]:
 for folder,legs in groups:
  if kind=='exits' and any(not x['exitCompleted'] for x in json.loads((folder/'render.json').read_text())['logs']):continue
  out=root/'crossings-final-08'/folder.name if kind=='crossings' else folder;out.mkdir(parents=True,exist_ok=True)
  manifest=out/'concat.txt';manifest.write_text(''.join("file '"+str((folder/(n+'.mp4')).resolve())+"'\n"for n in legs));subprocess.run(['ffmpeg','-v','error','-y','-f','concat','-safe','0','-i',str(manifest),'-c','copy',str(out/'roundtrip.mp4')],check=True);manifest.unlink()
  rows=[]
  for n in legs:rows+=json.loads((folder/(n+'.json')).read_text())
  (out/'roundtrip.json').write_text(json.dumps(rows))
  if kind=='crossings':shutil.copyfile(folder/'area.json',out/'area.json')
