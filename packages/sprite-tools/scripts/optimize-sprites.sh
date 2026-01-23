#!/bin/bash
#
# optimize-sprites.sh - Compress PNG spritesheets with pngquant
#
# Usage: ./optimize-sprites.sh [options] <file-or-directory>
#
# Options:
#   --dry-run     Show what would be done without making changes
#   --quality N   Quality range (default: 85-95 for near-lossless)
#   --backup      Create .bak backup before overwriting
#
# Examples:
#   ./optimize-sprites.sh sprite.png              # Single file
#   ./optimize-sprites.sh /path/to/sprites/       # All PNGs in directory
#   ./optimize-sprites.sh --dry-run sprites/      # Preview only

set -e

# Defaults
DRY_RUN=false
QUALITY="85-95"
BACKUP=false

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --dry-run) DRY_RUN=true; shift ;;
        --quality) QUALITY="$2"; shift 2 ;;
        --backup) BACKUP=true; shift ;;
        -*) echo "Unknown option: $1"; exit 1 ;;
        *) TARGET="$1"; shift ;;
    esac
done

if [ -z "$TARGET" ]; then
    echo "Usage: $0 [options] <file-or-directory>"
    exit 1
fi

# Check for pngquant
if ! command -v pngquant &> /dev/null; then
    echo "Error: pngquant not found. Install with: brew install pngquant"
    exit 1
fi

# Collect files
if [ -d "$TARGET" ]; then
    FILES=$(find "$TARGET" -maxdepth 1 -name "*.png" -type f)
else
    FILES="$TARGET"
fi

# Process each file
TOTAL_BEFORE=0
TOTAL_AFTER=0
COUNT=0

echo "=== Optimizing PNGs with pngquant (quality: $QUALITY) ==="
echo ""

for FILE in $FILES; do
    if [ ! -f "$FILE" ]; then
        continue
    fi

    BEFORE=$(stat -f%z "$FILE" 2>/dev/null || stat -c%s "$FILE")
    BEFORE_MB=$(echo "scale=1; $BEFORE / 1048576" | bc)

    if $DRY_RUN; then
        echo "[DRY RUN] Would optimize: $(basename "$FILE") (${BEFORE_MB}MB)"
        continue
    fi

    if $BACKUP; then
        cp "$FILE" "${FILE}.bak"
    fi

    # Run pngquant (overwrites in place)
    pngquant --quality="$QUALITY" --speed 1 --strip --force "$FILE" --output "$FILE" 2>/dev/null || {
        echo "Warning: pngquant failed on $(basename "$FILE"), skipping"
        continue
    }

    AFTER=$(stat -f%z "$FILE" 2>/dev/null || stat -c%s "$FILE")
    AFTER_MB=$(echo "scale=1; $AFTER / 1048576" | bc)
    SAVED=$((BEFORE - AFTER))
    SAVED_MB=$(echo "scale=1; $SAVED / 1048576" | bc)
    PCT=$(echo "scale=0; 100 * $SAVED / $BEFORE" | bc)

    echo "$(basename "$FILE"): ${BEFORE_MB}MB → ${AFTER_MB}MB (saved ${SAVED_MB}MB, ${PCT}%)"

    TOTAL_BEFORE=$((TOTAL_BEFORE + BEFORE))
    TOTAL_AFTER=$((TOTAL_AFTER + AFTER))
    COUNT=$((COUNT + 1))
done

if [ $COUNT -gt 0 ]; then
    echo ""
    echo "=== SUMMARY ==="
    TOTAL_BEFORE_MB=$(echo "scale=1; $TOTAL_BEFORE / 1048576" | bc)
    TOTAL_AFTER_MB=$(echo "scale=1; $TOTAL_AFTER / 1048576" | bc)
    TOTAL_SAVED=$((TOTAL_BEFORE - TOTAL_AFTER))
    TOTAL_SAVED_MB=$(echo "scale=1; $TOTAL_SAVED / 1048576" | bc)
    TOTAL_PCT=$(echo "scale=0; 100 * $TOTAL_SAVED / $TOTAL_BEFORE" | bc)
    echo "Processed: $COUNT files"
    echo "Before:    ${TOTAL_BEFORE_MB}MB"
    echo "After:     ${TOTAL_AFTER_MB}MB"
    echo "Saved:     ${TOTAL_SAVED_MB}MB (${TOTAL_PCT}%)"
fi
