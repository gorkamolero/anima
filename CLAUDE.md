# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Anima is a point-and-click adventure game engine and toolchain. It includes:
- **Phaser-based game engine** for classic LucasArts/Sierra-style adventures
- **StoryScript** - a DSL for writing adventure games (direct interpreter, no AST)
- **Sprite Tools** - AI-driven asset pipeline (image → video → spritesheet)

**Philosophy:** Clear conventions over flexibility. LLM-friendly patterns. Full classic adventure game feature set.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Game Engine | Phaser 3 |
| Story Format | StoryScript (.story files) |
| Dialogue (legacy) | Ink (inkjs) |
| UI | React 19 + Tailwind v4 |
| Backend | Hono |
| Database | Turso (libsql) |
| AI/LLM | Vercel AI SDK |
| Asset Processing | ImageMagick, FFmpeg |

## Architecture

```
anima/
├── packages/
│   ├── engine/       # Phaser game engine - BaseScene, Character, Hotspot, DialogueManager
│   ├── storyscript/  # StoryScript interpreter - parses and runs .story files
│   └── sprite-tools/ # Asset creation pipeline
├── adventures/       # Individual games
│   ├── _template/    # Starter template for new games
│   └── shadow-over-innsmouth/  # Current game in development
├── api/              # Shared backend (TTS, AI, persistence)
└── docs/             # Language specs, guides
```

**Key packages:**
- `packages/engine/` - The Phaser game engine (scenes, characters, hotspots, dialogue)
- `packages/storyscript/` - StoryScript interpreter with interactive REPL
- `packages/sprite-tools/` - Shell scripts for AI asset pipeline

**Adventures:**
- Each game lives in `adventures/<game-name>/`
- Games have their own `story/` directory with `.story` files
- Use `_template/` to bootstrap new games

Uses pnpm workspaces. All packages are in `pnpm-workspace.yaml`.

## Commands

```bash
# Development
pnpm dev              # Run game + api concurrently
pnpm build            # Build all packages
pnpm lint             # Lint all packages
pnpm typecheck        # Type check all packages

# StoryScript - Run/playtest stories
tsx packages/storyscript/src/interpreter.ts adventures/shadow-over-innsmouth/story/act1.story

# Sprite Tools (from packages/sprite-tools/)
./scripts/video2sprite.sh <video> <output-name> [--fps 12] [--fuzz 20]
./scripts/chromakey.sh <input> <output> [--fuzz 20]
./scripts/split-characters.sh <input> <output-dir>
./scripts/hedra-video.py --image <img> --audio <audio> --output <out>
```

## Sprite Tools Dependencies

```bash
brew install imagemagick ffmpeg
pip install rembg  # optional, AI background removal
```

Required env vars for video generation:
- `HEDRA_API_KEY` - For hedra-video.py
- `GOOGLE_API_KEY` - For veo-video.ts

## Asset Pipeline

The critical workflow: **AI Image → AI Video → Sprite Sheet**

1. **Image Gen** - Nano Banana (Gemini) or GPT-5 for character/background images
2. **Video Gen** - hedra-video.py wraps multiple models:
   - `hedra-character-3`: Lip-sync (requires audio)
   - `kling-2.5-i2v`: Motion (cheap, 10 cr/s)
   - `sora-2-pro-i2v`: Motion (best, 70 cr/s, 4/8/12s only)
3. **Sprite Sheet** - video2sprite.sh converts video to Phaser-ready assets

## Art Style Constraint

**Ashley's paintings define the visual identity. AI generation must match exactly:**
- 1930s Fleischer "Rubber Hose" + Tibetan Thangka fusion
- Clean black ink outlines, consistent weight
- Opaque vibrant fills (acrylic/gouache look, NOT digital gradient)

If AI output looks generic: REJECT IT. Fallback to extracting from Ashley's paintings.

## StoryScript

A minimal DSL for point-and-click adventures. Direct interpretation - no JSON, no AST.

**File location:** `adventures/<game>/story/*.story`

**Core blocks:**
- `SCENE` - Locations with description, hotspots, ON_ENTER hooks
- `HOTSPOT` - Interactive objects with LOOK/TALK/USE actions
- `DIALOGUE` - Branching conversations with CHOICE blocks
- `TRIGGER` - Conditional events with CUTSCENE support

**Commands:**
- `GIVE item` - Add to inventory
- `SET flag = value` - Set game state
- `-> target` - Transition to scene/dialogue/END

**Conditions:**
- `IF HAS(item)` / `IF NOT HAS(item)`
- `IF flag` / `IF flag = value`

**REPL commands when playtesting:**
```
look              # Scene description
look <target>     # Examine hotspot
talk <target>     # Talk to hotspot
use <target>      # Use hotspot
hotspots / h      # List available hotspots
inventory / i     # Show inventory
state             # Debug game state
quit / q          # Exit
```

**Full spec:** See `docs/STORYSCRIPT.md`

## Core Architecture Patterns

### Dialogue System (InkDialogueManager)
- TTS lookup uses speaker name (lowercase), not story ID
- Colors stored per-speaker in Ink as `{speaker}_color` variables
- Exit dialogue timing: Some dialogues need player to walk away BEFORE NPCs react. Use `will_exited` flag in Ink.

### Scene Definition (Hybrid)
- Config (JSON) for standard stuff: hotspots, NPCs, parallax layers
- TypeScript class for custom behavior hooks

### Hotspot System
- Verb-based interaction (look, talk, use, take)
- Radial menu for verb selection
- Debug visualization: press H

## Known Quirks

1. **Exit dialogue timing**: Player must walk away before NPCs comment. Solved via `will_exited` Ink variable + scene-side check + separate knot.

2. **TTS character mismatch**: `showDialogueWithTTS` must use speaker name from Ink line, not story ID, for audio lookup.

3. **Talking animation sync**: Callbacks need exact speaker names from Ink (PINK, ORANGE, TEAL) to match sprite mappings.
