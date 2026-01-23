---
name: sprite-workflow
description: Full sprite creation pipeline from source image to Phaser spritesheet. Covers isolation, pose generation, video generation, and extraction.
---

# Sprite Creation Pipeline

**Last updated**: Jan 2025 after extensive testing

## TL;DR - The Full Workflow

```
PHASE 0: SOURCE PREP
1. ISOLATE CHARACTER → SeedEdit 3.0 + lucataco/remove-bg
2. GENERATE POSES    → ChatGPT "Describe First" technique
3. CLOTHE IF NEEDED  → Avoids content moderation

PHASE 1: VIDEO GENERATION
4. GENERATE VIDEO    → Veo 3.1, grey background, NO SHADOWS

PHASE 2: SPRITE EXTRACTION
5. EXTRACT FRAMES    → ffmpeg
6. REMOVE BACKGROUND → CHROMA KEY (not rembg!)
7. TRIM TO CONTENT   → Global bounding box
8. VERIFY FEET       → Must be at pixel-bottom
9. FIND LOOP         → LoopyCut or manual
10. CREATE SPRITESHEET → montage + JSON metadata
11. ORGANIZE          → intro/ + loop/ folders
```

---

# Phase 0: Source Preparation

## Character Isolation

**Best approach: SeedEdit → remove-bg**

1. **SeedEdit 3.0** (`bytedance/seededit-3.0`) - Isolate character, remove unwanted elements
   - Cost: ~$0.03/image, ~13 seconds
   - Prompt: "isolate character on black background, remove [unwanted element]"

2. **lucataco/remove-bg** - Final background removal
   - Preserves extended limbs better than other models
   - Use AFTER SeedEdit cleanup

## Pose Generation

**Problem**: API models (FLUX, Ideogram) change character style when generating new poses. They generate generic faces instead of preserving the exact character.

**Solution**: ChatGPT with "Describe First" technique

### The "Describe First" Technique

This is the key to preserving character identity across poses. Having ChatGPT analyze and describe the character first anchors the visual details before generating.

#### Step-by-Step

1. **Start a fresh ChatGPT chat** (Developer mode recommended - no memory contamination)

2. **Upload reference image** and ask:
   ```
   Describe this character in detail.
   ```

3. **Wait for full description** - ChatGPT will analyze face, hair, body, clothing, art style

4. **Request the new pose** with emphasis on preservation:
   ```
   Generate this exact character standing in a relaxed idle pose.
   Arms loosely at her sides, weight slightly on one leg.
   Keep everything identical - same face, same proportions,
   same art style, same clothing, same colors.
   Plain gray background.
   ```

#### Why This Works

- Forces the model to **internalize specific features** before generating
- Creates a **stronger style anchor** than direct pose requests
- The description acts as an **implicit prompt** for the generation

#### Tips

- **Be specific**: "same face, same proportions, same art style"
- **Keep pose requests minimal**: "standing idle" is enough
- **Use plain backgrounds**: Gray works well for later removal
- **Fresh chat for each session**: Avoids context pollution

### Guardrails

Always work with **clothed characters** for pose generation. Create clothed version first, then generate poses freely. This avoids content moderation triggers.

## Workflow Order

1. **Extract** - Isolate character from source (SeedEdit + remove-bg)
2. **Clothe** - Add clothes via ChatGPT if needed
3. **Pose** - Generate poses using clothed version as reference
4. **Clean** - Remove background from final sprites

## Valid Sources

Characters ready for pose generation:
- `sources/valid/ashley-cherub-clothed.png` - Clothed (black tank, denim shorts), sitting
- `sources/valid/ashley-cherub-standing.png` - Standing idle pose
- `sources/valid/ashley-cherub-walking.png` - Walking mid-stride pose

---

# Phase 1: Video Generation

## Target Style: Rubberhose Animation

1920s-30s cartoon style (Betty Boop, Cuphead, early Mickey Mouse):
- Fluid, bouncy limb movements
- Arms/legs swing like rubber hoses
- Exaggerated squash & stretch
- Rhythmic, musical motion

