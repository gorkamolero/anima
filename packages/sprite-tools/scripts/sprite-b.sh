#!/bin/bash
#
# Pipeline B: Video → Transparent Sprites via Nano Banana matte extraction
#
# Usage: ./sprite-b.sh <video>
#
# Output goes to same directory as input, named <video>-sprites/
#
# Steps:
#   0. loopycut         → Detect loop
#   1. create_grids     → Frames → 4K grids  
#   2. batch_nano_banana → Grids → White/Black
#   3. extract_matte    → White/Black → Alpha
#   4. reassemble_video → Alpha → Spritesheet + Preview

set -e  # Exit on error

VIDEO="$1"

if [ -z "$VIDEO" ]; then
  echo "Usage: ./sprite-b.sh <video>"
  exit 1
fi

SCRIPTS_DIR="$(cd "$(dirname "$0")" && pwd)"
SPRITE_TOOLS="$(dirname "$SCRIPTS_DIR")"
PYTHON="$SPRITE_TOOLS/tools/loopycut/.venv/bin/python"
LOOPYCUT="$SPRITE_TOOLS/tools/loopycut/cli.py"

# Output directory: sprite-tools/output/<basename>
VIDEO_NAME="$(basename "$VIDEO" | sed 's/\.[^.]*$//')"
OUTPUT="$SPRITE_TOOLS/output/$VIDEO_NAME"

mkdir -p "$OUTPUT"

echo "═══════════════════════════════════════════════════════════"
echo "  PIPELINE B: $VIDEO → $OUTPUT"
echo "═══════════════════════════════════════════════════════════"

# Step 0: LoopyCut
echo -e "\n[0/4] LoopyCut — Detecting loop..."
$PYTHON "$LOOPYCUT" "$VIDEO" "$OUTPUT/loop.mp4" --save-metadata --no-audio

FRAMES=$(jq -r '.loop_info.frame_count' "$OUTPUT/loop.json")
echo "→ Detected $FRAMES frames"

# Step 1: Create Grids
echo -e "\n[1/4] Create Grids — Extracting frames..."
$PYTHON "$SCRIPTS_DIR/create_grids.py" "$OUTPUT/loop.mp4" -o "$OUTPUT/grids" --frames "$FRAMES"

# Step 2: Nano Banana
echo -e "\n[2/4] Nano Banana — Generating white/black versions..."
$PYTHON "$SCRIPTS_DIR/batch_nano_banana.py" "$OUTPUT/grids" -o "$OUTPUT/processed"

# Step 3: Extract Matte
echo -e "\n[3/4] Extract Matte — Calculating alpha..."
$PYTHON "$SCRIPTS_DIR/extract_matte.py" "$OUTPUT/processed" -o "$OUTPUT/alpha"

# Step 4: Reassemble
echo -e "\n[4/4] Reassemble — Building spritesheet..."
$PYTHON "$SCRIPTS_DIR/reassemble_video.py" "$OUTPUT/grids" --alpha-dir "$OUTPUT/alpha" -o "$OUTPUT/final"

echo -e "\n═══════════════════════════════════════════════════════════"
echo "  DONE: $OUTPUT/final"
echo "═══════════════════════════════════════════════════════════"
