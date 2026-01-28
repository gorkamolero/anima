# Sprite Extraction Pipelines

Two methods for extracting transparent sprites from AI-generated video.

## Quick Reference

| Pipeline | Cost (26 frames) | Speed | Best For |
|----------|------------------|-------|----------|
| **A (RemBG)** | ~$0.03 | ~10s/frame | Non-gray backgrounds, simple subjects |
| **B (Nano Banana)** | ~$0.40 (free in preview) | ~2s/grid | Gray backgrounds, skin tones, production quality |

## Pipeline A: RemBG

Uses Replicate's rembg API with alpha correction.

### How It Works

1. Extract frames from video (with auto letterbox detection)
2. Send each frame to rembg API → raw alpha mask
3. **Fix alpha** — compare to original, restore pixels rembg incorrectly made transparent
4. Threshold alpha to clean edges
5. Output ProRes 4444 + preview

### When to Use

- ✅ White or black backgrounds
- ✅ Simple subjects without skin tones
- ✅ Budget-constrained batches
- ⚠️ Gray backgrounds — works with fix_alpha, but B is cleaner
- ❌ Complex skin tones on gray — still marginal

### Usage

```bash
cd ~/www/anima/packages/sprite-tools

# Basic
uv run scripts/pipeline_a.py input.mp4 ./output

# With options
uv run scripts/pipeline_a.py input.mp4 ./output \
  --concurrency 3 \
  --fps 24 \
  --bg-tolerance 15
```

### Options

| Flag | Default | Description |
|------|---------|-------------|
| `--concurrency` | 3 | Parallel API calls |
| `--fps` | 24 | Output video framerate |
| `--alpha-threshold` | 128 | Binary alpha cutoff |
| `--bg-tolerance` | 15 | How close to gray (130,130,130) counts as background |
| `--crop-top` | auto | Manual letterbox crop |
| `--crop-bottom` | auto | Manual letterbox crop |
| `--no-auto-crop` | false | Disable letterbox detection |

### Output Structure

```
output/
├── frames-raw/      # Extracted source frames (cropped)
├── frames/          # Raw rembg output
├── frames-fixed/    # After fix_alpha correction ← final frames
├── qc-faces.png     # Face region grid for QC
├── output.mov       # ProRes 4444 with alpha
└── preview_magenta.mp4  # QC preview on magenta
```

### Cost

- Replicate rembg: ~$0.001/frame (CPU, ~3-5s each)
- 26 frames ≈ $0.03

### Requirements

- `REPLICATE_API_TOKEN` environment variable

---

## Pipeline B: Nano Banana Matte Extraction

Uses Gemini's image model to semantically separate character from background, then difference matting for alpha.

### How It Works

1. Extract frames from video
2. Pack frames into grids at **exact** Nano Banana output sizes
3. Transform gray → pure white via Nano Banana
4. Transform gray → pure black via Nano Banana
5. **Difference matte** — where white and black differ = background = transparent
6. Split grids back to frames
7. Output ProRes 4444 + preview

### Why It Works Better

- Nano Banana understands "character vs background" semantically
- No confusion between skin shadows and gray background
- Pixel-perfect alpha from difference math

### When to Use

- ✅ Gray backgrounds (the default for AI video)
- ✅ Skin tones and complex subjects
- ✅ Production quality needed
- ❌ Non-standard backgrounds (needs gray)

### Usage

```bash
cd ~/www/anima/packages/sprite-tools

# Step 1: Create grids from video
uv run scripts/create_grids.py input.mp4 --output-dir ./grids --frames 26

# Step 2: Process through Nano Banana (white + black)
uv run scripts/batch_nano_banana.py ./grids --output-dir ./processed

# Step 3: Extract alpha from white/black pairs
uv run scripts/extract_matte.py ./processed --output-dir ./alpha

# Step 4: Reassemble video
uv run scripts/reassemble_video.py ./alpha --output ./output.mov --fps 24
```

Or use the wrapper:

```bash
uv run scripts/pipeline_b.py input.mp4 ./output --frames 26
```

### Critical Constraint: Grid Sizes

Nano Banana has **fixed output sizes**. Input grids must match exactly for pixel-perfect alignment:

| Aspect | 1K | 2K | 4K |
|--------|----|----|-------|
| 1:1 | 1024×1024 | 2048×2048 | 4096×4096 |
| 2:3 | 848×1264 | 1696×2528 | **3392×5056** |
| 3:2 | 1264×848 | 2528×1696 | 5056×3392 |
| 9:16 | 768×1376 | 1536×2752 | 3072×5504 |
| 16:9 | 1376×768 | 2752×1536 | 5504×3072 |

We use **3×2 grids at 4K 2:3 (3392×5056)** — fits 6 portrait frames per grid.

### Cost

- Gemini Imagen 3: ~$0.04/image (currently FREE in preview, 50/day limit)
- 2 calls per grid (white + black)
- 26 frames = 5 grids = 10 API calls ≈ $0.40

### Requirements

- `GEMINI_API_KEY` environment variable
- Nano Banana skill installed (`~/.clawdbot/skills/nano-banana-pro/`)

---

## QC Checklist

Always verify output before declaring success:

1. **Preview on magenta** — reveals alpha artifacts invisible on white/gray
2. **Check face regions** — skin shadows are the failure mode
3. **Scrub full sequence** — some frames may fail while others pass
4. **Compare to source** — ensure no color drift

---

## Troubleshooting

### Pipeline A: Skin going transparent

- Increase `--bg-tolerance` (try 20-25)
- Check that fix_alpha step is running (look for "fixed N pixels" output)
- If still failing, use Pipeline B

### Pipeline B: Misaligned matte

- Grid dimensions don't match Nano Banana output sizes
- Verify input grid is exact (e.g., 3392×5056 for 4K 2:3)
- Check `create_grids.py` is using correct target size

### Pipeline B: Dirty background in white/black

- Nano Banana didn't fully convert background
- Run `batch_nano_banana.py` with `--eval` to check corner samples
- May need to regenerate with clearer prompt

---

## Decision Tree

```
Is background gray?
├─ No → Pipeline A (rembg)
└─ Yes → Does subject have skin tones?
         ├─ No → Pipeline A (cheaper)
         └─ Yes → Pipeline B (Nano Banana)
```

---

## References

- **Pipeline B technique**: [Generating Transparent Background Images with Nano Banana Pro](https://jidefr.medium.com/generating-transparent-background-images-with-nano-banana-pro-2-1866c88a33c5) by jidefr
  - Original article describing the white/black difference matting approach

---

## History

- **2026-01-27**: Pipeline A created, discovered skin shadow issue
- **2026-01-27**: fix_alpha.py written but not integrated
- **2026-01-28**: Pipeline B (Nano Banana) created and validated, based on jidefr's article
- **2026-01-28**: fix_alpha integrated into Pipeline A
