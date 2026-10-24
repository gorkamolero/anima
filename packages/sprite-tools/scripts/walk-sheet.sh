#!/usr/bin/env bash
# Build a walk-cycle sheet from a raw generated video, with the rulers in the loop.
#   scripts/walk-sheet.sh <raw.mp4> <sheet-base> [facing=left] [fps=24] [loop-min=16] [loop-max=48]
# Steps: BRIA background removal -> LoopyCut + Phaser sheet -> drift audit/register
#        -> plant seeds -> contact tracking -> step audit -> 4x interpolated sheet.
set -euo pipefail
RAW=$1; BASE=$2; FACING=${3:-left}; FPS=${4:-24}; LMIN=${5:-16}; LMAX=${6:-48}
HERE=$(cd "$(dirname "$0")/.." && pwd); ROOT=$(cd "$HERE/../.." && pwd)
ALPHA="${RAW%.*}.alpha.webm"
cd "$HERE"
[ -f "$ALPHA" ] || npx tsx scripts/fal-video.ts remove-bg --video "$RAW" --output "$ALPHA" --background Transparent --codec webm_vp9
uv run scripts/sprite-factory.py process-alpha --video "$ALPHA" --output "$BASE" --fps "$FPS" --cols 8 --detect-loop --loop-min-frames "$LMIN" --loop-max-frames "$LMAX" --preview-loops 3
uv run scripts/sprite-factory.py audit-drift --sheet "$BASE" || uv run scripts/sprite-factory.py register --sheet "$BASE"
uv run scripts/sprite-factory.py audit-drift --sheet "$BASE"
uv run scripts/seed-steps.py "$BASE.json" --facing "$FACING" --out "$BASE-seeds.json"
uv run --with numpy --with pillow python3 scripts/root-motion.py "$BASE.json" --seeds "$BASE-seeds.json" --debug "$ROOT/tmp/walkqa/contacts-$(basename "$BASE")"
uv run scripts/sprite-factory.py audit-steps --sheet "$BASE"
cd "$ROOT/adventures/shadow-over-innsmouth" && node scripts/interpolate-sheet.mjs "$(basename "$BASE")"
cd "$HERE" && uv run scripts/sprite-factory.py audit-drift --sheet "$BASE-4x" && uv run scripts/sprite-factory.py audit-steps --sheet "$BASE-4x"
