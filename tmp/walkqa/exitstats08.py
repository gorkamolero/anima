import json,pathlib,collections
root=pathlib.Path('tmp/walkqa'); areas={}
for p in list((root/'geometry-08').glob('*/navigation.json'))+list((root/'geometry-final-08').glob('*/navigation.json')):
 d=json.loads(p.read_text());d['area']['mask']=d['area'].get('rawMask',d['area']['mask']);areas[d['location']]=d
for p in (root/'exits-08').glob('*/*.json'):
 if p.stem not in ['out','back','door-outside-to-inside','door-inside-to-outside']:continue
 rows=json.loads(p.read_text());parts=collections.defaultdict(list)
 for row in rows:
  if row['visible']:parts[row['location']].append(row)
 for loc,rows in parts.items():
  if loc not in areas:continue
  folder=root/'exit-stats-08'/loc;folder.mkdir(parents=True,exist_ok=True);(folder/'area.json').write_text(json.dumps(areas[loc]));(folder/(p.parent.name+'-'+p.stem+'.json')).write_text(json.dumps(rows))
