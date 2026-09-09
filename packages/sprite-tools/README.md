# Sprite Tools

AI video → game-ready spritesheets. One command.

## Quick Start

```bash
# Generate a fal.ai Veo 3.1 walk video
npx tsx scripts/fal-video.ts generate \
  --image sources/valid/character-standing.png \
  --prompt "This exact character performs a smooth point-and-click walk cycle..." \
  --aspect 9:16 \
  --duration 4 \
  --resolution 720p \
  --output output/character-walk/raw.mp4

# Segment with fal.ai BRIA onto a pure magenta background
npx tsx scripts/fal-video.ts remove-bg \
  --video output/character-walk/raw.mp4 \
  --output output/character-walk/alpha.webm \
  --background Transparent \
  --codec webm_vp9

# Convert BRIA transparent WebM to a transparent Phaser sheet
uv run scripts/sprite-factory.py process-alpha \
  --video output/character-walk/alpha.webm \
  --output sprites/walk \
  --cols 8 \
  --detect-loop \
  --preview-loops 3
```

## The Pipeline

```
1. GENERATE VIDEO    → fal.ai Veo 3.1 image-to-video, grey source constraints
2. REMOVE BG         → fal.ai BRIA background-removal to transparent WebM
3. EXTRACT RGBA      → ffmpeg + libvpx-vp9 @ 24fps
4. DETECT LOOP       → local LoopyCut frame-similarity scan
5. TRIM TO CONTENT   → Global bounding box
6. CREATE SPRITESHEET → PNG + JSON metadata
```

BRIA transparent WebM carries alpha via VP9 `alpha_mode=1`. Use
`sprite-factory.py process-alpha`, which forces ffmpeg's `libvpx-vp9` decoder.
The native ffmpeg VP9 decoder can flatten the alpha. Do not use BRIA ProRes MOV
for this path; it decoded without usable alpha here.

## Requirements

```bash
uv run scripts/sprite-factory.py --help
brew install ffmpeg imagemagick
```

Set `FAL_KEY` in `.env` for fal.ai generation and BRIA segmentation. Do not
commit the key.

## Scripts

| Script | Purpose |
|--------|---------|
| `fal-video.ts` | fal.ai Veo generation and BRIA background-removal |
| `video-generate.ts` | Back-compatible fal.ai Veo 3.1 source video generation |
| `sprite-factory.py` | Chroma-key video to Phaser spritesheet |
| `pipeline_a.py` | RemBG fallback, not the default for clean sprite videos |
| `pipeline_b.py` | Nano Banana matte fallback for difficult gray videos |

## sprite-factory.py Commands

### `process` - Video → Spritesheet

```bash
uv run scripts/sprite-factory.py process \
  --video input.mp4 \
  --output sprites/character-walk \
  --fps 24 \
  --preset gray \
  --cols 6
```

Outputs:
- `sprites/character-walk.png` - spritesheet
- `sprites/character-walk.json` - metadata
- `sprites/character-walk.manifest.json` - command/settings manifest

Use `--cols 6` for tall 9:16 character videos unless you have measured the
target runtime texture limit. One-row sheets can exceed WebGL texture limits
and render as black rectangles in Phaser.

Presets:

```bash
--preset gray       # expected flat #828282 background
--preset white-veo  # fallback when Veo returns white despite gray prompt
--preset magenta-fal # fal BRIA output with --background Magenta
```

### `fal-video.ts` - Create Video and Segment

```bash
npx tsx scripts/fal-video.ts generate \
  --image character-ref.png \
  --prompt "This exact character walks forward to the left..." \
  --aspect 9:16 \
  --duration 4 \
  --output output/character-walk/raw_video.mp4

npx tsx scripts/fal-video.ts remove-bg \
  --video output/character-walk/raw_video.mp4 \
  --output output/character-walk/alpha.webm \
  --background Transparent \
  --codec webm_vp9
```

### `process-alpha` - Transparent Video → Spritesheet

```bash
uv run scripts/sprite-factory.py process-alpha \
  --video output/character-walk/alpha.webm \
  --output sprites/character-walk \
  --fps 24 \
  --cols 8 \
  --detect-loop \
  --preview-loops 3
```

This also writes `sprites/character-walk-preview-3x.mp4`, a quick review
video with the detected loop repeated three times on a magenta background.

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

If BRIA transparent WebM does not decode with alpha, verify the stream has
`alpha_mode=1` and force `-c:v libvpx-vp9` before trying a colored-background
fallback.

## JSON Metadata

```json
{
  "name": "character-walk",
  "frameWidth": 301,
  "frameHeight": 467,
  "frameCount": 48,
  "cols": 6,
  "rows": 8,
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
