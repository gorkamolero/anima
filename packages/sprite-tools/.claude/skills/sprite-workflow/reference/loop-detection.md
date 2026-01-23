# Loop Detection Reference

## Tool: LoopyCut

GitHub: https://github.com/carmelosantana/loopycut-cli

### Basic Usage

```bash
# Find best loop
python tools/loopycut/loopycut.py input.mp4 output.mp4 --method hybrid --similarity 80

# Verify by looping 6x
ffmpeg -stream_loop 5 -i output.mp4 -c copy test-6x.mp4
```

### Parameters

| Param | Values | Description |
|-------|--------|-------------|
| `--method` | `hybrid` | Best quality (hash + SSIM) |
| `--similarity` | 70-95 | Match threshold (lower = lenient) |
| `--stop` | time | Limit search range (e.g., `--stop 2.0`) |

---

## Intro + Loop Structure

AI animations have wind-up before looping. Structure:

```
INTRO: frames 1-N     (play once)
LOOP:  frames N+1-M   (repeat forever)
```

### Workflow

1. **Find loop**: `loopycut input.mp4 loop.mp4 --similarity 80`
2. **Note loop start** (e.g., 2.88s = frame 69 at 24fps)
3. **Test with intro**:
   ```bash
   # Extract intro
   ffmpeg -i input.mp4 -vf "select='between(n,0,68)',setpts=PTS-STARTPTS" -an intro.mp4

   # Concat test
   echo -e "file 'intro.mp4'\nfile 'loop.mp4'\nfile 'loop.mp4'\nfile 'loop.mp4'" > concat.txt
   ffmpeg -f concat -safe 0 -i concat.txt -c copy test.mp4
   ```

### Phaser Integration

```javascript
sprite.play('walk-intro').once('animationcomplete', () => {
  sprite.play('walk-loop');
});
```

---

## Manual Loop Finding

If LoopyCut fails, use imagehash:

```python
import imagehash
from PIL import Image

hash1 = imagehash.phash(Image.open("frame-001.png"))
for i, f in enumerate(frames[24:], 24):  # skip first 1s
    diff = hash1 - imagehash.phash(Image.open(f))
    if diff < 15:
        print(f"Loop candidate: frame {i}")
```
