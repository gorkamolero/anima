# Video Generation Reference

## Models Comparison

| Model | API | Cost | Quality | Notes |
|-------|-----|------|---------|-------|
| **Veo 3.1** | Replicate | $0.10/sec (~$0.40/4s) | ✅ Best | Winner for rubberhose |
| Sora 2 Pro | Replicate | $0.10/sec | ❌ Low | Content filter issues |
| Luma Ray Flash 2 | Replicate | $0.033/sec | ❌ Poor | Has loop option but quality insufficient |
| Minimax Video-01-Live | Replicate | ~$0.50/video | ❌ Poor | Animation focus but not rubberhose |

## Veo 3.1 via Replicate

### Model ID
```
google/veo-3.1
```

### Input Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `prompt` | string | Action description |
| `image` | data URI | Base64 input image |
| `duration` | int | Video length (4s default) |
| `aspect_ratio` | string | "9:16", "16:9", "1:1" |
| `generate_audio` | bool | Include audio (false for sprites) |

### Script Usage

```bash
npx tsx scripts/video-generate.ts \
  --model veo \
  --image path/to/image.png \
  --prompt "action description" \
  --aspect 9:16
```

### Aspect Ratio Guidelines

- **9:16 (portrait)**: Character stays in frame, vertical motion
- **16:9 (landscape)**: Character moves horizontally across frame
- **1:1 (square)**: Centered action

## Rubberhose Animation Style

1920s-30s cartoon style (Betty Boop, Cuphead, early Mickey Mouse):
- Fluid, bouncy limb movements
- Arms/legs swing like rubber hoses (no joints)
- Exaggerated squash & stretch
- Rhythmic, musical motion

### Prompt Keywords

**Style references:**
- "Cuphead animation style"
- "Betty Boop Fleischer cartoon"
- "rubberhose animation"
- "1920s cartoon"

**Motion descriptors:**
- "bouncy walk cycle"
- "rubber limbs with no joints"
- "arms bend like rubber tubes"
- "smooth flowing motion"
- "exaggerated squash and stretch"

### Working Prompt Templates

**Walk cycle:**
```
This exact character walks forward to the left, keep identical appearance,
Cuphead animation style, Betty Boop Fleischer cartoon,
rubberhose limbs with no joints, bouncy rhythmic walk cycle,
arms bend like rubber tubes, smooth flowing motion
```

**Evil walk:**
```
This exact character walks forward to the left with an evil sinister strut,
keep identical appearance, exaggerated bouncy Cuphead rubberhose animation,
limbs bend like rubber with no joints, menacing swagger
```

**Idle animation:**
```
Subtle idle animation, gentle breathing motion, slight body sway,
rubberhose cartoon style, 1920s animation, smooth fluid movement
```

## Common Mistakes

❌ **Overstuffed prompts** - Don't describe the image (model sees it)
❌ **Wrong direction** - Check which way character faces before prompting
❌ **Walking pose → walking video** - Use standing pose as input
❌ **Too many style keywords** - Action first, then minimal style refs

## Character Preservation

Key phrase for maintaining character identity:
```
"This exact character... keep identical appearance"
```

This tells Veo to match the input image closely rather than generating a generic interpretation.
