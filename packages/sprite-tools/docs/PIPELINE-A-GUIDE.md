# Pipeline A: Install & Run Guide

Extracts transparent sprite frames from AI-generated video using **LoopyCut** (loop detection) + **Replicate rembg** (background removal) + **alpha fix** (edge correction).

## Prerequisites

- **Python 3.10+**
- **uv** (Python package runner) — `brew install uv` or `pip install uv`
- **ffmpeg** — `brew install ffmpeg`
- **jq** — `brew install jq`
- **Replicate API token** — get one at [replicate.com](https://replicate.com)

## Setup

### 1. Navigate to sprite-tools

```bash
cd sprite-tools
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

### 3. Set your Replicate token

Create a `.env` file in the project root (or wherever your env is sourced):

```
REPLICATE_API_TOKEN=your_token_here
```

The wrapper script sources this file before running. Edit the `source` line in `sprite-a.sh` if your `.env` lives elsewhere.

### 4. Verify dependencies

Pipeline A's Python deps are managed by `uv` automatically (declared inline in the script):
- requests, pillow, click, numpy, opencv-python

No manual `pip install` needed — `uv run` handles it.

## Run

### Quick (recommended)

```bash
bash scripts/sprite-a.sh path/to/video.mp4
```

Output lands in `output/<video-name>-pipeline-a/`.

### What it does

1. **LoopyCut** — scans the video for a seamless loop, trims to `loop.mp4`
2. **Frame extraction** — pulls individual frames from the loop (auto-crops letterboxing)
3. **rembg** — sends each frame to Replicate's background removal API
4. **Alpha fix** — compares against originals, restores pixels incorrectly made transparent
5. **Output** — ProRes 4444 video + magenta preview + QC grid

### Manual (with options)

```bash
# Direct Python call (includes LoopyCut)
uv run scripts/pipeline_a.py video.mp4 ./output/my-run

# Skip LoopyCut (if you already have a trimmed loop)
uv run scripts/pipeline_a.py loop.mp4 ./output/my-run --skip-loopycut

# With options
uv run scripts/pipeline_a.py video.mp4 ./output/my-run \
  --concurrency 5 \
  --fps 24 \
  --bg-tolerance 20
```

### Options

| Flag | Default | Description |
|------|---------|-------------|
| `--concurrency` | 3 | Parallel rembg API calls |
| `--fps` | 24 | Output video framerate |
| `--alpha-threshold` | 128 | Binary alpha cutoff |
| `--bg-tolerance` | 15 | How close to gray counts as background |
| `--crop-top` | auto | Manual letterbox crop (pixels) |
| `--crop-bottom` | auto | Manual letterbox crop (pixels) |
| `--no-auto-crop` | false | Disable letterbox detection |
| `--skip-loopycut` | false | Skip loop detection (use input as-is) |
| `--frames` | auto | Limit to N frames |

## Output

```
output/<name>-pipeline-a/
├── loop.mp4             # Trimmed loop video
├── loop.json            # Loop metadata (frame count, similarity, etc.)
└── final/
    ├── frames-raw/      # Extracted source frames
    ├── frames/          # rembg output (raw alpha)
    ├── frames-fixed/    # After alpha correction ← final frames
    ├── output.mov       # ProRes 4444 with transparency
    ├── preview_magenta.mp4  # QC preview
    └── qc-faces.png     # Face region grid for inspection
```

## Cost

- **~$0.001/frame** via Replicate rembg (CPU model, 3-5s each)
- 26 frames ≈ **$0.03**

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `REPLICATE_API_TOKEN not found` | Add token to your `.env` and check the `source` path in `sprite-a.sh` |
| LoopyCut finds no loop | Video may not have a clean loop — use `--skip-loopycut` and `--frames N` |
| Skin going transparent | Increase `--bg-tolerance` to 20-25, or use Pipeline B |
| DNS errors on Replicate | Network issue — retry, or check connectivity |
| LoopyCut OOM killed | Add `--downsample 2` to the loopycut call (already default in wrapper) |
| 96 frames instead of 26 | LoopyCut didn't run — use `sprite-a.sh` or call `pipeline_a.py` directly (it includes LoopyCut) |
