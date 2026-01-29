#!/bin/bash
#
# Pipeline A' (A-Prime): Video → Transparent Sprites via Replicate rembg API on grids
#
# Like Pipeline A but packs frames into 4K grids before sending to rembg,
# reducing API calls by ~6x.
#
# Usage: ./sprite-a-prime.sh <video>
#
# Steps:
#   0. loopycut             → Detect loop
#   1. extract frames       → From loop video
#   2. create_grids.py      → Pack into 4K grids
#   3. rembg API on grids   → Background removal
#   4. split grids          → Extract individual frames
#   5. fix alpha            → Compare to originals
#   6. QC + ProRes          → Output

set -e

VIDEO="$1"

if [ -z "$VIDEO" ]; then
  echo "Usage: ./sprite-a-prime.sh <video>"
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
OUTPUT="$SPRITE_TOOLS/output/${VIDEO_NAME}-pipeline-a-prime"

mkdir -p "$OUTPUT"

echo "═══════════════════════════════════════════════════════════"
echo "  PIPELINE A' (rembg on grids): $VIDEO → $OUTPUT"
echo "═══════════════════════════════════════════════════════════"

cd "$SPRITE_TOOLS"
uv run scripts/pipeline_a_prime.py "$VIDEO" "$OUTPUT" --concurrency 3

echo -e "\n═══════════════════════════════════════════════════════════"
echo "  DONE: $OUTPUT/final"
echo "═══════════════════════════════════════════════════════════"
