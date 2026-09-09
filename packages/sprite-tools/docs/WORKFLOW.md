# Sprite Generation Workflow

## Character Isolation (from complex backgrounds)

**Best approach: SeedEdit → remove-bg**

1. **SeedEdit 3.0** (`bytedance/seededit-3.0`) - Isolate character, remove unwanted elements (clouds, debris)
   - Cost: ~$0.03/image, ~13 seconds
   - Prompt: "isolate character on black background, remove [unwanted element]"

2. **lucataco/remove-bg** - Final background removal
   - Preserves extended limbs better than other models
   - Use AFTER SeedEdit cleanup

## Pose Generation

**Problem**: API models (FLUX, Ideogram) change character style when generating new poses. They tend to generate generic faces instead of preserving the exact character.

**Solution**: ChatGPT with "Describe First" technique

### The "Describe First" Technique

This is the key to preserving character identity across poses. By having ChatGPT analyze and describe the character first, it anchors the visual details in its context before generating.

#### Step-by-Step Process

1. **Start a fresh ChatGPT chat** (Developer mode recommended - no memory contamination)

2. **Upload reference image** and ask:
   ```
   Describe this character in detail.
   ```

3. **Wait for full description** - ChatGPT will analyze:
   - Face and expression (eyes, smile, features)
   - Hair style and color
   - Body type and proportions
   - Clothing details
   - Art style (painterly, cartoon, etc.)
   - Overall impression/personality

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
- Reduces the model's tendency to "genericize" the character

#### Tips

- **Be specific about what to preserve**: "same face, same proportions, same art style"
- **Keep pose requests minimal**: Don't overcomplicate - "standing idle" is enough
- **Use plain backgrounds**: Gray works well, makes bg removal easier later
- **Fresh chat for each session**: Avoids context pollution from previous attempts

### Guardrails

Always work with **clothed characters** for pose generation. Create clothed version first, then generate poses freely. This avoids content moderation triggers.

## Workflow Order

1. **Extract** - Isolate character from source (SeedEdit + remove-bg)
2. **Clothe** - Add clothes via ChatGPT if needed (avoids guardrails)
3. **Pose** - Generate poses using clothed version as reference
4. **Clean** - Remove background from final sprites (remove-bg)

## Scene-Fitted Character Poses

For poses that must fit a specific playable scene, do not ask directly for a
transparent sprite first. Generate the character in the scene, then isolate the
character from that accepted scene composite.

Use this when a pose depends on scene geometry, especially:

- seated characters on a bench/chair
- leaning on counters
- entering vehicles
- interacting with scene props
- scale-sensitive foreground/background staging

The required sequence is:

1. Feed the full character reference, not a crop.
2. Feed the clean scene/background image.
3. Generate a scene composite that solves pose, scale, lighting, and contact.
4. Accept or reject the composite based on scene fit.
5. Isolate only the character from the accepted composite.
6. Remove the background and verify alpha directly.
7. Wire only the transparent character asset into the game.

Do not use the scene composite itself as a sprite. It will carry a rectangular
background patch into the playable scene.

For talking characters, do not stop at a second generated still except as a
temporary state-plumbing proof. Use the accepted seated/idle pose as the input
for a short talk-loop video, remove the background, and export the loop as a
same-size transparent spritesheet so the game can animate `seatedTalk` without
scale or anchor jumps.

Create a few-loop review video from transparent frames with:

```bash
packages/sprite-tools/.venv/bin/python packages/sprite-tools/scripts/make-loop-preview.py \
  --frames path/to/idle.png path/to/talk-frame.png \
  --out path/to/talk-loop-preview.webm \
  --fps 4 \
  --loops 8
```

When generating source video through `fal-video.ts`, choose the constraint
preset that matches the motion:

```bash
pnpm --filter @will/sprite-tools exec tsx scripts/fal-video.ts generate \
  --image path/to/seated-idle.png \
  --prompt "subtle seated talk loop, same pose and anchor" \
  --output path/to/raw-talk.mp4 \
  --aspect 16:9 \
  --duration 4s \
  --resolution 720p \
  --audio false \
  --constraint-preset talk
```

Do not use the default walk preset for seated talk loops; it appends walking
constraints and will fight the asset goal.

For movable characters, a reusable walk loop is only a starting point. Prefer
scene-specific composites from full references whenever the scene has different
camera distance, ground line, lighting, or perspective. Use the composite to
derive scale and anchor, then either validate the existing transparent loop or
generate a scene-specific idle/walk asset. Do not keep a generic sprite just
because it technically moves if it looks wrong in the scene.

The Innsmouth seated Kat workflow is documented in:

```text
adventures/shadow-over-innsmouth/SCENE-CHARACTER-ASSET-WORKFLOW.md
```

## Valid Sources

Characters ready for pose generation:
- `sources/valid/ashley-cherub-clothed.png` - Ashley cherub, clothed (black tank, denim shorts), sitting reference
- `sources/valid/ashley-cherub-standing.png` - Ashley cherub, standing idle pose
- `sources/valid/ashley-cherub-walking.png` - Ashley cherub, walking mid-stride pose

## Video Generation

### Target Style: Rubberhose Animation
1920s-30s cartoon style (Betty Boop, Cuphead, early Mickey Mouse):
- Fluid, bouncy limb movements
- Arms/legs swing like rubber hoses
- Exaggerated squash & stretch
- Rhythmic, musical motion

### Models Tested

| Model | Cost | Result |
|-------|------|--------|
| **Veo 3.1** | $0.10/sec (~$0.40/4s) | ✓ **WINNER** - Best quality |
| Sora 2 Pro | $0.10/sec | ✗ Low quality, content filter issues |
| Luma Ray Flash 2 | $0.033/sec | ✗ Not good enough |
| Minimax Video-01-Live | ~$0.50/video | ✗ Not good enough |

### Generated Videos

Located in `sources/videos/`:
- `veo-standing-rubberhose.mp4` - Walk from standing pose
- `veo-walking-rubberhose.mp4` - Walk from walking pose

### Scripts

```bash
cd packages/sprite-tools

# Veo 3.1 via fal.ai (recommended)
npx tsx scripts/video-generate.ts \
  --model veo \
  --image sources/valid/ashley-cherub-standing.png \
  --prompt "This exact character walks forward to the left, keep identical appearance, bouncy rubberhose walk cycle, arms swing like rubber" \
  --aspect 9:16 \
  --duration 4 \
  --resolution 720p

# Wide format (16:9) for characters that move across frame
npx tsx scripts/video-generate.ts \
  --model veo \
  --image sources/wip/skyler-idle-clean.png \
  --prompt "This exact character walks forward to the left, keep identical appearance, bouncy rubberhose walk cycle" \
  --aspect 16:9 \
  --duration 4 \
  --resolution 720p
```

**Note:** `video-generate.ts` now uses fal.ai. `fal-video.ts` adds BRIA
background-removal commands for the full sprite pipeline.

### Key Findings

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

### API Setup
- fal.ai token: `FAL_KEY=...` in `.env`

## Models Reference

| Task | Best Model | Notes |
|------|------------|-------|
| Isolation | SeedEdit 3.0 | Removes unwanted elements |
| BG Removal | fal.ai BRIA video background removal | Use Transparent WebM VP9, then `process-alpha` |
| Style Edit | ChatGPT (web) | Upload reference image |
| Pose Change | ChatGPT (web) | Better style preservation |
