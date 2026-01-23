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
- Replicate token: `REPLICATE_API_TOKEN=...` in `.env`

## Models Reference

| Task | Best Model | Notes |
|------|------------|-------|
| Isolation | SeedEdit 3.0 | Removes unwanted elements |
| BG Removal | lucataco/remove-bg | Preserves limbs |
| Style Edit | ChatGPT (web) | Upload reference image |
| Pose Change | ChatGPT (web) | Better style preservation |
