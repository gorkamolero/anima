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

## Langfuse judges and scripted playthroughs

The API's floor and ground vision judges optionally report to Langfuse. The browser
playthroughs are scripted and are **not AI-judged**. Set `LANGFUSE_PUBLIC_KEY` and
`LANGFUSE_SECRET_KEY` in the process environment; `LANGFUSE_BASE_URL` defaults to
`https://cloud.langfuse.com`. Without both keys, telemetry is a silent no-op.
Use Node 22.18+ (or Node 24), pnpm, and ImageMagick for the local snapshot.

From the repository root:

```bash
cd api
# Offline: freeze existing cached places, images, masks, labels and outlines.
pnpm exec tsx scripts/langfuse-judge-experiment.ts --snapshot-only
# Real run: requires Langfuse keys and the API's model credentials.
pnpm exec tsx scripts/langfuse-judge-experiment.ts --variant=baseline --n=2
pnpm exec tsx scripts/langfuse-judge-experiment.ts --variant=vision-silhouette --n=2 --model=google/gemini-2.5-flash --prompt='Check the object silhouette carefully.'
```

The runner reuses API startup credential loading. It upserts stable content-hash
item IDs into `anima-floor-places` and uses hosted items with the v6 experiment
runner. Runs are named `<variant>-<ISO timestamp>` and can be compared in the
dataset-run view. The default is two items, sequentially. Each item may ask several
model questions. An explicit model or prompt selects the per-question vision path;
the baseline tries Decisions first, then the existing vision fallback. Runs bypass
verdict caches and do not overwrite them. No images or perception are generated.
The local snapshot at `api/data/langfuse-floor-places/items.json` is reused unchanged;
keep it for comparisons. Hosted dataset inputs reference content-hash snapshot IDs
(with place/background identifiers); image bytes stay local to avoid oversized
dataset requests. The runner verifies every snapshot hash before use. Copy this
snapshot when running experiments on another machine. Cached vocabulary mappings are used when available;
otherwise the original labels are retained conservatively.

The current cache contains one reviewer-approved anchor mask. Its exact mask has
`expectedOutput.pass=true` with review provenance; prior model verdicts are never
labels. Unreviewed inputs have no expected output. `floor_agreement` and aggregate
`floor_agreement_rate` evaluate only reviewed inputs. `floor_pass_rate` reports the
judge's pass rate, not accuracy; `floor_completion_rate` tracks completed verdicts.

Judge traces/spans are `judge-floor`, with model generations, token usage and
duration (provider cost when available). Scores use a fixed set: `floor_pass`, `floor_agreement`,
`false_walkable_max_probability`, `floor_failed_questions`,
`floor_outline_max_fraction`, and `floor_outline_failed`. Advisory coverage is
excluded from hazard maxima/counts. Per-question probabilities and outline detail
remain in score comments and judge metadata; ground samples remain in judge
metadata with one overall `floor_pass`. Run aggregates are unchanged.

Run the existing story-player callers or `playtest-town.mjs` as usual with Langfuse
keys exported. Each run emits `play-story`, timed scene/action spans,
`ended` (boolean), `failure_count` (numeric), and a failure event for every failure.
For town, `ended` means the scripted journey completed, not a narrative ending.
Browser startup errors also produce a failed trace. Playthroughs flush after each
run; the shared runtime flushes/shuts down on normal exit and termination signals.
No new model calls are introduced by playthrough tracing.

Offline verification:

```bash
pnpm typecheck                              # from repository root
pnpm --filter @anima/api exec tsc -p tsconfig.langfuse.json
pnpm exec vitest run --typecheck.enabled=false api/src/__tests__/services
```

Judge observations use type `evaluator`; Vercel AI SDK model calls use automatic
`generation` tracing with full model input context and media attachments. The raw
HTTP Decisions endpoint uses `decide-floor-hazards` with explicit generation usage
and request media. Question IDs, scene/actions, models and variants are metadata,
not observation names. Playthrough steps use `play-step` spans; these scripted
players are not AI agents. Trace summaries show place/background/questions and
pass/reason/probabilities, or scripted completion/failure counts. Tags are `anima`,
`floor-judge` or `playthrough`, and the variant; browser sessions set `sessionId`.
