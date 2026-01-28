#!/bin/bash
#
# Sprite Pipeline B: Video → Transparent Sprites via Nano Banana Matte Extraction
#
# This pipeline extracts clean alpha-transparent sprites from AI-generated character
# animations by leveraging Gemini 3 Pro Image's consistency to create white/black
# background variants, then mathematically extracting the true alpha matte.
#
# ┌─────────────────────────────────────────────────────────────────────────────────┐
# │  THE TECHNIQUE                                                                   │
# │                                                                                  │
# │  Traditional AI image generation can't produce true transparency. This pipeline │
# │  uses a clever workaround:                                                       │
# │                                                                                  │
# │  1. Take each frame and use an image model to render it on pure white (#FFFFFF) │
# │  2. Render the same frame on pure black (#000000)                               │
# │  3. The difference between these two versions reveals the true alpha:           │
# │                                                                                  │
# │     • Where pixels are identical → fully opaque (alpha = 1.0)                   │
# │     • Where pixels differ maximally → fully transparent (alpha = 0.0)           │
# │     • Gradients between → semi-transparent edges                                │
# │                                                                                  │
# │  Math: alpha = 1 - (white_pixel - black_pixel)                                 │
# │        rgb = black_pixel / alpha (when alpha > 0)                               │
# └─────────────────────────────────────────────────────────────────────────────────┘
#
# REQUIREMENTS:
#   - Python 3.10+
#   - Gemini API key (for batch_nano_banana.py)
#   - ffmpeg
#   - loopycut (for seamless loop detection)
#
# USAGE:
#   ./sprite-pipeline-b.sh <input_video.mp4>
#
# OUTPUT:
#   output/<video_name>/
#   ├── loop.mp4              # Detected seamless loop
#   ├── loop.json             # Loop metadata (frame count, timestamps)
#   ├── grids/                # 4K grids of frames (6 frames per grid)
#   │   └── grid-01-gray.png, grid-02-gray.png, ...
#   ├── processed/            # Nano Banana output
#   │   ├── grid-01-white.png # White background variant
#   │   └── grid-01-black.png # Black background variant
#   ├── alpha/                # Extracted alpha mattes
#   │   └── grid-01-alpha.png # RGBA with computed transparency
#   └── final/                # Final sprites
#       ├── frame_000.png ... frame_NNN.png
#       └── preview_magenta.mp4  # Preview with magenta background
#
# ═══════════════════════════════════════════════════════════════════════════════════

set -e  # Exit on first error

VIDEO="$1"

if [ -z "$VIDEO" ]; then
  echo "Usage: ./sprite-pipeline-b.sh <video>"
  exit 1
fi

# Resolve paths
SCRIPTS_DIR="$(cd "$(dirname "$0")" && pwd)"
SPRITE_TOOLS="$(dirname "$SCRIPTS_DIR")"
PYTHON="$SPRITE_TOOLS/tools/loopycut/.venv/bin/python"
LOOPYCUT="$SPRITE_TOOLS/tools/loopycut/cli.py"

# Output directory
VIDEO_NAME="$(basename "$VIDEO" | sed 's/\.[^.]*$//')"
OUTPUT="$SPRITE_TOOLS/output/$VIDEO_NAME"
mkdir -p "$OUTPUT"

echo "═══════════════════════════════════════════════════════════"
echo "  PIPELINE B: $VIDEO → $OUTPUT"
echo "═══════════════════════════════════════════════════════════"

# ─────────────────────────────────────────────────────────────────
# STEP 0: LOOP DETECTION
# ─────────────────────────────────────────────────────────────────
# Uses loopycut to find the seamless loop point in the video.
# AI-generated walk cycles often have a natural loop that loopycut
# can detect automatically.
echo -e "\n[0/4] LoopyCut — Detecting seamless loop..."
$PYTHON "$LOOPYCUT" "$VIDEO" "$OUTPUT/loop.mp4" --save-metadata --no-audio

FRAMES=$(jq -r '.loop_info.frame_count' "$OUTPUT/loop.json")
echo "→ Detected $FRAMES frames"

# ─────────────────────────────────────────────────────────────────
# STEP 1: CREATE GRIDS
# ─────────────────────────────────────────────────────────────────
# Extracts individual frames and arranges them into 4K grids.
# Grids are more efficient for batch processing with Nano Banana
# (fewer API calls, better context for the model).
#
# Grid layout: 2 columns × 3 rows = 6 frames per grid
# Grid size: 4096 × 4096 (maximum for Gemini image generation)
# Cell size: ~1365 × 2048 (scaled down from frame size)
echo -e "\n[1/4] Create Grids — Extracting frames to 4K grids..."
$PYTHON "$SCRIPTS_DIR/create_grids.py" "$OUTPUT/loop.mp4" -o "$OUTPUT/grids" --frames "$FRAMES"

# ─────────────────────────────────────────────────────────────────
# STEP 2: NANO BANANA (Gemini 3 Pro Image)
# ─────────────────────────────────────────────────────────────────
# For each grid, generates two variants:
#   - White background (#FFFFFF)
#   - Black background (#000000)
#
# The prompt asks the model to place the EXACT same character poses
# on the solid color background, maintaining pixel-level consistency.
# This works because Gemini 3 can "see" the input and reproduce it
# with high fidelity while changing only the background.
echo -e "\n[2/4] Nano Banana — Generating white/black variants..."
$PYTHON "$SCRIPTS_DIR/batch_nano_banana.py" "$OUTPUT/grids" -o "$OUTPUT/processed"

# ─────────────────────────────────────────────────────────────────
# STEP 3: EXTRACT MATTE
# ─────────────────────────────────────────────────────────────────
# Compares white and black versions pixel-by-pixel to compute alpha.
#
# The math:
#   For each pixel (r, g, b) in white and black images:
#     alpha = 1 - average(white - black)
#     color = black / alpha  (premultiplied alpha unmultiplication)
#
# This produces true RGBA with smooth anti-aliased edges.
echo -e "\n[3/4] Extract Matte — Computing alpha from white/black difference..."
$PYTHON "$SCRIPTS_DIR/extract_matte.py" "$OUTPUT/processed" -o "$OUTPUT/alpha"

# ─────────────────────────────────────────────────────────────────
# STEP 4: REASSEMBLE
# ─────────────────────────────────────────────────────────────────
# Splits the alpha grids back into individual frames.
# Creates PNG sequence and preview video.
echo -e "\n[4/4] Reassemble — Splitting grids to PNG sequence..."
$PYTHON "$SCRIPTS_DIR/reassemble_video.py" "$OUTPUT/grids" --alpha-dir "$OUTPUT/alpha" -o "$OUTPUT/final"

echo -e "\n═══════════════════════════════════════════════════════════"
echo "  ✓ COMPLETE: $OUTPUT/final"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "Output files:"
echo "  • PNG sequence: $OUTPUT/final/frame_*.png"
echo "  • Preview:      $OUTPUT/final/preview_magenta.mp4"