## Models Tested

| Model | Cost | Result |
|-------|------|--------|
| **Veo 3.1** | $0.10/sec (~$0.40/4s) | ✓ **WINNER** - Best quality |
| Sora 2 Pro | $0.10/sec | ✗ Low quality, content filter issues |
| Luma Ray Flash 2 | $0.033/sec | ✗ Not good enough |
| Minimax Video-01-Live | ~$0.50/video | ✗ Not good enough |

## Video Generation Scripts

```bash
cd packages/sprite-tools

# Veo 3.1 via Replicate (recommended)
npx tsx scripts/video-generate.ts \
  --model veo \
  --image sources/valid/ashley-cherub-standing.png \
  --prompt "This exact character walks forward to the left, keep identical appearance, bouncy rubberhose walk cycle, arms swing like rubber" \
  --aspect 9:16

# Wide format (16:9) for characters that move across frame
npx tsx scripts/video-generate.ts \
  --model veo \
  --image sources/wip/skyler-idle-clean.png \
  --prompt "This exact character walks forward to the left, keep identical appearance, bouncy rubberhose walk cycle" \
  --aspect 16:9
```

**Note:** Use `video-generate.ts` (Replicate) not `veo-video.ts` (Google direct API).

## Key Findings

**Best model:** Veo 3.1 (Google) - only one that produces good rubberhose animation

**Starting pose matters:**
- **Standing sprite → any animation** works best
- Walking/mid-action sprites confuse the model about direction

**Prompt structure:** Action first, then style references
```
[Subject] [action] [direction], [style references], [motion details]
```

**Working prompt template:**
```
Girl [ACTION] to the left, Cuphead animation style, Betty Boop Fleischer cartoon, rubberhose limbs with no joints, bouncy [MOTION TYPE], arms bend like rubber tubes, smooth flowing motion
```

**What NOT to do:**
- Don't overstuff prompts describing the image (model already sees it)
- Don't describe the style when the image already has the style
- Don't use "girl" with Sora (triggers content filter)
- Don't use walking pose as input for walking animation

## API Setup

- Replicate token: `REPLICATE_API_TOKEN=...` in `.env`

---

# Phase 2: Video to Sprite Extraction

## Why Chroma Key > rembg

We tested extensively:
- **rembg**: Cuts into face, eats dark clothing (black shirts)
- **BiRefNet**: Same issues, slower
- **Chroma Key**: Perfect preservation, instant, no ML artifacts

AI video generators produce consistent solid backgrounds. Use that!

---

## Step-by-Step

### 1. Generate Video

Use **Veo 3.1** via Replicate. Critical prompting:

```
This exact character [ACTION], keep identical appearance,
plain grey background, NO SHADOWS, no ground shadow
```

**Why no shadows**: Shadow blob under feet complicates cropping and creates artifacts.

### 2. Extract Frames

```bash
mkdir frames
ffmpeg -i video.mp4 -vsync 0 frames/frame-%03d.png
```

### 3. Remove Background (Chroma Key)

```python
from PIL import Image
import numpy as np
import os

def chroma_key(input_path, output_path):
    img = Image.open(input_path)
    rgb = np.array(img)
    r, g, b = rgb[:,:,0], rgb[:,:,1], rgb[:,:,2]

    # Grey background (~130,130,130) - adjust if different
    grey_dist = np.sqrt((r.astype(float) - 130)**2 +
                        (g.astype(float) - 130)**2 +
                        (b.astype(float) - 130)**2)

    # Black letterbox bars
    black_dist = np.sqrt(r.astype(float)**2 + g.astype(float)**2 + b.astype(float)**2)

    # Brightness protects dark clothing
    brightness = (r.astype(float) + g.astype(float) + b.astype(float)) / 3

    # Key parameters (tested extensively):
    # - grey_dist < 15: tight, protects clothing with grey highlights
    # - brightness > 100: protects black shirts
    is_grey_bg = (grey_dist < 15) & (brightness > 100)
    is_black_bar = black_dist < 10
    is_background = is_grey_bg | is_black_bar

    alpha = (~is_background).astype(np.uint8) * 255
    result = Image.fromarray(np.dstack([rgb, alpha]))
    result.save(output_path)

# Batch process
os.makedirs("sprites", exist_ok=True)
for f in sorted(os.listdir("frames")):
    if f.endswith('.png'):
        chroma_key(f"frames/{f}", f"sprites/{f}")
```

