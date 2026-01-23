#!/bin/bash
#
# compare-sprites.sh - Compare sprite silhouettes to find matching scale
#
# Usage: ./compare-sprites.sh <reference.png> <new.png> <ref-WxH> <new-WxH> <scale>
#
# Example:
#   ./compare-sprites.sh willwalk.png will-idle.png 261x572 454x1537 36.9
#

set -e

REF="$1"
NEW="$2"
REF_DIMS="$3"
NEW_DIMS="$4"
SCALE="$5"

if [ -z "$SCALE" ]; then
    echo "Usage: $0 <reference.png> <new.png> <ref-WxH> <new-WxH> <scale%>"
    echo ""
    echo "Example:"
    echo "  $0 willwalk.png will-idle.png 261x572 454x1537 36.9"
    exit 1
fi

TMP="/tmp/sprite_compare"
mkdir -p "$TMP"

REF_W=$(echo "$REF_DIMS" | cut -dx -f1)
REF_H=$(echo "$REF_DIMS" | cut -dx -f2)
NEW_W=$(echo "$NEW_DIMS" | cut -dx -f1)
NEW_H=$(echo "$NEW_DIMS" | cut -dx -f2)

# Extract first frame and trim
magick "$REF" -crop ${REF_W}x${REF_H}+0+0 +repage -trim "$TMP/ref.png"
magick "$NEW" -crop ${NEW_W}x${NEW_H}+0+0 +repage -trim "$TMP/new.png"

# Scale and diff
magick "$TMP/new.png" -resize ${SCALE}% "$TMP/scaled.png"
magick "$TMP/ref.png" "$TMP/scaled.png" -gravity south -compose difference -composite "$TMP/diff.png"

# Show info
echo "Reference: $(magick identify -format '%wx%h' "$TMP/ref.png")"
echo "New at ${SCALE}%: $(magick identify -format '%wx%h' "$TMP/scaled.png")"
echo ""
echo "Perfect = NO pixels extend above or below from either sprite"
echo "- Reference extends above → scale UP"
echo "- New extends above → scale DOWN"

open "$TMP/diff.png"
