# StoryScript

A direct interpreter for point-and-click adventure games. **No JSON AST** — reads `.story` files and executes them line-by-line with a state machine.

## What It Does

- **Direct Interpretation**: Parses and executes `.story` files without intermediate representation
- **State Machine**: Manages scene, inventory, and flags in real-time
- **Interactive REPL**: Play games directly in the terminal
- **AI-Friendly**: Token-efficient format for LLM generation and playthrough

## Quick Start

```bash
# Run the interpreter
tsx src/interpreter.ts ../../adventures/shadow-over-innsmouth/story/act1.story
```

## REPL Commands

| Command | Description |
|---------|-------------|
| `look` | Look around (scene description) |
| `look <target>` | Look at something |
| `talk <target>` | Talk to someone |
| `use <target>` | Use/interact with something |
| `hotspots` / `h` | List available hotspots |
| `inventory` / `i` | Show inventory |
| `state` | Show game state (debug) |
| `help` | Show help |
| `quit` / `q` | Exit game |

## StoryScript Format

```storyscript
SCENE bus_station
  location: "Arkham Bus Depot"
  
  DESCRIPTION
    A small-town bus depot. Diesel and stale coffee.
  END
  
  HOTSPOT ticket_window
    name: "Ticket Window"
    
    LOOK
      "Scratched plexiglass. A faded schedule."
    END
    
    TALK
      -> buy_ticket_dialogue
    END
  END
END

DIALOGUE buy_ticket_dialogue
  clerk: "Help you?"
  
  CHOICE
    > "One ticket to Innsmouth, please."
      GIVE bus_ticket
      clerk: "Two dollars."
      -> END
  END
END

TRIGGER bus_boarding
  REQUIRE HAS(bus_ticket)
  
  CUTSCENE
    The bus idles on the platform.
    hermes (thinks): "Here we go."
  END
  
  -> bus_interior
END
```

## Features

- **SCENE**: Define locations with descriptions and hotspots
- **HOTSPOT**: Interactive objects with LOOK/TALK/USE actions
- **DIALOGUE**: Branching conversations with CHOICE blocks
- **TRIGGER**: Conditional events with CUTSCENE support
- **IF/ELSE**: Conditional logic (`IF HAS(item)`, `IF flag`)
- **GIVE/SET**: Inventory and flag manipulation
- **->**: Scene/dialogue transitions

## Example Playthrough

```
=== Arkham Bus Depot ===

A small-town bus depot. Diesel and stale coffee.
hermes (thinks): "Innsmouth. The town nobody talks about."

> hotspots
Hotspots:
  Ticket Window [look, talk]
  Waiting Bench [look, talk]
  Bus Platform [use]

> look Waiting Bench
A young woman sits alone, away from everyone else.
Dark hair, leather jacket, headphones.

> talk Ticket Window
clerk: "Help you?"

--- CHOICES ---
  1. One ticket to Innsmouth, please.
  2. What's wrong with Innsmouth?

Choose (1-2): 1
clerk: "Two dollars. Bus leaves in ten minutes."
✓ [You received: bus_ticket]

> use Bus Platform

╔══════════════════════════════════════════╗
║            --- CUTSCENE ---              ║
╚══════════════════════════════════════════╝

The bus to Innsmouth idles on the platform.
hermes (thinks): "Here we go."

=== Bus to Innsmouth ===
```

## Architecture

```
.story file
    ↓
StoryInterpreter (line-by-line parsing)
    ↓
GameState { scene, inventory, flags }
    ↓
REPL (interactive play)
```

No JSON. No AST. Just execution.

## License

MIT