### 4. Trim to Content

After chroma key, frames have transparent padding. Trim all frames to the same global bounding box so the sprite size matches the visible content.

```python
from PIL import Image
import os

def get_content_bbox(img):
    """Get bounding box of non-transparent pixels"""
    alpha = img.split()[-1]
    return alpha.getbbox()

def trim_frames(input_dir, output_dir):
    os.makedirs(output_dir, exist_ok=True)
    files = sorted([f for f in os.listdir(input_dir) if f.endswith('.png')])

    # Pass 1: Find global bounding box across ALL frames
    global_bbox = None
    for f in files:
        img = Image.open(f"{input_dir}/{f}")
        bbox = get_content_bbox(img)
        if bbox:
            if global_bbox is None:
                global_bbox = bbox
            else:
                global_bbox = (
                    min(global_bbox[0], bbox[0]),
                    min(global_bbox[1], bbox[1]),
                    max(global_bbox[2], bbox[2]),
                    max(global_bbox[3], bbox[3])
                )

    print(f"Global bounds: {global_bbox}")
    width = global_bbox[2] - global_bbox[0]
    height = global_bbox[3] - global_bbox[1]
    print(f"Frame size: {width}x{height}")

    # Pass 2: Crop all frames to global bounds
    for f in files:
        img = Image.open(f"{input_dir}/{f}")
        cropped = img.crop(global_bbox)
        cropped.save(f"{output_dir}/{f}")

trim_frames("sprites", "trimmed")
```

### 5. Verify Feet at Bottom (CRITICAL)

**For character sprites, feet MUST be at the very bottom of the frame.** Phaser uses origin (0.5, 1) for characters, meaning the Y position = where feet touch ground. Any padding below feet causes characters to float.

```bash
# Check a single frame for bottom padding
magick trimmed/frame-001.png -background red -flatten /tmp/check.png && open /tmp/check.png

# Get exact content bounds
magick trimmed/frame-001.png -trim -format "Content: %wx%h at +%X+%Y" info:
```

**If there's padding below feet**, the content height won't match frame height. Fix with:

```bash
# For spritesheet: crop from top offset, use exact content height
# Example: content starts at Y=5, height=415, original=467
magick spritesheet.png -crop WIDTHxCONTENT_HEIGHT+0+TOP_OFFSET +repage spritesheet-fixed.png

# Concrete example:
magick ashley-spritesheet.png -crop 8428x415+0+5 +repage ashley-spritesheet.png
```

**Verification checklist:**
- [ ] Extract one frame, add red background, visually confirm feet touch bottom edge
- [ ] `magick frame.png -trim info:` should show content height = frame height
- [ ] No red visible below feet when background is added

**Why this matters:** Character origin is bottom-center. If feet aren't at pixel-bottom, the character floats above ground lines and spawn positions are wrong.

### 6. Find Loop Points

Use **LoopyCut** or identify manually by watching the video:

```bash
python tools/loopycut/loopycut.py video.mp4 loop.mp4 --method hybrid --similarity 80
```

AI videos typically have:
- **Intro**: Wind-up animation (frames 1-N)
- **Loop**: Repeatable cycle (frames N+1 to end)

### 6. Create Spritesheet

Combine trimmed frames into a single spritesheet with JSON metadata for Phaser:

