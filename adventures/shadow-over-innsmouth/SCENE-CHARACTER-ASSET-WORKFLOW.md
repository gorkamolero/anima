# Scene Character Asset Workflow

This workflow is for character poses that must fit a specific playable scene.
It exists because direct "make a transparent sprite" prompts drift too easily:
the pose may be correct but the scale, bench contact, lighting, and perspective
will not match the scene. For seated characters, generate the pose in the
scene first, then isolate the character.

## Current Target

Kat seated in the Arkham bus depot, on the bench, with `seatedIdle` and
`seatedTalk` states for the playable starting scene.

Current scene files:

- `src/game/scenes/standaloneScenes.ts`
- `src/game/scenes/StoryGameScene.ts`
- `WILL-REFERENCE-NOTES.md`

Current scene background:

- `public/backgrounds/arkham-bus-depot-flat-2d.png`

Current full character references:

- `art/@kat.jpeg`
- `packages/sprite-tools/sources/innsmouth/kat-standing-ref.png`

Do not use this file as a final sprite:

- `public/assets/sprites/kat/kat-seated-depot.png`

That file is a rough baked-background crop. It was useful to prove staging, but
it is not a valid final asset because it carries its own window/counter/bench
rectangle into the scene.

## Required Process

### 1. Feed Full References

Use full character references, not cropped partials.

For Kat, feed:

- the full turnaround/reference sheet from `art/@kat.jpeg`
- the clean depot background from `public/backgrounds/arkham-bus-depot-flat-2d.png`
- optionally the standing single-reference image from
  `packages/sprite-tools/sources/innsmouth/kat-standing-ref.png`

The scene image is not the final output. It is a pose, lighting, perspective,
and contact reference.

### 2. Generate a Scene Composite

Ask for Kat seated in the actual depot scene. The purpose is to solve:

- bench contact
- seated body mechanics
- scale relative to windows and bench
- warm depot lighting
- correct facing toward Hermes
- consistent adventure-game linework

This same rule applies to movable characters like Hermes. Once a base movable
sprite exists and proves the mechanics, do not assume it is the best visual
asset for every scene. Prefer an ad hoc scene-composite pass for each important
scene unless the shared sprite has already been visually proven at that scene's
camera, ground line, lighting, and scale.

For Hermes, generate scene composites from:

- full Hermes references: `art/@hermes.jpeg`
- optional single-pose reference:
  `packages/sprite-tools/sources/innsmouth/hermes-standing-ref.png`
- the actual scene background, such as:
  - `public/backgrounds/2026-01-27-bus-station.png`
  - `public/backgrounds/arkham-bus-depot-flat-2d.png`

Use the composite to derive:

- believable sprite scale
- feet/ground anchor
- x/y staging for entrances and hotspot approaches
- whether the generic walk loop visually fits the scene
- whether a scene-specific Hermes idle/walk variant is needed

The generic movable loop is acceptable only when it passes this visual check.
The better default is scene-specific character staging from full references.

Current Hermes placement result:

- Interior Hermes scale in `standaloneScenes.ts`: `0.43`
- Exterior Hermes scale in `standaloneScenes.ts`: `0.5`
- Exterior waiting-bench TALK route: `{ x: 755, y: 976 }`
- Interior waiting-bench TALK approach: `{ x: 780, y: 890 }`
- Ground-line sizing is now calibrated with per-point `scaleFactor` values,
  using Catmull-Rom interpolation. Do not go back to one-off Y-only
  perspective scaling for important scenes.
- The exterior door transition is a scripted offscreen exit: Hermes walks past
  the right edge to `x: 2140`, is hidden, then respawns inside. Do not fake this
  by stopping him at the visible edge.
- Exterior Hermes base scale is `0.5`. This was chosen after comparing the
  live rendered character against Kat in browser screenshots. The earlier
  `1.2`/`1.572` numbers were raw sprite-frame scale values and made Hermes a
  giant because the transparent sprite frame is 1059 px tall. Final review
  uses visual human height, not raw frame scale.
