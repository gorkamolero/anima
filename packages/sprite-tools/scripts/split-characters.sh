#!/bin/bash
#
# split-characters.sh - Split landscape images with 2 characters into 9:16 vertical crops
#
# USAGE:
#   ./split-characters.sh <input-image> <output-dir> [options]
#   ./split-characters.sh --batch <input-dir> <output-dir> [options]
#
# OPTIONS:
#   --work-width <px>    Working width before scaling (default: 1100, increase for wider characters)
#   --left-offset <px>   Manual X offset for left character center (auto-detect if omitted)
#   --right-offset <px>  Manual X offset for right character center (auto-detect if omitted)
#   --no-scale           Don't scale down, just crop (may cut off wide characters)
#   --preview            Show detected positions without processing
#
# EXAMPLES:
#   # Process single image (auto-detect character positions)
#   ./split-characters.sh input.jpeg ./output
#
#   # Process with manual offsets (if auto-detect fails)
#   ./split-characters.sh input.jpeg ./output --left-offset 300 --right-offset 1600
#
#   # Batch process directory
#   ./split-characters.sh --batch ./sources ./output
#
# OUTPUT:
#   For input "artist.jpeg", creates:
#     - artist-left.png  (left character, 9:16)
#     - artist-right.png (right character, 9:16)
#
# REQUIREMENTS:
#   - ImageMagick 7+ (magick command)
#
# NOTES:
#   - Expects green screen background for auto-detection
#   - Uses edge replication for seamless padding (matches original green exactly)
#   - Output is PNG to preserve color fidelity
#   - All outputs are uniformly scaled so characters appear same size
#

set -e

# Defaults
WORK_WIDTH=1100
TARGET_W=864
TARGET_H=1536
LEFT_OFFSET=""
RIGHT_OFFSET=""
NO_SCALE=false
PREVIEW=false
BATCH=false

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

usage() {
    head -50 "$0" | grep "^#" | cut -c3-
    exit 1
}

# Detect character center in a half of the image using green screen removal
detect_center() {
    local img="$1"
    local crop_geom="$2"
    local base_offset="$3"

    # Crop half, make green transparent, get bounding box
    local bbox=$(magick "$img" -crop "$crop_geom" +repage \
        -fuzz 25% -transparent "#00FF00" \
        -format "%@" info: 2>/dev/null || echo "0x0+0+0")

    # Parse WxH+X+Y
    local w=$(echo "$bbox" | sed -E 's/([0-9]+)x.*/\1/')
    local x=$(echo "$bbox" | sed -E 's/.*\+([0-9]+)\+.*/\1/')

    # Content center = x + w/2, then add base offset
    echo $((x + w/2 + base_offset))
}

# Process a single image
process_image() {
    local src="$1"
    local out_dir="$2"
    local basename=$(basename "$src" | sed 's/\.[^.]*$//')

    # Get image dimensions
    local img_w=$(magick identify -format "%w" "$src")
    local img_h=$(magick identify -format "%h" "$src")
    local half_w=$((img_w / 2))

    log_info "Processing: $src (${img_w}x${img_h})"

    # Detect or use provided offsets
    local left_center right_center

    if [ -n "$LEFT_OFFSET" ]; then
        left_center=$LEFT_OFFSET
    else
        left_center=$(detect_center "$src" "${half_w}x${img_h}+0+0" 0)
    fi

    if [ -n "$RIGHT_OFFSET" ]; then
        right_center=$RIGHT_OFFSET
    else
        right_center=$(detect_center "$src" "${half_w}x${img_h}+${half_w}+0" "$half_w")
    fi

    log_info "  Left character center: $left_center"
    log_info "  Right character center: $right_center"

    if [ "$PREVIEW" = true ]; then
        local left_off=$((left_center - WORK_WIDTH/2))
        local right_off=$((right_center - WORK_WIDTH/2))
        log_info "  Left crop offset: $left_off"
        log_info "  Right crop offset: $right_off"
        return 0
    fi

    # Calculate crop offsets (center - half of work width)
    local half_work=$((WORK_WIDTH / 2))
    local max_offset=$((img_w - WORK_WIDTH))

    local left_off=$((left_center - half_work))
    local right_off=$((right_center - half_work))

    # Clamp to valid range
    [ $left_off -lt 0 ] && left_off=0
    [ $left_off -gt $max_offset ] && left_off=$max_offset
    [ $right_off -lt 0 ] && right_off=0
    [ $right_off -gt $max_offset ] && right_off=$max_offset

    # Process both characters
    process_character "$src" "$left_off" "$out_dir/${basename}-left.png" "left"
    process_character "$src" "$right_off" "$out_dir/${basename}-right.png" "right"
}

