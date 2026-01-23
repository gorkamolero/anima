#!/bin/bash
#
# resize-sprite.sh - Resize a spritesheet while preserving grid structure
#
# Usage: ./resize-sprite.sh <sprite.png> <max-frame-height>
#
# This script:
#   1. Reads frame dimensions from the companion .json file
#   2. Calculates the scale factor to fit within max-frame-height
#   3. Resizes the entire spritesheet proportionally
#   4. Updates the JSON metadata with new frame dimensions
#
# Example:
#   ./resize-sprite.sh bartender-pour.png 600
#   # Scales 1080x1749 frames down to 370x600 frames

set -e

SPRITE="$1"
MAX_HEIGHT="$2"

if [ -z "$SPRITE" ] || [ -z "$MAX_HEIGHT" ]; then
    echo "Usage: $0 <sprite.png> <max-frame-height>"
    echo "Example: $0 bartender-pour.png 600"
    exit 1
fi

if [ ! -f "$SPRITE" ]; then
    echo "Error: Sprite file not found: $SPRITE"
    exit 1
fi

# Derive JSON path
BASE="${SPRITE%.png}"
JSON="${BASE}.json"

if [ ! -f "$JSON" ]; then
    echo "Error: JSON metadata not found: $JSON"
    exit 1
fi

# Check for ImageMagick
if ! command -v magick &> /dev/null; then
    echo "Error: ImageMagick not found. Install with: brew install imagemagick"
    exit 1
fi

# Read current dimensions from JSON
FRAME_W=$(jq -r '.frameWidth' "$JSON")
FRAME_H=$(jq -r '.frameHeight' "$JSON")
COLS=$(jq -r '.cols' "$JSON")
ROWS=$(jq -r '.rows' "$JSON")

if [ "$FRAME_H" -le "$MAX_HEIGHT" ]; then
    echo "Already within target: ${FRAME_W}x${FRAME_H} (max: $MAX_HEIGHT)"
    exit 0
fi

# Get current file size
BEFORE_SIZE=$(stat -f%z "$SPRITE" 2>/dev/null || stat -c%s "$SPRITE")
BEFORE_MB=$(echo "scale=1; $BEFORE_SIZE / 1048576" | bc)

# Calculate scale factor (preserve aspect ratio)
SCALE=$(echo "scale=6; $MAX_HEIGHT / $FRAME_H" | bc)
NEW_FRAME_W=$(echo "$FRAME_W * $SCALE / 1" | bc)
NEW_FRAME_H=$MAX_HEIGHT

# Calculate new sheet dimensions
NEW_SHEET_W=$((NEW_FRAME_W * COLS))
NEW_SHEET_H=$((NEW_FRAME_H * ROWS))

echo "=== Resizing Spritesheet ==="
echo "File: $(basename "$SPRITE")"
echo "Frame: ${FRAME_W}x${FRAME_H} → ${NEW_FRAME_W}x${NEW_FRAME_H}"
echo "Scale: ${SCALE}"
echo "Grid:  ${COLS}x${ROWS}"
echo ""

# Create backup
cp "$SPRITE" "${SPRITE}.backup"

# Resize the spritesheet
magick "$SPRITE" -resize "${NEW_SHEET_W}x${NEW_SHEET_H}" "$SPRITE"

# Update JSON metadata
jq ".frameWidth = $NEW_FRAME_W | .frameHeight = $NEW_FRAME_H" "$JSON" > "${JSON}.tmp" && mv "${JSON}.tmp" "$JSON"

# Get new file size
AFTER_SIZE=$(stat -f%z "$SPRITE" 2>/dev/null || stat -c%s "$SPRITE")
AFTER_MB=$(echo "scale=1; $AFTER_SIZE / 1048576" | bc)
SAVED=$((BEFORE_SIZE - AFTER_SIZE))
SAVED_MB=$(echo "scale=1; $SAVED / 1048576" | bc)
PCT=$(echo "scale=0; 100 * $SAVED / $BEFORE_SIZE" | bc)

echo "Size: ${BEFORE_MB}MB → ${AFTER_MB}MB (saved ${SAVED_MB}MB, ${PCT}%)"
echo ""
echo "Backup saved as: ${SPRITE}.backup"
echo "To revert: mv '${SPRITE}.backup' '$SPRITE'"