- The source placement direction remains the generated
  scene-placement reference
  `art/generated/hermes-exterior-kat-placement-reference-v1.png`, made by
  feeding the accepted non-Hermes exterior/Kat scene and the full Hermes
  reference to imagegen. The important correction is not only "make Hermes
  bigger": the runtime must validate visual height in the actual browser,
  with the Kat approach at `{ x: 755, y: 976, scale: 0.53 }`. Do not accept
  calibration until the visual-reference audit and clicked screenshots show
  correct adult-vs-seated sizing.

## Automated Placement Calibration

Scene placement is a repeatable process now:

1. Add or update a calibration manifest under `placement-calibration/`.
2. Run:

   ```bash
   pnpm --filter @anima/shadow-over-innsmouth calibrate:placement prompt placement-calibration/<manifest>.json
   ```

3. Feed the generated prompt to imagegen with the listed background, full
   character reference, and current transparent sprite reference. The prompt
   asks for a 5-6 position contact sheet in the actual scene.
4. Measure each model-placed character instance:

   ```json
   {
     "id": "door_approach",
     "x": 880,
     "y": 907,
     "displayHeight": 418,
     "facing": "right"
   }
   ```

   Use `scaleFactor` directly when you already know it. Otherwise the script
   derives `scaleFactor = displayHeight / referenceDisplayHeight`.
5. Run:

   ```bash
   pnpm --filter @anima/shadow-over-innsmouth calibrate:placement apply placement-calibration/<manifest>.json
   ```

6. Copy the emitted `groundLine` and idle anchors into the scene definition.
7. Run:

   ```bash
   pnpm --filter @anima/shadow-over-innsmouth verify:scene http://localhost:8080/
   ```

8. For scenes generated from an explicit character-in-scene placement
   reference, run the visual-reference audit:

   ```bash
   pnpm --filter @anima/shadow-over-innsmouth audit:visual-reference http://localhost:8080/
   ```

   This clicks the playable scene, captures the runtime state, reads the
   sprite alpha bounds, compares Hermes against the generated reference, and
   writes `tmp/visual-reference-audits/outside-kat-talk.png` plus a JSON
   report. The current exterior talk target is `561.27px` actual visible
   height against `560.77px` expected, with the foot point at `{ x: 755,
   y: 976 }`.

9. For any scene with foreground character movement, run a scene-scale
   filmstrip review:

   ```bash
   pnpm --filter @anima/shadow-over-innsmouth review:scene-scale http://localhost:8080/ scene-scale-reviews/<manifest>.json
   ```

   This is manifest-driven and not exterior-specific. The script drives the
   actual browser scene, samples the listed character positions, captures the
   game with the in-engine debug overlay enabled, and writes a contact sheet
   plus JSON report under `tmp/scene-scale-reviews/<id>/`. The renderer must
   not draw replacement boxes or foot markers; the screenshot's in-game green
   bounds and red foot marker are the visual truth. Alpha measurements remain
   metadata only.

   The current exterior manifest is `scene-scale-reviews/outside-route.json`.
   Its contact sheet is
   `tmp/scene-scale-reviews/outside-route/outside-route.png`. The review
   also writes full-size per-frame review images under
   `tmp/scene-scale-reviews/outside-route/review-frames/`. Inspect those first
   with vision; the contact sheet is only an index. Record the judgment in a
   review artifact such as `SCENE-SCALE-VISION-REVIEW.md`.

   The current exterior review showed normal free walking should use two
   intervals: `x:200..760` and `x:1280..1520`. `x:120` clips the character,
   the Kat-overlap span around `x:1040` is not a clean idle pose, and the
   bus/door points at `x:1660` and `x:1800` are route-only samples, not
   ordinary idle endpoints.

10. For scenes with foreground character movement, run a rendered sizing pass:

   ```bash
   pnpm --filter @anima/shadow-over-innsmouth review:exterior-sizing http://localhost:8080/
   ```

   This writes `tmp/exterior-sizing/exterior-sizing-contact-sheet.png` and a
   JSON report of each placed Hermes scale/height. Use that sheet to adjust
   `baseScale`, `scaleFactor`, and route points before calling the scene done.