# Process a single character crop
process_character() {
    local src="$1"
    local offset="$2"
    local out="$3"
    local side="$4"

    local img_h=$(magick identify -format "%h" "$src")
    local tmp_scaled="/tmp/split_char_scaled_$$.png"
    local tmp_strip="/tmp/split_char_strip_$$.png"

    if [ "$NO_SCALE" = true ]; then
        # Just crop to target size, no scaling
        magick "$src" \
            -crop "${TARGET_W}x${img_h}+${offset}+0" +repage \
            "$tmp_scaled"
    else
        # Crop working width, then scale to target
        magick "$src" \
            -crop "${WORK_WIDTH}x${img_h}+${offset}+0" +repage \
            -resize ${TARGET_W}x \
            "$tmp_scaled"
    fi

    # Get scaled height
    local scaled_h=$(magick identify -format "%h" "$tmp_scaled")
    local pad=$((TARGET_H - scaled_h))

    if [ $pad -gt 0 ]; then
        # Edge replication: clone top row for seamless padding
        magick "$tmp_scaled" -crop "${TARGET_W}x1+0+0" +repage -scale "${TARGET_W}x${pad}!" "$tmp_strip"
        magick "$tmp_strip" "$tmp_scaled" -append "$out"
    else
        # No padding needed (or image taller than target)
        magick "$tmp_scaled" -crop "${TARGET_W}x${TARGET_H}+0+0" +repage "$out"
    fi

    # Cleanup
    rm -f "$tmp_scaled" "$tmp_strip"

    log_info "  Created: $out ($side)"
}

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --batch)
            BATCH=true
            shift
            ;;
        --work-width)
            WORK_WIDTH="$2"
            shift 2
            ;;
        --left-offset)
            LEFT_OFFSET="$2"
            shift 2
            ;;
        --right-offset)
            RIGHT_OFFSET="$2"
            shift 2
            ;;
        --no-scale)
            NO_SCALE=true
            shift
            ;;
        --preview)
            PREVIEW=true
            shift
            ;;
        -h|--help)
            usage
            ;;
        *)
            if [ -z "$INPUT" ]; then
                INPUT="$1"
            elif [ -z "$OUTPUT" ]; then
                OUTPUT="$1"
            else
                log_error "Unknown argument: $1"
                usage
            fi
            shift
            ;;
    esac
done

# Validate arguments
if [ -z "$INPUT" ] || [ -z "$OUTPUT" ]; then
    log_error "Missing required arguments"
    usage
fi

# Check for ImageMagick
if ! command -v magick &> /dev/null; then
    log_error "ImageMagick 7+ required (magick command not found)"
    exit 1
fi

# Create output directory
mkdir -p "$OUTPUT"

# Process
if [ "$BATCH" = true ]; then
    # Batch mode: process all images in directory
    shopt -s nullglob
    for img in "$INPUT"/*.jpg "$INPUT"/*.jpeg "$INPUT"/*.png "$INPUT"/*.JPG "$INPUT"/*.JPEG "$INPUT"/*.PNG; do
        [ -f "$img" ] && process_image "$img" "$OUTPUT"
    done
    shopt -u nullglob
else
    # Single image mode
    if [ ! -f "$INPUT" ]; then
        log_error "Input file not found: $INPUT"
        exit 1
    fi
    process_image "$INPUT" "$OUTPUT"
fi

log_info "Done!"
