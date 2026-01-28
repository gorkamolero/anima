# Pipeline B: Install & Run Guide

Extracts transparent sprite frames from AI-generated video using **LoopyCut** (loop detection) + **Nano Banana Pro** (semantic background separation via Gemini) + **difference matting** (alpha extraction).

## Prerequisites

- **Python 3.10+**
- **uv** (Python package runner) — `brew install uv` or `pip install uv`
- **ffmpeg** — `brew install ffmpeg`
- **jq** — `brew install jq`
- **Gemini API key** — get one at [aistudio.google.com](https://aistudio.google.com)

## Setup

### 1. Clone & navigate

```bash
cd ~/www/anima/packages/sprite-tools
```

### 2. Set up LoopyCut

```bash
cd tools/loopycut
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
deactivate
cd ../..
```

### 3. Set your Gemini API key

Create or edit `~/www/anima/.env`:

```
GEMINI_API_KEY=your_key_here
```

### 4. Verify dependencies

Pipeline B's Python deps are managed by `uv` automatically. No manual install needed.

## Run

### Quick (recommended)

```bash
bash scripts/sprite-b.sh path/to/video.mp4
```

Output lands in `output/<video-name>-pipeline-b/`.

### What it does

1. **LoopyCut** — scans for seamless loop, trims to `loop.mp4`
2. **Create grids** — packs frames into 4K grids (3392×5056, 6 frames per grid)
3. **Nano Banana** — transforms each grid twice: gray→white and gray→black
4. **Difference matte** — where white and black differ = background = transparent
5. **Reassemble** — splits grids back to frames, outputs ProRes 4444 + preview

### How the matte works

The key insight: Nano Banana understands "character vs background" semantically. By rendering on both pure white and pure black, any pixel that changes between the two is background. Character pixels stay the same on both. This gives pixel-perfect alpha without any edge artifacts.

### Manual (step by step)

```bash
cd ~/www/anima/packages/sprite-tools

# Step 1: Create grids from video
uv run scripts/create_grids.py input.mp4 -o ./grids --frames 26

# Step 2: Process through Nano Banana (white + black)
uv run scripts/batch_nano_banana.py ./grids -o ./processed

# Step 3: Extract alpha from white/black pairs
uv run scripts/extract_matte.py ./processed -o ./alpha

# Step 4: Reassemble video
uv run scripts/reassemble_video.py ./grids --alpha-dir ./alpha -o ./final
```

## Output

```
output/<name>-pipeline-b/
├── loop.mp4             # Trimmed loop video
├── loop.json            # Loop metadata
├── grids/               # Source frames packed into 4K grids
│   ├── grid-01-gray.png
│   ├── grid-02-gray.png
│   └── metadata.json
├── processed/           # Nano Banana output
│   ├── grid-01-white.png
│   ├── grid-01-black.png
│   └── ...
├── alpha/               # Extracted alpha mattes
│   ├── grid-01-alpha.png
│   └── ...
└── final/               # Final output
    ├── frame_000.png    # Individual transparent frames
    ├── frame_001.png
    └── ...              # 26 frames total
```

## Grid sizes

Nano Banana has fixed output sizes. Grids must match exactly:

| Aspect | 1K | 2K | 4K |
|--------|----|----|-------|
| 2:3 | 848×1264 | 1696×2528 | 3392×5056 |
| 3:2 | 1264×848 | 2528×1696 | 5056×3392 |

We use **3×2 grids at 4K 2:3 (3392×5056)** — fits 6 portrait frames per grid.

## Cost

- Gemini Imagen 3: ~$0.04/image (**currently FREE** in preview, 50/day limit)
- 2 calls per grid (white + black)
- 26 frames = 5 grids = 10 API calls ≈ **$0.40** (free during preview)

## When to use Pipeline B vs A

| | Pipeline A (rembg) | Pipeline B (Nano Banana) |
|---|---|---|
| **Best for** | Non-gray backgrounds, simple subjects | Gray backgrounds, skin tones |
| **Cost** | ~$0.03 | ~$0.40 (free in preview) |
| **Speed** | ~2 min | ~5 min |
| **Quality** | Good with alpha fix | Production quality |

**Decision tree:**
- Gray background + skin tones → **Pipeline B**
- White/black background → **Pipeline A**
- Budget-constrained → **Pipeline A**

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `GEMINI_API_KEY` not found | Add key to `~/www/anima/.env` |
| Grid misalignment | Check grid dimensions match Nano Banana output sizes exactly |
| Dirty white/black background | Nano Banana didn't fully convert — regenerate with clearer prompt |
| LoopyCut OOM killed | Add `--downsample 2` (already default in wrapper scripts) |
| API rate limit (50/day) | Wait or use a different API key |