11. Click the actual playable hotspots in the browser and inspect screenshots.
   The non-negotiable exterior evidence from the current pass is:

   - TALK: `tmp/scene-line-outside-bench-talk-after-fix.png`,
     `x: 755`, `y: 976`, `scale: 0.53`
   - bus USE: `tmp/full-review/23-bus-rescaled.png`,
     `x: 1660`, `y: 945`, `scale: 0.3997`
   - door USE: `tmp/full-review/24-door-rescaled.png`,
     transition `exitX: 2140`, `exitY: 942`

Runtime engine notes:

- The ground-line callback must read the character's current `getBaseScale()`.
  Capturing the constructor scale regresses scene-specific calibration.
- Hermes world-bounds collision is disabled in this scene. Otherwise Arcade
  physics pushes large sprites downward until their full frame fits onscreen,
  breaking feet-on-ground placement.
- `freeWalkBounds` can limit ordinary click-to-walk without changing authored
  hotspot routes. Use it when a line segment only works as a scripted route
  and should not be a normal idle endpoint.
- `freeWalkRanges` can carve holes out of the free-walk line when a middle
  span visually overlaps a character or prop. Hotspot routes can still target
  those spans deliberately.

The current manifests are:

- `placement-calibration/hermes-terminal-flat-exterior.json`
- `placement-calibration/hermes-terminal-exterior.json`
- `placement-calibration/hermes-depot-interior.json`
- `scene-scale-reviews/outside-route.json`

The generated artifacts are written to:

- `tmp/placement-calibration/terminal-flat-exterior-hermes.prompt.md`
- `tmp/placement-calibration/terminal-flat-exterior-hermes.placement.json`
- `tmp/placement-calibration/terminal-exterior-hermes.prompt.md`
- `tmp/placement-calibration/terminal-exterior-hermes.placement.json`
- `tmp/placement-calibration/depot-interior-hermes.prompt.md`
- `tmp/placement-calibration/depot-interior-hermes.placement.json`

The runtime path uses:

- `groundLine.interpolation: "catmull-rom"` for walk trajectory smoothing
- per-point `scaleFactor` for model-derived sizing
- `motionState: "walk" | "idle"` in the QA snapshot so verifiers wait for
  true idle arrival, not merely a near-target frame
- `animationState`, `animationKey`, and `displayHeight` in the QA snapshot.
  The verifier must assert that characters enter `idle` after walking and
  switch to `talk` during conversations.
- A placement debug overlay is enabled in review scenes. It draws the ground
  line, point scale factors, Hermes feet crosshair, bounding box, base/current
  scale, display height, motion state, and active animation key. Toggle it with
  `D` while reviewing; leave it enabled for calibration screenshots.
- `exitTo` plus `hideOnExit` for door/bus transitions that need the character
  to leave the camera before changing scenes. The verifier must assert the
  recorded `lastTransition.exitX` is offscreen and
  `lastTransition.hiddenBeforeTransition` is true.
- The playable-scene verifier reads the active placement manifests and compares
  them against the live runtime ground lines/base scales. If scene data drifts
  from measured placement data, `verify:scene` fails.

This is the rule going forward: important scene placement comes from a
background + full-character + sprite-reference imagegen contact sheet, then
measured positions become scene data. The code should not be hand-guessing
scale or feet Y once a scene enters production.

## Character Animation Requirements

Every playable character needs explicit animation states:

- `idle`: a loop for standing or seated rest. This must exist whenever the
  character is visible and not moving.
- `walk`: a locomotion loop used only during movement.
- `talk`: a loop used during dialogue, separate from idle when the asset
  pipeline has produced one.

Runtime fallback is allowed only as a temporary development state. For final
scene approval, generate proper transparent per-character/per-scene loops and
wire them into the same state slots rather than changing scene code.

The asset contract lives in:

- `animation-assets/review-scene-characters.json`

Run the non-strict audit while building the system:

```bash
pnpm --filter @anima/shadow-over-innsmouth audit:animation-assets
```

Run the strict audit before calling animation art final:

