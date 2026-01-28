#!/bin/bash
#
# compare-pipelines.sh - Side-by-side comparison of source + Pipeline A + Pipeline B
#
# Usage: ./compare-pipelines.sh <video>
#
# Expects pipeline outputs at:
#   output/<name>-pipeline-a/final/preview_magenta.mp4  (or frames-fixed/)
#   output/<name>-pipeline-b/final/                     (frame PNGs)
#
# Output: output/<name>-comparison.mp4

set -e

VIDEO="$1"

if [ -z "$VIDEO" ]; then
  echo "Usage: ./compare-pipelines.sh <video>"
  echo ""
  echo "Compares source video with Pipeline A and Pipeline B results side by side."
  exit 1
fi

SCRIPTS_DIR="$(cd "$(dirname "$0")" && pwd)"
SPRITE_TOOLS="$(dirname "$SCRIPTS_DIR")"

VIDEO_NAME="$(basename "$VIDEO" | sed 's/\.[^.]*$//')"
PIPELINE_A="$SPRITE_TOOLS/output/${VIDEO_NAME}-pipeline-a"
PIPELINE_B="$SPRITE_TOOLS/output/${VIDEO_NAME}-pipeline-b"
OUTPUT="$SPRITE_TOOLS/output/${VIDEO_NAME}-comparison.mp4"
TMP_DIR="/tmp/pipeline-compare-$$"

mkdir -p "$TMP_DIR"

# Validate inputs exist
LOOP_A="$PIPELINE_A/loop.mp4"
LOOP_B="$PIPELINE_B/loop.mp4"

if [ ! -f "$LOOP_A" ] && [ ! -f "$LOOP_B" ]; then
  echo "Error: No pipeline outputs found. Run sprite-a.sh and sprite-b.sh first."
  exit 1
fi

# Use whichever loop.mp4 exists as source loop
LOOP_SRC="$LOOP_A"
[ ! -f "$LOOP_SRC" ] && LOOP_SRC="$LOOP_B"

echo "═══════════════════════════════════════════════════════════"
echo "  PIPELINE COMPARISON: $VIDEO_NAME"
echo "═══════════════════════════════════════════════════════════"

# Get frame count and dimensions from source loop
FRAMES=$(ffprobe -v error -select_streams v:0 -count_frames -show_entries stream=nb_read_frames -of csv=p=0 "$LOOP_SRC")
FPS=$(ffprobe -v error -select_streams v:0 -show_entries stream=r_frame_rate -of csv=p=0 "$LOOP_SRC")
DIMENSIONS=$(ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=p=0 "$LOOP_SRC")
WIDTH=$(echo "$DIMENSIONS" | cut -d, -f1)
HEIGHT=$(echo "$DIMENSIONS" | cut -d, -f2)

echo "Source: ${WIDTH}x${HEIGHT}, ${FRAMES} frames, ${FPS} fps"

# Step 1: Extract source frames on magenta background
echo -e "\n[1/4] Extracting source frames..."
mkdir -p "$TMP_DIR/source"
ffmpeg -y -v error -i "$LOOP_SRC" "$TMP_DIR/source/frame_%03d.png"

# Step 2: Create Pipeline A frames on magenta
echo -e "\n[2/4] Preparing Pipeline A frames..."
mkdir -p "$TMP_DIR/pipeline-a"
if [ -d "$PIPELINE_A/final/frames-fixed" ]; then
  FRAMES_A="$PIPELINE_A/final/frames-fixed"
elif [ -d "$PIPELINE_A/final/frames" ]; then
  FRAMES_A="$PIPELINE_A/final/frames"
else
  echo "  ⚠ Pipeline A output not found — using blank frames"
  FRAMES_A=""
fi

if [ -n "$FRAMES_A" ]; then
  i=1
  while IFS= read -r f; do
    # Composite transparent frame onto magenta
    ffmpeg -y -v error \
      -f lavfi -i "color=c=0xFF00FF:s=${WIDTH}x${HEIGHT}:d=1" \
      -i "$f" \
      -filter_complex "[0:v][1:v]overlay=(W-w)/2:(H-h)/2:shortest=1,format=yuv420p" \
      -frames:v 1 \
      "$TMP_DIR/pipeline-a/frame_$(printf '%03d' $i).png"
    i=$((i + 1))
  done < <(find "$FRAMES_A" -name "*.png" -maxdepth 1 | sort)
  echo "  ✓ $((i - 1)) frames composited"
fi

# Step 3: Create Pipeline B frames on light blue
echo -e "\n[3/4] Preparing Pipeline B frames..."
mkdir -p "$TMP_DIR/pipeline-b"
if [ -d "$PIPELINE_B/final" ]; then
  FRAMES_B="$PIPELINE_B/final"
else
  echo "  ⚠ Pipeline B output not found — using blank frames"
  FRAMES_B=""
fi

if [ -n "$FRAMES_B" ]; then
  i=1
  while IFS= read -r f; do
    ffmpeg -y -v error \
      -f lavfi -i "color=c=0x87CEEB:s=${WIDTH}x${HEIGHT}:d=1" \
      -i "$f" \
      -filter_complex "[0:v][1:v]overlay=(W-w)/2:(H-h)/2:shortest=1,format=yuv420p" \
      -frames:v 1 \
      "$TMP_DIR/pipeline-b/frame_$(printf '%03d' $i).png"
    i=$((i + 1))
  done < <(find "$FRAMES_B" -name "*.png" -maxdepth 1 | sort)
  echo "  ✓ $((i - 1)) frames composited"
