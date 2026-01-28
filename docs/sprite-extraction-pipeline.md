# Sprite Extraction Pipeline

## Overview

Extract transparent sprites from AI-generated video.

---

## Current Method: Nano Banana Color Transform + Difference Matting

**Status:** In development (2026-01-28)

### Workflow

1. **Source Video** → Start with AI-generated walk cycle video (e.g., `ashley-walk-source.mov`)

2. **Crop Letterbox** → Remove black bars (top/bottom) to get clean gray background
   ```bash
   ffmpeg -i source.mov -vf "crop=360:540:0:50" cropped.mov
   ```

3. **Extract Frames** → Pull frames from video
   ```bash
   ffmpeg -i cropped.mov frames/frame-%02d.png
   ```

4. **Create Grid** → Assemble frames into 3×2 grid at Nano Banana output resolution
   - Use 4K 2:3 aspect ratio: **3392×5056**
   - 6 frames per grid (3 columns × 2 rows)

5. **Nano Banana Transform** → Generate solid color background variants
   - Gray original → Pure RED (#FF0000)
   - Use exact Nano Banana output sizes to ensure pixel alignment

6. **Difference Matting** → Compare gray vs red to calculate alpha
   ```
   alpha = 1 - (pixelDist / bgDist)
   ```

7. **Split Grid** → Extract individual transparent frames

8. **Assemble Video** → ProRes 4444 with alpha

### Nano Banana Output Sizes

| Aspect | 1K | 2K | 4K |
|--------|----|----|-------|
| 2:3 | 848×1264 | 1696×2528 | **3392×5056** |
| 3:2 | 1264×848 | 2528×1696 | 5056×3392 |
| 1:1 | 1024×1024 | 2048×2048 | 4096×4096 |

**Critical:** Input grids must match these exact sizes for consistent output.

### File Locations

- Source video: `~/www/anima/ashley-walk-source.mov`
- Working directory: `/tmp/method-b-v3/` (session temp)
- Scripts: `~/www/anima/packages/sprite-tools/scripts/`

---

## Alternative: rembg via Replicate API

For cases where difference matting doesn't work.

- Cost: ~$0.0023/frame
- Requires `fix_alpha.py` post-processing
- Scripts: `rembg_batch.py`, `fix_alpha.py`, `auto_qc_v2.py`

### Known Issue
rembg confuses skin shadows (~RGB 130-140) with gray background (~RGB 130). Use `fix_alpha.py` to compare against original and restore incorrectly transparent pixels.

---

## QC

Always check sprites on **magenta background** — reveals artifacts invisible on white/gray.

Script: `qc_viewer.py`