```bash
pnpm --filter @anima/shadow-over-innsmouth audit:animation-assets -- --strict-final
```

As of the current pass, strict mode passes for Hermes and Kat. Hermes idle and
talk were generated as state-specific loops, BRIA alpha-removed, extracted into
spritesheets, and normalized to the shared `612x1059` Hermes frame box so
scene scale stays stable across idle/walk/talk.

Current Hermes state assets:

- idle: `public/assets/sprites/hermes/hermes-idle-v2-normalized.png`
- walk: `public/assets/sprites/hermes/hermes-fal-veo-transparent-loop.png`
- talk: `public/assets/sprites/hermes/hermes-talk-v1-normalized.png`

For seated Kat outside, the accepted scene composite is the source of truth:

- `art/generated/kat-outside-station-bench-composite-v1.png`
- `public/backgrounds/bus-station-kat-seated-composite-v1.png`

The playable exterior currently keeps Kat baked into that accepted composite and
keeps the standalone exterior Kat sprite hidden. Any future transparent exterior
Kat sprite must be extracted from that exact composite; do not substitute a new
seated generation that no longer contacts the bench.

Continuity rule: do not show Kat outside and inside at the same time. If the
accepted exterior composite bakes Kat onto the outside bench, the immediate
station-door transition must not also render/spawn interior Kat unless an
explicit authored state transition moves her. For the plain "Hermes enters the
station" route, keep Kat outside and hide/remove interior Kat. If a later script
needs Kat inside, add a story-state transition first and make the verifier assert
that state.

The shared Hermes walk loop is accepted for the current exterior/interior
starting flow. If a later scene makes him look pasted, giant, tiny, or
mis-grounded, run this same composite pass and create a scene-specific Hermes
idle/walk loop.

Working generated intermediate:

- `art/generated/kat-seated-depot-composite-v1.png`
- `art/generated/hermes-scene-placement-composite-v1.png`
- `art/generated/kat-outside-station-bench-composite-v1.png`
- `art/generated/hermes-exterior-kat-placement-reference-v1.png`
- `art/generated/hermes-terminal-exterior-placement-contact-v1.png`
- `art/generated/hermes-terminal-flat-exterior-placement-contact-v1.png`

Source generation folder:

- `/Users/gorkolas/.codex/generated_images/019df349-22bd-7c51-8849-00399d86aa90`

Prompt used for `kat-seated-depot-composite-v1.png`:

```text
Use case: illustration-story
Asset type: game scene pose-generation reference for later sprite isolation
Input images: Image 1 is the full Kat character turnaround reference; Image 2 is the clean Arkham bus depot interior scene; Image 3 is a close front-view Kat reference.
Primary request: Place Kat into the clean Arkham bus depot scene, seated naturally on the wooden bench under the large center-right window. Preserve Kat's identity from the references: short messy black hair with hair pin, pale tired face, bored guarded expression, black leather jacket, dark band T-shirt, ripped blue jeans, black combat boots, olive backpack with punk patches. She should be seated as a separate readable character in the scene, not standing.
Scene/backdrop: Use the depot image as the staging reference: warm morning light, wooden bench, arched window, bus depot illustration style. Keep the background consistent and do not add extra people.
Pose: seated idle pose, slouched but alert, one leg bent and one boot forward or crossed naturally, arms crossed or resting in a guarded punk posture, looking slightly left toward where Hermes would approach. The whole body must be visible, including boots and backpack.
Style: match the existing 2D hand-drawn adventure game art style, ink outlines, painterly warm lighting, same perspective and scale as the depot background.
Critical constraints: Do not crop Kat. Do not make her sweaty, glamorous, smiling, old, or realistic-photo. Do not change her outfit. Do not bake Hermes into the scene. Do not add text. Do not use a rectangular pasted crop. Do not create a close-up portrait. This is a scene-composite target for extracting a transparent seated Kat sprite later.
```

Prompt used for `hermes-scene-placement-composite-v1.png`:

