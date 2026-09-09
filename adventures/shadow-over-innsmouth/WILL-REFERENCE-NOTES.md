# Will Reference Notes

The earlier Will repository was inspected through GitHub APIs
instead of cloning.

Files inspected:

- `package.json`
- `pnpm-workspace.yaml`
- `game/package.json`
- `game/src/game/main.ts`
- `game/src/game/SceneRegistry.ts`
- `game/src/game/scenes/BaseScene.ts`
- `game/src/game/systems/ScenePreloadManager.ts`

Relevant patterns pulled into the Innsmouth pass:

- Phaser runs at a 1920x1080 game resolution with full-screen scaling.
- Scenes are centrally registered and can be addressed by scene key.
- Scene classes inherit a base scene with player movement, hotspot lookup,
  editor registration, transition helpers, and scene preload hooks.
- The player is a character object, not a baked background element.
- Hotspots are scene objects with verbs and interaction callbacks, not only UI
  panel buttons.
- Scene transitions preserve spawn data.

Local application:

- `StoryGameScene` now extends Anima's local `BaseScene`.
- Hermes is an Anima `Character`.
- The playable review hotspots are Anima `Hotspot` instances.
- The scene remains data-driven through `standaloneScenes.ts`.
- Live character placements are stored as scene runtime overrides so transition
  spawns do not mutate the authored scene definitions.
