#!/bin/bash
#
# Pipeline A: Video → Transparent Sprites via Replicate rembg API
#
# Usage: ./sprite-a.sh <video>
#
# Steps:
#   0. loopycut         → Detect loop
#   1. pipeline_a.py    → Extract frames, rembg API, fix_alpha, reassemble

set -e

VIDEO="$1"

if [ -z "$VIDEO" ]; then
  echo "Usage: ./sprite-a.sh <video>"
  exit 1
fi

# Load token
set -a
source ~/www/anima/.env
set +a

if [ -z "$REPLICATE_API_TOKEN" ]; then
  echo "Error: REPLICATE_API_TOKEN not found in ~/www/anima/.env"
  exit 1
fi

SCRIPTS_DIR="$(cd "$(dirname "$0")" && pwd)"
SPRITE_TOOLS="$(dirname "$SCRIPTS_DIR")"

VIDEO_NAME="$(basename "$VIDEO" | sed 's/\.[^.]*$//')"
OUTPUT="$SPRITE_TOOLS/output/${VIDEO_NAME}-pipeline-a"

mkdir -p "$OUTPUT"

echo "═══════════════════════════════════════════════════════════"
echo "  PIPELINE A (rembg): $VIDEO → $OUTPUT"
echo "═══════════════════════════════════════════════════════════"

# Step 0: LoopyCut
echo -e "\n[0/1] LoopyCut — Detecting loop..."
source "$SPRITE_TOOLS/tools/loopycut/.venv/bin/activate"
python "$SPRITE_TOOLS/tools/loopycut/cli.py" "$VIDEO" "$OUTPUT/loop.mp4" --save-metadata --no-audio
deactivate

FRAMES=$(jq -r '.loop_info.frame_count' "$OUTPUT/loop.json")
echo "→ Detected $FRAMES frames"

# Step 1: Run pipeline_a.py
echo -e "\n[1/1] Pipeline A — Running rembg + fix_alpha..."
cd "$SPRITE_TOOLS"
uv run scripts/pipeline_a.py "$OUTPUT/loop.mp4" "$OUTPUT/final" --concurrency 5

echo -e "\n═══════════════════════════════════════════════════════════"
echo "  DONE: $OUTPUT/final"
echo "═══════════════════════════════════════════════════════════"
