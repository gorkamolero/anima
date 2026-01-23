# veo-standing-rubberhose

Extracted from: `videos/veo-standing-rubberhose.mp4`

## Structure
- `intro/` - 68 frames (play once)
- `loop/` - 27 frames (repeat)

## Extraction Parameters

**Method**: Chroma Key v3

```python
BG_COLOR = (130, 130, 130)  # Grey
grey_dist < 15              # Tight threshold
brightness > 100            # Protect dark clothing
black_dist < 10             # Remove letterbox
```

## Usage (Phaser)

```javascript
sprite.play('standing-intro').once('animationcomplete', () => {
  sprite.play('standing-loop');
});
```

## Frame Rate
24 fps (from source video)
