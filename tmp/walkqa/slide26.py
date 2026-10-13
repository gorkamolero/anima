"""Independent slide/body-motion ratios grouped by drawn physical support."""
import json,math,pathlib,functools
@functools.lru_cache(None)
def meta(texture):return json.loads((pathlib.Path('adventures/shadow-over-innsmouth/public/assets/sprites/hermes')/(texture+'.json')).read_text())
def check(rows):
 groups=[];cur=[];prev=None
 for r in rows:
  if not r.get('visible',True):prev=None;continue
  m=meta(r['texture']);c=m['contacts'][r['frame']];f=c['planted'];p=(r['x']+(c[f]['x']-m['frameWidth']/2)*r['scale']*(-1 if r['flip'] else 1),r['y']+(c[f]['y']-m['frameHeight'])*r['scale'])
  key=(r.get('location'),f,r['texture']);same=prev and prev[0][:2]==key[:2] and (prev[0][2]==key[2] or math.dist(prev[1],p)<=3)
  if not same and cur:groups.append(cur);cur=[]
  cur.append((p,(r['x'],r['y'])));prev=(key,p)
 if cur:groups.append(cur)
 ratios=[]
 for g in groups:
  foot=sum(math.dist(a[0],b[0]) for a,b in zip(g,g[1:]));body=sum(math.dist(a[1],b[1]) for a,b in zip(g,g[1:]))
  if body>1e-6:ratios.append(foot/body)
 ratios.sort()
 def q(p):
  if not ratios:return None
  x=(len(ratios)-1)*p;i=int(x);return ratios[i]*(1-(x-i))+ratios[min(i+1,len(ratios)-1)]*(x-i)
 median,p90=q(.5),q(.9)
 return {'pass_':median is not None and median<=.05+1e-9 and p90<=.15+1e-9,'median':median,'p90':p90,'stances':len(ratios)}
