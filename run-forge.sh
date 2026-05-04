#!/bin/bash
# AnimA Forge Runner
# Usage: ./run-forge.sh [scene_id] [scene_description] [character_description]
#
# Example:
#   ./run-forge.sh tavern "A dimly lit tavern with flickering candles" "A grizzled sailor with a peg leg"

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# Check dependencies
if ! command -v python3 &> /dev/null; then
    echo "❌ python3 required"
    exit 1
fi

if [ -z "$GOOGLE_API_KEY" ]; then
    echo "⚠️  GOOGLE_API_KEY not set - video generation will fail"
fi

if [ -z "$REPLICATE_API_TOKEN" ]; then
    echo "⚠️  REPLICATE_API_TOKEN not set - background removal will fail"
fi

echo "┌─────────────────────────────────────┐"
echo "│         ◇ AnimA Forge ◇             │"
echo "│    Agent-Led Scene Creation         │"
echo "└─────────────────────────────────────┘"
echo ""

# Run via OpenProse if available, otherwise show manual steps
if command -v prose &> /dev/null; then
    prose run anima-forge.prose
else
    echo "OpenProse not found as CLI. Running via OpenClaw..."
    echo ""
    echo "To run the full pipeline, tell your agent:"
    echo ""
    echo "  prose run anima-forge.prose"
    echo ""
    echo "Or run individual steps:"
    echo ""
    echo "  # Generate video + sprites"
    echo "  python packages/sprite-tools/scripts/sprite-factory.py generate \\"
    echo "    --prompt 'Walking cycle, side view' \\"
    echo "    --reference path/to/character.png \\"
    echo "    --output output/dir"
    echo ""
fi
