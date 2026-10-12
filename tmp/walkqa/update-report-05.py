import json,re
from pathlib import Path
p=Path('tmp/walkqa/reports/05-foot-lock.md');s=p.read_text();rows=[]
for f in Path('tmp/walkqa/checks-05').glob('*/*.json'):
 r=json.loads(f.read_text());name=f'{f.parent.name}/{f.stem}.mp4'
 value=r.get('stanceDrift_px_max');status='PASS' if value is not None and value<=1.5 else 'FAIL' if value is not None else 'unresolved (no stance)' if 'stances' in r else 'checker error'
 def replace(m):return f'| {name} | {m[1]} | {value if value is not None else "no stance"} | {status} |'
 s=re.sub(r'\| '+re.escape(name)+r' \| ([^|]+) \| [^|]+ \| [^|]+ \|',replace,s)
 rows.append((name,value,status))
p.write_text(s)
print('Measured',len(rows),'pass',sum(r[2]=='PASS' for r in rows),'fail',sum(r[2]=='FAIL' for r in rows),'unresolved',sum(r[2].startswith('unresolved') for r in rows))
