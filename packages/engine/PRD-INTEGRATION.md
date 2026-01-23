# Anima Engine Integration Gaps

Complete Act 1 playthrough capability for Shadow Over Innsmouth.

## Context

Integration tests revealed gaps between unit tests passing and actual gameplay working. The HeadlessRunner can start the game and verify scenes, but dialogue choices and hotspot interactions don't execute their full logic.

## Requirements

### Dialogue System Completion
- Selecting a dialogue choice executes its branch
- GIVE commands add items to inventory
- SET_FLAG commands update game flags  
- GOTO commands transition to new scenes
- Nested IF/ELSE in dialogues evaluate flags correctly

### Hotspot Interaction Completion
- USE action executes the hotspot's USE block
- IF HAS(item) conditionals check inventory
- IF NOT HAS(item) handles negative checks
- GOTO within USE triggers scene transitions
- REQUIRE blocks actions until conditions met

### Trigger System
- TRIGGER blocks can be invoked by ID
- Triggers execute their content (dialogue, GOTO, flags)
- trigger:execute event emits

### Multi-Scene Progression
- All 5 Act 1 scenes load: bus_station → bus_interior → innsmouth_streets → hotel_lobby → hotel_room
- Scene transitions preserve inventory and flags
- ON_ENTER blocks execute on scene entry

### Act Completion
- ACT_END signals act completion
- act:complete event emits
- Game state ready for next act

## Acceptance Criteria

1. Integration test "should get ticket from clerk dialogue" passes
2. Integration test "should board bus with ticket" passes
3. Full Act 1 playthrough test passes (new test to write)
4. All 68+ unit tests still pass
5. pnpm test exits 0

## Technical Notes

- Engine is in `packages/engine/src/`
- Story files in `adventures/shadow-over-innsmouth/story/`
- HeadlessRunner in `src/HeadlessRunner.ts`
- GameRunner in `src/GameRunner.ts`
- StoryInterpreter from `@anima/storyscript` package
