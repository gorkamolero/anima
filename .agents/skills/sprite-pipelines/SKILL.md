---
name: sprite-pipelines
description: Extract transparent sprite frames from AI-generated video using two pipelines. Use when asked to extract sprites, remove backgrounds from video frames, create spritesheets, run Pipeline A (rembg), run Pipeline B (Nano Banana), or process character animation video into transparent PNGs. Triggers on 'sprite extraction', 'pipeline A/B', 'remove background from video', 'transparent sprites', 'spritesheet from video'.
---

# Sprite Extraction Pipelines

Two pipelines for extracting transparent sprite frames from AI-generated video. Scripts at `packages/sprite-tools/scripts/`.

## Pipeline A (rembg) — Fast & Cheap

Uses Replicate's rembg API for background removal + alpha correction.

```bash
cd packages/sprite-tools
bash scripts/sprite-a.sh path/to/video.mp4
```

**Output:** `output/<name>-pipeline-a/final/` (transparent PNGs + ProRes 4444)

**Steps:** LoopyCut (loop detect) → frame extraction → rembg API → alpha fix → ProRes + QC

**Cost:** ~$0.03 for 26 frames

**Best for:** Non-gray backgrounds, simple subjects, budget runs

**Requires:** `REPLICATE_API_TOKEN` in `~/www/anima/.env`

### Options (via pipeline_a.py directly)

```bash
uv run scripts/pipeline_a.py video.mp4 ./output --concurrency 5 --bg-tolerance 20 --skip-loopycut
```

| Flag | Default | Purpose |
|------|---------|---------|
| `--concurrency` | 3 | Parallel API calls |
| `--bg-tolerance` | 15 | How close to gray = background |
| `--skip-loopycut` | false | Skip loop detection |
| `--frames` | auto | Limit frame count |

## Pipeline B (Nano Banana) — Production Quality

Uses Gemini's image model for semantic background separation via difference matting.

```bash
cd packages/sprite-tools
bash scripts/sprite-b.sh path/to/video.mp4
```

**Output:** `output/<name>-pipeline-b/final/` (transparent PNGs)

**Steps:** LoopyCut → grid packing (6 frames/grid, 4K) → Nano Banana (gray→white + gray→black) → difference matte → reassemble

**Cost:** ~$0.40 (free during Gemini preview, 50/day limit)

**Best for:** Gray backgrounds, skin tones, production quality

**Requires:** `GEMINI_API_KEY` in `~/www/anima/.env`

### How the matte works

Nano Banana renders each grid on pure white AND pure black. Any pixel that differs between the two = background = transparent. Character pixels stay identical on both. Pixel-perfect alpha.

### Concurrency

`batch_nano_banana.py` runs grids in parallel (default 5, configurable via `--concurrency`). 2-second delay between API calls per grid.

## Comparison

```bash
bash scripts/compare-pipelines.sh path/to/video.mp4
```

Creates 3-panel side-by-side video: SOURCE (original) | PIPELINE A (magenta) | PIPELINE B (light blue).

## Decision Tree

- Gray background + skin tones → **Pipeline B**
- White/black background → **Pipeline A**
- Budget-constrained → **Pipeline A**
- Production quality needed → **Pipeline B**

## Script Map

| Script | Role |
|--------|------|
| `sprite-a.sh` | Pipeline A entry point |
| `sprite-b.sh` | Pipeline B entry point |
| `pipeline_a.py` | Pipeline A logic (rembg + alpha fix) |
| `pipeline_b.py` | Pipeline B orchestrator (Python entry) |
| `batch_nano_banana.py` | Parallel Nano Banana processing |
| `create_grids.py` | Frame → 4K grid packing |
| `extract_matte.py` | White/black → alpha matte |
| `reassemble_video.py` | Alpha + grids → final frames |
| `compare-pipelines.sh` | Side-by-side comparison |

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `REPLICATE_API_TOKEN not found` | Add to `~/www/anima/.env` |
| `GEMINI_API_KEY not found` | Add to `~/www/anima/.env` |
| LoopyCut OOM | Close competing processes, reduce video length |
| Skin going transparent (A) | Increase `--bg-tolerance` to 20-25, or use Pipeline B |
| Empty loop.mp4 | LoopyCut trim failed — check video has a detectable loop |
| Nano Banana rate limit | 50/day on free tier — wait or use paid key |
