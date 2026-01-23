# Anima Engine — Feature Roadmap

## Core Architecture

### Console-First Design
The game is fully console-driven. Graphics are a presentation layer, not the source of truth.

**Principle:** Declare the game imperatively in the console → graphics hook on top.

**Why:**
- Playtest stories without waiting for art
- Debug game logic directly
- Script automated testing
- The StoryScript interpreter IS the game
- GUI is just a renderer

**Current state:** Basic interpreter exists (`packages/storyscript/src/interpreter.ts`) with:
- Scene navigation
- Hotspot interactions (look/talk/use)
- Dialogue trees with choices
- Inventory & flags
- Triggers & cutscenes

**Next steps:**
- [ ] Expose full game state via console commands
- [ ] Allow scripting sequences for testing
- [ ] Event bus that GUI can subscribe to
- [ ] Headless mode for CI/automated playtesting

---

## Planned Features

### Location-Dependent Events
NPCs and events that trigger based on map position / story progression.

**Use case:** Innsmouth NPCs appear or disappear depending on where you are in the story:
- Early game: normal-looking townsfolk
- Mid game: slightly "off" versions appear
- Late game: full Innsmouth Look NPCs dominate

**Implementation ideas:**
- Story flags control NPC visibility
- Scenes can define conditional hotspots: `IF flag THEN show NPC`
- NPCs have "stages" (normal → transitional → transformed)
- Map regions can have different NPC pools based on progression

### Other Planned Features
- [ ] Parallax background layers
- [ ] Character animation (walk cycles via Veo)
- [ ] Inventory system with item combinations
- [ ] Save/load game state
- [ ] Dialogue portraits
- [ ] Sound/music integration

---
*Last updated: 2026-01-19*