```python
from PIL import Image
import json
import os
import math

def create_spritesheet(input_dir, output_name, fps=24):
    files = sorted([f for f in os.listdir(input_dir) if f.endswith('.png')])
    if not files:
        return

    # Get frame dimensions from first frame
    sample = Image.open(f"{input_dir}/{files[0]}")
    frame_w, frame_h = sample.size
    frame_count = len(files)

    # Calculate grid (single row for simple spritesheets)
    cols = frame_count
    rows = 1

    # Create spritesheet
    sheet = Image.new('RGBA', (frame_w * cols, frame_h * rows), (0, 0, 0, 0))
    for i, f in enumerate(files):
        img = Image.open(f"{input_dir}/{f}")
        x = (i % cols) * frame_w
        y = (i // cols) * frame_h
        sheet.paste(img, (x, y))

    sheet.save(f"{output_name}.png")

    # Create JSON metadata
    meta = {
        "name": output_name,
        "frameWidth": frame_w,
        "frameHeight": frame_h,
        "frameCount": frame_count,
        "cols": cols,
        "rows": rows,
        "fps": fps
    }
    with open(f"{output_name}.json", 'w') as f:
        json.dump(meta, f, indent=2)

    print(f"Created {output_name}.png ({frame_w * cols}x{frame_h * rows})")
    print(f"Frame size: {frame_w}x{frame_h}, {frame_count} frames")

create_spritesheet("trimmed", "character-walk", fps=24)
```

### 7. Organize Output

```
sprites/
└── character-animation/
    ├── README.md      # Parameters used
    ├── intro/         # Play once
    └── loop/          # Repeat forever
```

---

## Key Parameters Reference

| Parameter | Value | Why |
|-----------|-------|-----|
| `grey_dist` | < 15 | Tight threshold prevents eating into clothing |
| `brightness` | > 100 | Protects dark pixels (black shirts) |
| `black_dist` | < 10 | Removes letterbox bars from video |

Adjust `grey_dist` threshold if background color differs from 130,130,130.

---

## Phaser Integration

The JSON metadata contains the exact frame dimensions - use it:

```javascript
// In preload - load JSON first, then spritesheet with correct dimensions
preload() {
  this.load.json('ashley-meta', 'assets/sprites/ashley.json');
}

create() {
  const meta = this.cache.json.get('ashley-meta');

  // Now load spritesheet with dimensions from JSON
  this.load.spritesheet('ashley', 'assets/sprites/ashley.png', {
    frameWidth: meta.frameWidth,
    frameHeight: meta.frameHeight
  });

  this.load.once('complete', () => {
    // Create animation using fps from metadata
    this.anims.create({
      key: 'ashley-walk',
      frames: this.anims.generateFrameNumbers('ashley', {
        start: 0,
        end: meta.frameCount - 1
      }),
      frameRate: meta.fps,
      repeat: -1
    });
  });

  this.load.start();
}
```

Or simpler - just reference the JSON values when writing your scene:

```javascript
// ashley.json says: frameWidth: 301, frameHeight: 467, fps: 24
this.load.spritesheet('ashley', 'assets/sprites/ashley.png', {
  frameWidth: 301,  // from JSON
  frameHeight: 467  // from JSON
});
```

---

## Common Issues

**Face getting cut off**
→ rembg does this. Switch to chroma key.

**Black shirt has holes**
→ Grey highlights in shirt being keyed. Tighten threshold (< 15).

**Grey fringe around edges**
→ You're using rembg with mask dilation. Use chroma key instead.

**Shadow blob under feet**
→ Re-generate video with "no shadows" in prompt.

---

## File Structure

```
sources/
├── videos/       # Source videos from Veo
├── sprites/      # Extracted sprite sets
│   └── [name]/
│       ├── intro/
│       ├── loop/
│       └── README.md
├── raw/          # Reference images
└── valid/        # Approved final images
```

---

## Models Reference

| Task | Best Model | Notes |
|------|------------|-------|
| Isolation | SeedEdit 3.0 | Removes unwanted elements |
| BG Removal | lucataco/remove-bg | Preserves limbs |
| Style Edit | ChatGPT (web) | Upload reference image |
| Pose Change | ChatGPT (web) | "Describe First" technique |
| Video Gen | Veo 3.1 | Only good rubberhose animation |
