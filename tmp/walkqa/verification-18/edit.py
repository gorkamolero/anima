"""Bounded, resumable Brief 18 image edits; never logs credentials."""
import base64, datetime, json, os, sys, urllib.request
from pathlib import Path

ROOT = Path('tmp/walkqa/verification-18')
MODEL = 'fal-ai/nano-banana-2/edit'
PROMPTS = {
    'A': 'The exact same image. Change only the arms: both arms hang relaxed at his sides. Do not change the legs, feet, head, torso, satchel, clothes, framing or size.',
    'B': "The exact same image. Change only the legs and feet: he now stands still, both feet flat on the ground side by side, knees straight, weight even. Do not change the planted foot's position, or the head, torso, arms, satchel, clothes, framing or size.",
}

def request(url, data=None):
    req = urllib.request.Request(url, data=json.dumps(data).encode() if data else None,
        headers={'Authorization': 'Key '+os.environ['FAL_KEY'], 'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.load(r)

mode, heading, step, attempt = sys.argv[1:5]
assert heading in ['side', 'away-right'] and step in PROMPTS and attempt in ['1', '2']
d = ROOT / heading / (step+'-'+attempt)
d.mkdir(parents=True, exist_ok=True)
if mode == 'submit':
    assert not (d/'input.json').exists(), 'Never duplicate an attempted submission'
    assert len(list(ROOT.glob('*/*/input.json'))) < 8
    source = Path(sys.argv[5])
    prompt = PROMPTS[step]
    if attempt == '2':
        prompt += ' Treat all unedited regions as locked pixels. Preserve the exact original face, glasses, hair, bag shape, strap, jacket outline, boot coordinates and character proportions. No redrawing, rescaling, recentering or reframing. Flat RGB 128 grey background. '+sys.argv[6]
    data = dict(prompt=prompt, image_urls=['source.png'], aspect_ratio='auto',
                num_images=1, output_format='png', limit_generations=True, resolution='1K')
    (d/'source.png').write_bytes(source.read_bytes())
    (d/'input.json').write_text(json.dumps(dict(model=MODEL, **data), indent=2)+'\n')
    with Path('tmp/walkqa/calls.md').open('a') as f:
        f.write(f'\n| Brief 18 {heading} {step} attempt {attempt} | {datetime.datetime.now(datetime.timezone.utc).isoformat()} | {MODEL} | submission attempted |\n')
    data['image_urls'] = ['data:image/png;base64,'+base64.b64encode(source.read_bytes()).decode()]
    result = request('https://queue.fal.run/'+MODEL, data)
    (d/'request.json').write_text(json.dumps(result, indent=2)+'\n')
    print(heading, step, attempt, result['request_id'])
else:
    r = json.loads((d/'request.json').read_text())
    status = request(r['status_url'])
    print(heading, step, attempt, status['status'])
    if status['status'] == 'COMPLETED' and not (d/'raw.png').exists():
        result = request(r['response_url'])
        (d/'result.json').write_text(json.dumps(result, indent=2)+'\n')
        urllib.request.urlretrieve(result['images'][0]['url'], d/'raw.png')
        print('downloaded')