```text
Use case: illustration-story
Asset type: game scene placement reference for later sprite scaling and anchor extraction
Input images: Image 1 is the full Hermes character turnaround/reference sheet; Image 2 is the clean Arkham bus depot interior background; Image 3 is the Innsmouth terminal exterior background.
Primary request: Create a wide adventure-game scene placement reference showing Hermes placed believably in BOTH environments as small full-body overlay studies: one Hermes standing/walking inside the depot near the ticket window and one Hermes standing outside on the terminal platform near the depot doors. Preserve Hermes' identity from the reference: 22-year-old nerdy anxious young man, messy brown hair, round glasses, brown tweed jacket, green sweater vest, collared shirt, brown trousers, brown shoes, leather satchel. He should be full-body, readable, and scaled to the scene perspective.
Scene/backdrop: Use the depot interior and exterior as strict staging references for camera distance, ground line, lighting, and perspective. Keep the existing backgrounds recognizable and do not redesign them.
Composition/framing: Make this a practical placement study with Hermes integrated into the scene at believable game scale, feet planted on the correct walkable ground line. Do not crop Hermes. No close-up portraits.
Style/medium: Match the existing 2D hand-drawn adventure game art style, ink outlines, painterly lighting.
Critical constraints: Do not create a transparent sprite. Do not isolate Hermes. Do not make him giant or tiny. Do not change his outfit, face, hair, glasses, satchel, or proportions. Do not add Kat or any other people. Do not add labels, arrows, text, UI, watermarks, or rectangular pasted crops. This is a scene-composite reference only, used to derive sprite scale and anchor.
```

Acceptance criteria for the composite:

- Kat is seated on the correct bench.
- Kat keeps the same character identity and clothing.
- Kat's full seated body is visible.
- The pose feels natural at scene scale.
- The image does not introduce Hermes or unrelated characters.

Rejection criteria:

- Kat is standing.
- Kat becomes a close-up portrait.
- Kat is cropped.
- The model changes her outfit, hair, age, expression, or body type.
- The depot geometry changes so much that isolation will not align with the
  clean background.

### 3. Isolate Kat From the Composite

After the composite is accepted, isolate only Kat into a transparent PNG.

The output must be character-only:

- Kat body
- boots
- backpack if attached to her pose
- no bench
- no window
- no counter
- no rectangular scene patch
- no cast shadow baked into the sprite unless intentionally handled as a
  separate shadow layer

Preferred isolation path:

1. Use an image edit/isolation pass with the composite as the edit target:
   "isolate only Kat from this scene, preserving her exact seated pose and
   clothing, remove bench/background/window/counter, place on flat chroma key."
2. Run local chroma-key removal or background removal.
3. Validate alpha directly.
4. Save the final PNG under `public/assets/sprites/kat/`.

Do not wire the composite itself into Phaser.

For movable characters, apply the same rule: do not wire a scene composite as a
sprite. Use it to establish scale and anchor, then create or select a transparent
sprite/loop that matches the scene. If the existing transparent loop does not
fit, generate a scene-specific idle/walk variant from the full references.

### 4. Create Idle and Talk Variants

`seatedIdle` and `seatedTalk` are separate state slots in the playable scene.

Idle target:

- guarded, bored, headphones-on or closed-off expression
- body still and readable
- no mouth-open talking expression

Talk still target:

- same pose, scale, and anchor as idle
- subtle mouth/expression change only
- no body-scale jump
- no outfit or identity drift

Both still states must share a compatible anchor point. In Phaser, they should
be placed with `origin(0.5, 1)` and should not visibly jump when state changes.

For final talk behavior, prefer a short transparent video/spritesheet loop over
a generated talk still. Generate the talk loop from the accepted seated idle
pose/reference, remove the background through the sprite pipeline, and export
frames to a same-size transparent spritesheet. A two-frame still swap is only a
minimal accepted game asset when video generation fails visual acceptance.

Rejected video attempts:

- `art/generated/kat-seated-talk-loop-veo-v1.mp4`: rejected because the model
  cropped Kat and used a black background.
- `art/generated/kat-seated-talk-loop-veo-v2.mp4`: rejected because the model
  cropped Kat's head and still used a black background.

