# Sprite Tools

AI video → game-ready spritesheets. One command.

## Quick Start

```bash
# Process existing video
python scripts/sprite-factory.py process --video video.mp4 --output sprites/walk

# Generate + process (end-to-end)
python scripts/sprite-factory.py full \
  --prompt "character walking cycle, side view" \
  --reference character.png \
  --output sprites/walk
```

## The Pipeline

```
1. GENERATE VIDEO    → Veo 3.1, grey background, NO SHADOWS
2. EXTRACT FRAMES    → ffmpeg @ 24fps
3. CHROMA KEY        → Remove grey BG (not rembg - it eats faces)
4. TRIM TO CONTENT   → Global bounding box
5. CREATE SPRITESHEET → PNG + JSON metadata
```

## Requirements

```bash
pip install pillow numpy python-dotenv google-genai
brew install ffmpeg imagemagick
```

Set `GOOGLE_API_KEY` in `.env` for Veo generation.

## Scripts

| Script | Purpose |
|--------|---------|
| `sprite-factory.py` | **Main pipeline** - video to spritesheet |
| `hedra-video.py` | Generate talking head videos (lip-sync) |
| `split-characters.sh` | Split duo images into individuals |
| `resize-sprite.sh` | Scale sprite sheets |
| `compare-sprites.sh` | Size matching between sprites |
| `optimize-sprites.sh` | Compress for production |
| `optimize-audio.sh` | Compress audio files |

## sprite-factory.py Commands

### `process` - Video → Spritesheet

```bash
python scripts/sprite-factory.py process \
  --video input.mp4 \
  --output sprites/character-walk \
  --fps 24
```

Outputs:
- `sprites/character-walk.png` - spritesheet
- `sprites/character-walk.json` - metadata

### `generate` - Create Video (Veo)

```bash
python scripts/sprite-factory.py generate \
  --prompt "character walking cycle" \
  --reference character-ref.png \
  --output sprites/character-walk \
  --duration 6
```

### `full` - End-to-End

```bash
python scripts/sprite-factory.py full \
  --prompt "character walking cycle" \
  --reference character-ref.png \
  --output sprites/character-walk
```

## Prompt Engineering (Critical!)

For best results, be **extremely specific**:

```
This exact character performing a smooth walking cycle,
side view, 8 steps total, feet clearly lifting and planting,
rubberhose animation style, plain grey background (#828282),
NO shadows, no ground shadow, character centered in frame
```

Bad prompt: "character walking"
Good prompt: Frame-by-frame description of the motion

## JSON Metadata

```json
{
  "name": "character-walk",
  "frameWidth": 301,
  "frameHeight": 467,
  "frameCount": 48,
  "cols": 48,
  "rows": 1,
  "fps": 24
}
```

Use in Phaser:
```javascript
this.load.spritesheet('walk', 'sprites/character-walk.png', {
  frameWidth: 301,
  frameHeight: 467
});
```

## Folder Structure

```
sources/
├── raw/          # Reference images
├── valid/        # Approved final sprites
└── wip/          # Work in progress

scripts/
└── sprite-factory.py   # Main pipeline
```

## Factory Mode (for GLM/Ralph)

The pipeline is designed for cheap agents to run:

```bash
# GLM just executes this
python sprite-factory.py process --video $VIDEO --output $OUTPUT
```

Opus writes the prompts, reviews output quality. GLM does the grunt work.
