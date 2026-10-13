import json,time,urllib.request,urllib.error,pathlib
root=pathlib.Path('tmp/walkqa/final34')
scenes=[dict(key='rocky-beach',parent='outside',to='brief34_rocky_tidepool_beach',template='exterior',description='A wild rocky beach at low tide, with irregular tide pools full of dark seawater, scattered large boulders on wet shingle, and a rough dry path between the rocks. The sea meets a foggy horizon. No buildings, docks, vehicles or people.'),dict(key='cramped-cellar',parent='inside',to='brief34_cramped_cellar',template='interior',description='A cramped low-ceilinged stone cellar, rough damp floor, stacks of wooden crates crowding both sides, a wooden ladder leading to an open ceiling hatch, low beams and a single hanging oil lamp. A narrow route runs between crates. No reception desk, pews, shop shelves, vehicles or people.'),dict(key='fog-graveyard',parent='outside',to='brief34_fog_graveyard',template='exterior',description='A fog-bound old graveyard, crooked weathered headstones scattered over uneven bare earth, a tall wrought iron fence enclosing the cemetery, an open iron gate, and a winding dirt path between graves disappearing into thick fog. No fountain, houses, vehicles or people.')]
(root/'requests.json').write_text(json.dumps(scenes,indent=2))
for s in scenes:
 t=time.time(); body={k:v for k,v in s.items() if k!='key'}
 try:
  response=urllib.request.urlopen(urllib.request.Request('http://localhost:4317/api/places',json.dumps(body).encode(),{'Content-Type':'application/json'}),timeout=1800)
  status=response.status; data=json.load(response)
 except urllib.error.HTTPError as e: status=e.code;data=json.loads(e.read())
 except Exception as e: status=None;data={'error':str(e)}
 result={'request':body,'httpStatus':status,'seconds':time.time()-t,'response':data}
 (root/(s['key']+'-creation.json')).write_text(json.dumps(result,indent=2))
 print(s['key'],status,data.get('id'),(data.get('ground') or {}).get('ground'),data.get('error') or (data.get('ground') or {}).get('reason'),flush=True)