The accepted current talk state is therefore the transparent seated talk frame
assembled with the seated idle frame into a Phaser spritesheet. A richer
video-derived loop remains a future quality upgrade, not the current blocking
asset.

### 5. Verify Transparency

Do not rely only on magenta previews or eyeballing the game scene.

Run a direct alpha check:

```bash
magick identify -format '%f alpha-min=%[fx:minima.a] alpha-max=%[fx:maxima.a]\n' \
  adventures/shadow-over-innsmouth/public/assets/sprites/kat/kat-seated-*.png
```

Expected:

- `alpha-min=0`
- `alpha-max=1`
- transparent corners when viewed directly
- no rectangular background patch

Also inspect the actual PNG before wiring it:

```bash
magick identify adventures/shadow-over-innsmouth/public/assets/sprites/kat/kat-seated-idle.png
```

### 6. Wire Into the Scene

Only after isolation passes should `StoryGameScene.ts` load final seated assets.

Current final paths:

- `public/assets/sprites/kat/kat-seated-idle.png`
- `public/assets/sprites/kat/kat-seated-talk.png`
- `public/assets/sprites/kat/kat-seated-talk-loop.png`
- `public/assets/sprites/kat/kat-seated-talk-loop-preview.webm`

The scene data should keep using state slots:

- `seatedIdle`
- `seatedTalk`

The renderer must switch animation by state, and TALK on the waiting bench
should set Kat to `seatedTalk`.

Generate a short review video whenever a loop changes:

```bash
packages/sprite-tools/.venv/bin/python packages/sprite-tools/scripts/make-loop-preview.py \
  --frames \
  adventures/shadow-over-innsmouth/public/assets/sprites/kat/kat-seated-idle.png \
  adventures/shadow-over-innsmouth/public/assets/sprites/kat/kat-seated-talk.png \
  --out adventures/shadow-over-innsmouth/public/assets/sprites/kat/kat-seated-talk-loop-preview.webm \
  --fps 4 \
  --loops 8
```

### 7. Playable Verification

Run:

```bash
pnpm --filter @anima/shadow-over-innsmouth typecheck
pnpm --filter @anima/shadow-over-innsmouth build
pnpm --filter @anima/shadow-over-innsmouth dev -- --host 127.0.0.1 --port 8080
```

Use `agent-browser` to verify the actual playable scene:

- exterior starts with Hermes as the movable sprite
- clicking depot doors moves Hermes, then transitions inside
- inside uses clean depot background
- Kat is a transparent seated sprite, not a scene patch
- clicking Kat/waiting bench moves Hermes to the bench, then switches Kat to
  `seatedTalk`
- screenshots or video are captured from the playable scene

Kill the dev server after verification.

## Current Status

Complete:

- Full references identified.
- Clean depot background identified.
- Scene composite generated and saved:
  `art/generated/kat-seated-depot-composite-v1.png`.
- Hermes placement composite generated and saved:
  `art/generated/hermes-scene-placement-composite-v1.png`.
- Scene code has explicit `seatedIdle` and `seatedTalk` slots.
- Scene code uses Anima `BaseScene`, `Character`, and `Hotspot` for the
  playable standalone pass.
- Will reference patterns were inspected and summarized in
  `WILL-REFERENCE-NOTES.md`.
- Kat has been isolated to transparent PNGs:
  - `public/assets/sprites/kat/kat-seated-idle.png`
  - `public/assets/sprites/kat/kat-seated-talk.png`
- The two seated PNGs are normalized to a shared `820x880` transparent canvas.
- A two-frame transparent state spritesheet exists at
  `public/assets/sprites/kat/kat-seated-talk-loop.png`.
- A 4-second loop preview video exists at
  `public/assets/sprites/kat/kat-seated-talk-loop-preview.webm`.
- Playable browser flow has been recorded:
  `tmp/playable-scene-flow.webm`.

Future upgrades:

- Replace the two-frame `seatedTalk` asset with a richer transparent talk loop
  if video generation produces an uncropped, stable seated result.
- Create a scene-specific Hermes transparent idle/walk loop if the shared
  Hermes walk cycle fails visual review in later scenes.
