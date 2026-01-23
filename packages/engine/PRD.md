# @anima/engine - Product Requirements Document

## Overview

A UI-agnostic game engine for point-and-click adventures. Decoupled from rendering — any UI (terminal, React, Phaser) can subscribe to events and render accordingly.

## Quality Gates

These commands must pass for every user story:
- `pnpm --filter @anima/engine test` - All tests pass
- `pnpm --filter @anima/engine build` - TypeScript compiles without errors

## User Stories

### US-001: EventBus Core
**As a** UI developer  
**I want** an event bus that emits typed game events  
**So that** I can subscribe and render game state changes

**Acceptance Criteria:**
- [x] EventBus class with subscribe/emit methods
- [x] Typed GameEvent union type
- [x] Unsubscribe returns cleanup function
- [x] Multiple subscribers receive same event
- [x] Optional event logging for debugging
- **Status: DONE**

---

### US-002: GameState Core
**As a** game developer  
**I want** a pure state container that is serializable  
**So that** I can save/load game progress and test state changes

**Acceptance Criteria:**
- [ ] GameState class (not singleton - instantiable)
- [ ] Track current scene, visited scenes
- [ ] Track flags (boolean/string/number)
- [ ] Track inventory (array of item IDs)
- [ ] Track NPC states
- [ ] toJSON() / fromJSON() for serialization
- [ ] reset() method

**Depends on:** None

---

### US-003: StoryInterpreter Integration
**As a** game developer  
**I want** GameRunner to integrate with StoryInterpreter  
**So that** .story files drive the game logic

**Acceptance Criteria:**
- [ ] GameRunner accepts story content string
- [ ] GameRunner creates StoryInterpreter instance
- [ ] start() loads story and enters first scene
- [ ] getAvailableHotspots() returns current scene hotspots
- [ ] getSceneDescription() returns current scene text

**Depends on:** US-001, US-002

---

### US-004: Scene Navigation
**As a** player  
**I want** to navigate between scenes  
**So that** I can explore the game world

**Acceptance Criteria:**
- [ ] enterScene(sceneId) changes current scene
- [ ] Emits 'scene:exit' for old scene
- [ ] Emits 'scene:enter' with description for new scene
- [ ] Updates GameState.currentScene
- [ ] Tracks visited scenes in GameState

**Depends on:** US-003

---

### US-005: Hotspot Interactions
**As a** player  
**I want** to look at, talk to, and use hotspots  
**So that** I can interact with the game world

**Acceptance Criteria:**
- [ ] lookAt(hotspotId) emits 'hotspot:look' with text
- [ ] talkTo(hotspotId) starts dialogue if available
- [ ] use(hotspotId) executes use action
- [ ] Invalid hotspot ID returns error/no-op

**Depends on:** US-004

---

### US-006: Dialogue System
**As a** player  
**I want** to have conversations with choices  
**So that** I can interact with characters

**Acceptance Criteria:**
- [ ] Starting dialogue emits 'dialogue:start'
- [ ] Each line emits 'dialogue:line' with speaker + text
- [ ] Choices emit 'dialogue:choice' with options
- [ ] selectChoice(index) continues dialogue
- [ ] Dialogue end emits 'dialogue:end'
- [ ] Dialogue can set flags, give items, change scenes

**Depends on:** US-005

---

### US-007: Inventory Management
**As a** player  
**I want** to collect and use items  
**So that** I can solve puzzles

**Acceptance Criteria:**
- [ ] addItem(itemId) adds to inventory, emits 'inventory:add'
- [ ] removeItem(itemId) removes from inventory, emits 'inventory:remove'
- [ ] hasItem(itemId) checks inventory
- [ ] getInventory() returns all items
- [ ] useItemOn(itemId, targetId) for combining/using items

**Depends on:** US-002

---

### US-008: Flag System
**As a** game developer  
**I want** to set and check flags  
**So that** I can track game progression

**Acceptance Criteria:**
- [ ] setFlag(key, value) sets flag, emits 'flag:set'
- [ ] getFlag(key) returns flag value
- [ ] Flags can be boolean, string, or number
- [ ] Conditional logic in story uses flags

**Depends on:** US-002

---

### US-009: Save/Load System
**As a** player  
**I want** to save and load my progress  
**So that** I can continue later

**Acceptance Criteria:**
- [ ] save() returns JSON string of full state
- [ ] load(saveData) restores state from JSON
- [ ] After load, game is in exact same state
- [ ] Save includes: scene, flags, inventory, visited, NPCs

**Depends on:** US-002, US-004

---

### US-010: NPC Location System
**As a** game developer  
**I want** NPCs to appear/disappear based on flags  
**So that** the world feels dynamic

**Acceptance Criteria:**
- [ ] NPCs defined with visibility conditions
- [ ] getVisibleNPCs(sceneId) returns NPCs for scene based on flags
- [ ] NPC visibility updates when flags change
- [ ] NPCs can have different states (e.g., "friendly", "hostile")

**Depends on:** US-008

---

### US-011: Headless Test Runner
**As a** game developer  
**I want** to run stories headlessly with assertions  
**So that** I can test game logic in CI

**Acceptance Criteria:**
- [ ] runHeadless(storyContent, script) executes commands
- [ ] Script can: enterScene, selectChoice, assertFlag, assertInventory
- [ ] Returns pass/fail with details
- [ ] No UI dependencies (runs in Node)

**Depends on:** US-009

---

## Non-Goals

- Rendering/UI code (that's for ui-* packages)
- Audio playback
- Asset loading
- Animation
- Phaser/DOM dependencies

## Technical Considerations

- Pure TypeScript, no browser APIs
- Works in Node.js and browser
- EventBus is synchronous (no async emit)
- GameState is mutable but provides immutable snapshots via toJSON()
- StoryInterpreter from @anima/storyscript is a dependency

## File Structure

```
packages/engine/
  src/
    index.ts           # Exports
    EventBus.ts        # Event system
    EventBus.test.ts   # Tests
    GameState.ts       # State container
    GameState.test.ts  # Tests
    GameRunner.ts      # Orchestrator
    GameRunner.test.ts # Tests
    NPCManager.ts      # NPC location logic
    NPCManager.test.ts # Tests
    HeadlessRunner.ts  # CI test runner
    HeadlessRunner.test.ts
```

## Success Metrics

- All 11 user stories complete
- 100% test coverage on core modules
- Can run Shadow over Innsmouth in terminal via HeadlessRunner
- Can run same story in React UI by swapping renderer

---
*PRD created: 2026-01-19*
