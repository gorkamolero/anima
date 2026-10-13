"""Verify encoded dimensions, cadence, timestamps and one video frame per log row."""
import json, pathlib, subprocess, sys

def check(stream, timestamps, rows):
    errors = []
    if (stream.get('width'), stream.get('height')) != (1920, 1080):
        errors.append('dimensions')
    if stream.get('avg_frame_rate') != '24/1':
        errors.append('cadence')
    if len(timestamps) != len(rows):
        errors.append('frame-count')
    if any(abs(t - i / 24) > .0001 for i, t in enumerate(timestamps)):
        errors.append('video-timestamps')
    if any(abs(r['t'] - i / 24) > .0001 for i, r in enumerate(rows)):
        errors.append('log-timestamps')
    return dict(pass_=not errors, errors=errors, videoFrames=len(timestamps), logFrames=len(rows))

def inspect(path):
    data = json.loads(subprocess.check_output(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_streams', '-show_frames', '-show_entries', 'stream=width,height,avg_frame_rate:frame=best_effort_timestamp_time', '-of', 'json', str(path)]))
    return check(data['streams'][0], [float(f['best_effort_timestamp_time']) for f in data['frames']], json.loads(path.with_suffix('.json').read_text()))

if __name__ == '__main__':
    if '--self-test' in sys.argv:
        stream=dict(width=1920,height=1080,avg_frame_rate='24/1'); rows=[dict(t=i/24) for i in range(3)]
        assert check(stream,[0,1/24,2/24],rows)['pass_']
        assert not check(stream,[0,2/24],rows)['pass_']
        assert not check({**stream,'width':1280},[0,1/24,2/24],rows)['pass_']
        print('PASS: missing frame, wrong timestamps and wrong dimensions rejected')
    else:
        for event in pathlib.Path(sys.argv[1] if len(sys.argv)>1 else 'tmp/walkqa/harness-20').glob('*/*-events.json'):
            name=event.name.removesuffix('-events.json'); result=inspect(event.parent/(name+'.mp4'))
            (event.parent/(name+'-check-video.json')).write_text(json.dumps(result))
            print(event.parent.name,name,result['pass_'])