fi

# Step 4: Assemble comparison video
echo -e "\n[4/4] Assembling comparison video..."

# Panel width (scale source to match panel size)
PANEL_W=$((WIDTH / 2))
PANEL_H=$((HEIGHT / 2))
TOTAL_W=$((PANEL_W * 3))
LABEL_H=40

# Build ffmpeg inputs
INPUTS=""
FILTER=""

# Source sequence
INPUTS="-framerate $FPS -i $TMP_DIR/source/frame_%03d.png"

# Pipeline A
if [ -d "$TMP_DIR/pipeline-a" ] && [ "$(ls $TMP_DIR/pipeline-a/*.png 2>/dev/null | wc -l)" -gt 0 ]; then
  INPUTS="$INPUTS -framerate $FPS -i $TMP_DIR/pipeline-a/frame_%03d.png"
  HAS_A=1
else
  HAS_A=0
fi

# Pipeline B
if [ -d "$TMP_DIR/pipeline-b" ] && [ "$(ls $TMP_DIR/pipeline-b/*.png 2>/dev/null | wc -l)" -gt 0 ]; then
  INPUTS="$INPUTS -framerate $FPS -i $TMP_DIR/pipeline-b/frame_%03d.png"
  HAS_B=1
else
  HAS_B=0
fi

# Build filter based on what's available
if [ "$HAS_A" = "1" ] && [ "$HAS_B" = "1" ]; then
  ffmpeg -y -v error \
    -framerate "$FPS" -i "$TMP_DIR/source/frame_%03d.png" \
    -framerate "$FPS" -i "$TMP_DIR/pipeline-a/frame_%03d.png" \
    -framerate "$FPS" -i "$TMP_DIR/pipeline-b/frame_%03d.png" \
    -filter_complex "
      [0:v]scale=${PANEL_W}:${PANEL_H},
        drawtext=text='SOURCE':fontsize=24:fontcolor=white:x=(w-tw)/2:y=10:
        borderw=2:bordercolor=black[src];
      [1:v]scale=${PANEL_W}:${PANEL_H},
        drawtext=text='PIPELINE A (rembg)':fontsize=24:fontcolor=white:x=(w-tw)/2:y=10:
        borderw=2:bordercolor=black[a];
      [2:v]scale=${PANEL_W}:${PANEL_H},
        drawtext=text='PIPELINE B (nano banana)':fontsize=24:fontcolor=white:x=(w-tw)/2:y=10:
        borderw=2:bordercolor=black[b];
      [src][a][b]hstack=inputs=3[out]
    " \
    -map "[out]" \
    -c:v libx264 -crf 18 -pix_fmt yuv420p \
    -shortest \
    "$OUTPUT"
elif [ "$HAS_A" = "1" ]; then
  ffmpeg -y -v error \
    -framerate "$FPS" -i "$TMP_DIR/source/frame_%03d.png" \
    -framerate "$FPS" -i "$TMP_DIR/pipeline-a/frame_%03d.png" \
    -filter_complex "
      [0:v]scale=${PANEL_W}:${PANEL_H},
        drawtext=text='SOURCE':fontsize=24:fontcolor=white:x=(w-tw)/2:y=10:
        borderw=2:bordercolor=black[src];
      [1:v]scale=${PANEL_W}:${PANEL_H},
        drawtext=text='PIPELINE A (rembg)':fontsize=24:fontcolor=white:x=(w-tw)/2:y=10:
        borderw=2:bordercolor=black[a];
      [src][a]hstack=inputs=2[out]
    " \
    -map "[out]" \
    -c:v libx264 -crf 18 -pix_fmt yuv420p \
    -shortest \
    "$OUTPUT"
elif [ "$HAS_B" = "1" ]; then
  ffmpeg -y -v error \
    -framerate "$FPS" -i "$TMP_DIR/source/frame_%03d.png" \
    -framerate "$FPS" -i "$TMP_DIR/pipeline-b/frame_%03d.png" \
    -filter_complex "
      [0:v]scale=${PANEL_W}:${PANEL_H},
        drawtext=text='SOURCE':fontsize=24:fontcolor=white:x=(w-tw)/2:y=10:
        borderw=2:bordercolor=black[src];
      [1:v]scale=${PANEL_W}:${PANEL_H},
        drawtext=text='PIPELINE B (nano banana)':fontsize=24:fontcolor=white:x=(w-tw)/2:y=10:
        borderw=2:bordercolor=black[b];
      [src][b]hstack=inputs=2[out]
    " \
    -map "[out]" \
    -c:v libx264 -crf 18 -pix_fmt yuv420p \
    -shortest \
    "$OUTPUT"
fi

# Loop the comparison 3x for easier viewing
LOOPED="${OUTPUT%.mp4}_looped.mp4"
ffmpeg -y -v error \
  -stream_loop 2 -i "$OUTPUT" \
  -c:v libx264 -crf 18 -pix_fmt yuv420p \
  "$LOOPED"

# Clean up
rm -rf "$TMP_DIR"

SIZE=$(du -h "$LOOPED" | cut -f1)
echo -e "\n═══════════════════════════════════════════════════════════"
echo "  DONE: $LOOPED ($SIZE)"
echo "═══════════════════════════════════════════════════════════"
