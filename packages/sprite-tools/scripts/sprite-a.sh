#!/bin/bash
#
# Pipeline A: Video → Transparent Sprites via Replicate rembg API
#
# Usage: ./sprite-a.sh <video>
#
# This pipeline uses ML-based background removal (rembg model on Replicate).
# Simpler than Pipeline B but may have worse edge quality on complex subjects.
#
# Requires: REPLICATE_API_TOKEN environment variable
#
# Steps:
#   0. loopycut         → Detect loop
#   1. extract frames   → Video → PNGs
#   2. rembg API        → Background removal per frame
#   3. threshold alpha  → Clean up semi-transparent artifacts
#   4. reassemble       → PNG sequence + preview

set -e

VIDEO="$1"

if [ -z "$VIDEO" ]; then
  echo "Usage: ./sprite-a.sh <video>"
  exit 1
fi

if [ -z "$REPLICATE_API_TOKEN" ]; then
  echo "Error: REPLICATE_API_TOKEN environment variable required"
  exit 1
fi

SCRIPTS_DIR="$(cd "$(dirname "$0")" && pwd)"
SPRITE_TOOLS="$(dirname "$SCRIPTS_DIR")"
PYTHON="$SPRITE_TOOLS/tools/loopycut/.venv/bin/python"
LOOPYCUT="$SPRITE_TOOLS/tools/loopycut/cli.py"

VIDEO_NAME="$(basename "$VIDEO" | sed 's/\.[^.]*$//')"
OUTPUT="$SPRITE_TOOLS/output/${VIDEO_NAME}-pipeline-a"

mkdir -p "$OUTPUT"

echo "═══════════════════════════════════════════════════════════"
echo "  PIPELINE A (rembg): $VIDEO → $OUTPUT"
echo "═══════════════════════════════════════════════════════════"

# Step 0: LoopyCut
echo -e "\n[0/2] LoopyCut — Detecting loop..."
$PYTHON "$LOOPYCUT" "$VIDEO" "$OUTPUT/loop.mp4" --save-metadata --no-audio

FRAMES=$(jq -r '.loop_info.frame_count' "$OUTPUT/loop.json")
echo "→ Detected $FRAMES frames"

# Step 1: Run pipeline_a.py (handles extraction, rembg, threshold, reassembly)
echo -e "\n[1/2] Pipeline A — Running rembg background removal..."
$PYTHON "$SCRIPTS_DIR/pipeline_a.py" "$OUTPUT/loop.mp4" "$OUTPUT/final" --concurrency 5

# Step 2: Create preview videos
echo -e "\n[2/2] Creating preview videos..."

# Magenta background preview
ffmpeg -y -framerate 24 \
  -i "$OUTPUT/final/frames/frame-%03d.png" \
  -filter_complex "color=c=magenta:s=720x1080:r=24[bg];[bg][0:v]overlay=(W-w)/2:(H-h)/2:format=auto" \
  -c:v libx264 -crf 18 -pix_fmt yuv420p \
  -t $(echo "scale=2; $FRAMES / 24" | bc) \
  "$OUTPUT/final/preview_magenta.mp4" 2>/dev/null || echo "Preview creation skipped"

echo -e "\n═══════════════════════════════════════════════════════════"
echo "  DONE: $OUTPUT/final"
echo "═══════════════════════════════════════════════════════════"
