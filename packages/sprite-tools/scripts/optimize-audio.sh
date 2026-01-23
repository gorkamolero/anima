#!/bin/bash
#
# optimize-audio.sh - Compress MP3 files to lower bitrate
#
# Usage: ./optimize-audio.sh <directory> [bitrate]
#
# Default bitrate: 32k (good for dialogue)

DIR="$1"
BITRATE="${2:-32k}"

if [ -z "$DIR" ]; then
    echo "Usage: $0 <directory> [bitrate]"
    echo "Example: $0 dialogue/ 32k"
    exit 1
fi

echo "=== Compressing audio to ${BITRATE} ==="
echo "Directory: $DIR"
echo ""

BEFORE=$(du -sm "$DIR" | cut -f1)
COUNT=0

find "$DIR" -name "*.mp3" -type f | while read f; do
    ffmpeg -y -i "$f" -b:a "$BITRATE" -ar 22050 "${f}.tmp" 2>/dev/null
    if [ -f "${f}.tmp" ]; then
        mv "${f}.tmp" "$f"
        COUNT=$((COUNT + 1))
        echo -n "."
    fi
done

echo ""
AFTER=$(du -sm "$DIR" | cut -f1)
echo ""
echo "Before: ${BEFORE}MB"
echo "After:  ${AFTER}MB"
echo "Saved:  $((BEFORE - AFTER))MB"
