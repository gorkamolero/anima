# Anima

A point-and-click adventure game engine and toolchain.

## What's Here

- **StoryScript** - A DSL for writing adventure games. Direct interpreter, no AST. Token-efficient for LLM generation, human-readable for writers.
- **Phaser Engine** - Classic LucasArts/Sierra-style game engine with hotspots, inventory, dialogue, TTS.
- **Sprite Tools** - AI-driven asset pipeline: image generation → video generation → sprite sheets.

## Quick Start

```bash
# Install dependencies
pnpm install

# Playtest the current game (Shadow over Innsmouth)
tsx packages/storyscript/src/interpreter.ts adventures/shadow-over-innsmouth/story/act1.story
```

## Project Structure

```
anima/
├── packages/
│   ├── engine/           # Phaser game engine
│   ├── storyscript/      # StoryScript interpreter
│   └── sprite-tools/     # Asset creation scripts
├── adventures/
│   ├── _template/        # New game starter
│   └── shadow-over-innsmouth/  # Current game
├── api/                  # Backend (TTS, AI, persistence)
└── docs/                 # Specs and guides
```

## StoryScript

Write adventure games in a clean, readable format:

```storyscript
SCENE bus_station
  location: "Arkham Bus Depot"

  DESCRIPTION
    A small-town bus depot. Diesel and stale coffee.
    The clerk looks like he's been here for thirty years.
  END

  ON_ENTER
    hermes (thinks): "Innsmouth. The town nobody talks about."
  END

  HOTSPOT ticket_window
    name: "Ticket Window"
    LOOK
      "Scratched plexiglass. A faded schedule."
    END
    TALK
      -> ticket_clerk_dialogue
    END
  END
END

DIALOGUE ticket_clerk_dialogue
  clerk: "Help you?"

  CHOICE
    > "One ticket to Innsmouth."
      clerk: "Innsmouth? You sure?"
      GIVE bus_ticket
      -> END
    > "Never mind."
      -> END
  END
END
```

**Full spec:** See [docs/STORYSCRIPT.md](docs/STORYSCRIPT.md)

## Current Game: Shadow over Innsmouth

A Lovecraftian horror adventure in 4 acts:

- **Act 1: Arrival** - Bus station, journey to Innsmouth
- **Act 2: Investigation** - Town exploration, the old drunk, the library
- **Act 3: The Chase** - Church confrontation, escape through alleys
- **Act 4: The Sea** - One year later, the beach, the ending

Story files: `adventures/shadow-over-innsmouth/story/`

## Asset Pipeline

Create game-ready sprites from AI-generated content:

```
Image Generation → Video Generation → Sprite Sheet
   (Gemini/GPT)      (Hedra/Sora/Veo)    (video2sprite.sh)
```

**Available video models via Hedra:**
- `hedra-character-3` - Lip-sync talking (requires audio)
- `kling-2.5-i2v` - Motion/idle (10 cr/s, good for testing)
- `sora-2-pro-i2v` - Motion/idle (70 cr/s, best quality)

```bash
# Generate talking video
python packages/sprite-tools/scripts/hedra-video.py \
  --image character.png --audio dialogue.mp3 --output talking.mp4

# Convert to sprite sheet
./packages/sprite-tools/scripts/video2sprite.sh talking.mp4 character-talk
```

## Tech Stack

| Component | Technology |
|-----------|------------|
| Game Engine | Phaser 3 |
| Story Format | StoryScript |
| UI | React 19 + Tailwind v4 |
| Backend | Hono |
| Database | Turso (libsql) |
| AI/LLM | Vercel AI SDK |
| Asset Processing | ImageMagick, FFmpeg |

## Commands

```bash
pnpm dev          # Run game + api
pnpm build        # Build all packages
pnpm lint         # Lint check
pnpm typecheck    # Type check
```

## Art Style

Ashley's paintings define the visual identity:
- 1930s Fleischer "Rubber Hose" + Tibetan Thangka fusion
- Clean black ink outlines, consistent weight
- Opaque vibrant fills (acrylic/gouache look)

If AI output looks generic: reject it.

## License

MIT
