# Open-World Innsmouth
**Status:** playable local prototype, 2026-10-11. Persistent session worlds, shared visual-state and narrator caches, two anchors, generated child places with SAM/depth-derived walking geometry, voiced captions with a muted reading-time fallback, and dwell-prefetched choices are built. The larger town and swarm remain future work.

**One line:** what players can do narratively in The Pulse, done visually in Anima. A point-and-click Innsmouth where you can click anything, decide anything, and the town responds. Whole town. Load times must feel like a game, not a render farm.

**Reference:** diiverge.co (click an object → 3 outcomes → a generated clip → the new frame is the next scene, persistent across visitors). We keep the click-choose-grow loop and add what it lacks: a character, state, memory, a real town.

* * *
## Decisions
| Decision | Call | Why |
| --- | --- | --- |
| Player character | **Composited sprite** on generated backgrounds | Hermes already walks on calibrated groundlines. Baking him in loses consistency and movement. |
| NPCs | **Baked into the background** | Consistency per scene matters less; saves the sprite pipeline per NPC. Named NPCs (Kat, Zadok) can get sprites later. |
| Town | **Authored anchors** from the story graph, generated states and interiors around them | The StoryScript already defines the town. The model generates _versions_ of places, not places. |
| Cache | **Shared across all sessions**, keyed by visual state | One town. Revisits, replays and prefetch all hit the same store. |
| Video | **Not in v1.** Crossfade + sprite animation. | Keyframes cost seconds; video costs tens of seconds. Add for a few scripted "moments" later. |
| Narrator | The Pulse's nonlinear Innsmouth guide + fourth-wall rules, **structured output** instead of prose | The agency doctrine is the asset. Only the output format changes. |
## The loop
```
hover object      → name it (from segmentation)
click object      → narrator returns 3 grounded options + free-text "other"
choose            → narrator resolves: caption, state patch, visual delta, interactables
render            → NONE: caption + voice + sprite anim on current bg   (~1s)
                    SMALL: overlay / regional inpaint, hidden behind narration or caption reading time (~3-5s)
                    NEW:   fresh keyframe, fade under a readable caption (~10-15s, prefetched when possible)
```

Rule one: **most clicks never touch the image pipeline.** The narrator rates the visual delta; NONE is the default.
## Visual state (the cache key)
```
{ location, timeOfDay, weather, damage, npcsPresent[] }
```

Nothing else changes the picture. Inventory, flags, relationships live in text and sprites. Two runs that reach "harbor, night, fog, intact, [zadok]" get the same image. This is what makes the cache hit and the town coherent.
## Load-time strategy
1. **Bake the spine.** Anchor locations × their common visual states are generated at build time. The town is always warm.
  
2. **Prefetch on dwell.** Two seconds after arrival, request narrator options for the three largest interactables. Never prefetch paid image edits.
  
3. **Simulated players warm the cache.** The Pulse's test harness already runs groups of AI player archetypes through a story. Anima's StoryScript runtime and `window.__anima` can drive the real game. Combine them: run hundreds of agent sessions before launch, and every narrator resolution and every generated scene they trigger is cached. Real players mostly walk through a town that already exists. Metric: **cache hit rate on real-player actions**. Re-run the swarm whenever the guide or the art prompt changes.
  
4. **Hide the rest in fiction.** Speak captions immediately through `/api/tts`, with disk caching by text and narrator voice (George). Swap only after the image is ready and the first spoken sentence ends. With `?mute=1` or `VITE_MUTE=1`, skip both TTS fetching and playback; on mute or audio failure, retain reading time of 60 ms per character, at least 2.5 seconds. New-place travel holds on the darkened current frame and caption, then fades in. Never a spinner.
  
## Anchor locations (from the story graph)
Arkham bus depot (exterior, interior), bus, Innsmouth streets, Gilman House (lobby, room), town square, grocery, harbor, library, pier, church (exterior, interior), escape road, Devil Reef (approach, reef, descent, chamber), Boston apartment, the beach.

~18 places. Everything else the narrator opens on demand (an alley, a back room, a boat) is generated, cached, and attached to the graph as a child of its anchor.
## Narrator contract
Input: story guide, world state, current visual state, the clicked object, the chosen option (or free text).

Output (JSON):

```
caption        prose, 1–4 sentences, invitation not command
statePatch     { flags, inventory, npcMemory }
visual         { delta: "none"|"small"|"new", visualState?, imagePrompt?, region? }
interactables  [{ name, hint }]      only when delta != none
options        [3 strings]           only on click, before choose
```

The fourth-wall rules from The Pulse apply verbatim: describe TO the character, never FOR them.
## The walking line

Every attempt so far asked a model for the line and every model failed. The diagnosis: LLMs and image models are bad at pixel coordinates, and "the walking line" is a geometry problem posed as a vision question. Split it.

**What the engine actually needs** (`GroundLineConfig`, `ArtLandmarks.ts`): a path `y(x)` of ~6 points, and a scale factor per point. The verifier's perspective model is already linear: pixels-per-metre `ppm(y) = a·(y − horizonY)`. So the whole scale curve collapses to **one number, `horizonY`, plus one calibration constant** (how tall Hermes is at one reference point, a design choice, today `figureCalibration 0.8`).

**Implemented policy:** every generated place is derived and judged first. A failed judge triggers one adjusted derivation, then an explicitly logged inherited fallback. The demo requires derived geometry.

**The two paths (derive first, inherit only after two failed judgments):**

1. **Inherit.** Generated scenes are *edits* of anchor scenes with hand-calibrated lines, with the instruction to keep camera, horizon and ground. New interiors are edits of a few camera templates. This is the explicit fallback when two derived candidates fail the judge.
2. **Derive**, used for every new place:
   - **Floor mask** from SAM 3 (prompt: floor / ground / road / sand). Not an LLM.
   - **Horizon** from a depth model (Depth Anything v2): fit a plane to floor-mask depth, `horizonY` is the row where that plane meets the image plane. Not an LLM.
   - **Path `y(x)`**: per column of the floor mask take a fixed fraction of its vertical extent (mid-depth), low-pass, downsample to 6 points, catmull-rom. Columns with no floor become `freeWalkRanges` gaps.
   - **Scale** from `horizonY` and the calibration constant via the existing linear model. Write the result as a `.landmarks.json` so `verify:art` runs unchanged.
   - **Judge, not source:** render Hermes at five points and ask a vision model only "feet on ground, plausible size, yes/no". Models are fine at judging what they are bad at producing.

Semantics from the LLM, coordinates from perception models, verification from the tool that already exists. Occlusion layers and exit regions are derived alongside the floor and loaded by the scene.
## Build order
1. Built: narrator options and resolution on the two calibrated depot anchors.
2. Built: local libsql session worlds, inventory, flags, NPC memory, twelve-action history, and shared visual-state image cache.
3. Built: stable generated child places, SAM 3 floor masks, Depth Anything v2 plane fitting, mask-constrained walking, perspective scale, five-render vision judging, and landmark verification.
4. Built: narrator voice, TTS disk caching, mute switch, fallback reading delays, scene fades, and two-second dwell prefetch of narrator options.
5. Built: two-run town journey harness with screenshots, model-call ledger, cache statistics, and a silent crossfaded video. Whole-town baking and player swarms remain future work.

## Run the demo
Use the existing exported `OPENROUTER_API_KEY` and `FAL_KEY`. Voice is on by default for players and uses `ELEVENLABS_API_KEY` when configured. Development and automated runs use `?mute=1`, which skips TTS fetching and playback. From the repository root, in separate terminals:

```sh
PORT=4317 pnpm --filter @anima/api exec tsx src/index.ts
VITE_API_BASE_URL=http://localhost:4317/api pnpm --filter @anima/shadow-over-innsmouth dev --port 8080
```

Open `http://localhost:8080/` to play with voice, or `http://localhost:8080/?mute=1` to play muted. Click a visible object, then type “I paint a large red spiral on this object, clearly visible from across the platform.” Click another object and type “I follow the road out of town toward Innsmouth.” From there, type “I go down the alley beside this road.” Click the ground to walk; the left edge returns to the parent. Return twice to see the depot change, reload to verify persistence, and enter the depot doors for an interior interaction.

The automated journey picks objects from the returned labels and drives `window.__anima`:

```sh
node adventures/shadow-over-innsmouth/scripts/playtest-town.mjs 'http://localhost:8080/?mute=1' --run=1
node adventures/shadow-over-innsmouth/scripts/playtest-town.mjs 'http://localhost:8080/?mute=1' --run=2
pnpm --filter @anima/api exec tsx ../adventures/shadow-over-innsmouth/scripts/ground-eval.mjs
pnpm --filter @anima/shadow-over-innsmouth verify:art 'http://localhost:8080/?mute=1' --generated
```

The journey harness always adds `mute=1`. To mute every browser on the development server, prefix the Vite command with `VITE_MUTE=1`.

Requires `agent-browser`, ImageMagick, and ffmpeg on PATH. Each run starts a fresh session but shares cached places, images, and narrator responses. Frames, `journey.md`, `journey.mp4`, ground evaluation and art reports live in `tmp/open-world-demo/`. Persistent state and the budget ledger live in `api/data/`; generated images and landmark files live in the adventure’s `public/generated/`. These outputs are not committed. Image attempts are capped at 50 and perception attempts at 200 across the task.

Calibration uses exterior/interior floor fractions 0.62/0.25, smoothing radii 5/100 mask columns, exterior relative-depth zero −32.9, and perspective slopes 0.0019284/0.0039. Line candidates require at least 120 pixels of contiguous floor; the exterior retry uses fraction 0.45 to avoid foreground clutter. This is camera-template calibration, not metric depth. The interior anchor has no authored horizon value; its line and scale are the ground-truth comparison. Generated landmarks check consistency with the derived camera calibration; the independent vision judge and walk-frame inspection check plausibility against the art.

## Open questions
- Segmentation: SAM 3 vs. asking the image model / Gemini for labeled boxes. Boxes may be enough for hotspots; masks needed for floor.
  
- Does the existing StoryScript stay as the _spine_ (scripted beats still fire) with the narrator filling the gaps, or does the narrator own everything and StoryScript becomes the world bible? Leaning spine.
  
- Cost ceiling per session.

## Verification record (2026-10-11)

Anchor evaluation: exterior mean/max line error 12.44/23.90 px and mean/max scale ratio error 3.26/6.11%; interior 15.00/18.11 px and 4.73/8.67%. Exterior horizon 470.01 px vs authored 470; interior fitted horizon 659.84 px (no authored horizon to compare). Both meet the 25 px / 10% targets.

Perception endpoints checked against fal's model catalog: [SAM 3](https://fal.ai/models/fal-ai/sam-3/image/api) and [Depth Anything v2](https://fal.ai/models/fal-ai/image-preprocessors/depth-anything/v2/api). Both are perception models; Gemini is used only for narration, object labels and the yes/no art judge.

Live voice verification is reserved for the owner. Automated tests mock fetch and Audio, cover first-sentence completion, mute with zero requests, TTS failure and autoplay rejection. All development browser sessions use mute. The narrator may occasionally repeat a previous action or add unsupported narrative details; the journey records the actual output and asserts actual image/state changes.

Final muted journeys: both passed steps 1–6 including 2b, with 20 frames each. Run 2 hit 47/50 recorded pipeline cache lookups (94%); its three misses were narrator-option calls (1.44–1.51 s). All resolution, image and place requests hit cache. No TTS calls or audio playback. Cumulative task budget: 11/50 image-edit attempts and 13/200 perception attempts. API tests: 53 passed; both package typechecks and lints passed. All three generated places passed art verification with derived geometry and 5/5 judge approvals each.

## Shared walk area and motor (2026-10-11)

Runtime walking now uses an engine `WalkArea` for anchors and generated places:
`mask`, `Perspective`, base scale and scale clamps. The 384×216 navigation grid
is derived from existing data; upsampling a cached SAM mask adds no new perception
information. Anchor masks rasterize each authored free-walk band from its minimum
Y to the interpolated line, capped above the caption panel. The exterior bands
are disconnected: a free click cannot cross the gap occupied by the vehicles.
Scripted exit routes remain explicit exceptions until exits become floor regions.

`perspective.ts` owns scale evaluation and camera calibration. Exterior fitting
uses the landmark horizon (470). Fitting the current interior authored line gives
338.376, **not** 659.84: that earlier value describes the generated interior camera,
not these authored line points. Per-point residuals preserve every authored scale.
Bare-fit mean/max errors are exterior 0.0294%/0.0585%, interior 0.2027%/0.3252%;
with residuals both are zero to floating-point precision. The legacy `groundLine`
is still emitted for the editor, art verifier, journey harness and `__anima`.

Projection uses `Z = 1 / (slope * (y - horizonY))` and `X = (x - cx) * Z`.
Metric conversion explicitly applies camera focal length (1000 px) and reference
pixels per metre (base sprite height / 1.75 m). `CharacterMotor` advances at 1 m/s
from scene `update(delta)`, projects back to the screen, evaluates current-position
scale, and supplies ground-velocity heading and animation cadence. A motor-attached
`Character` skips the legacy line hook. Scale factors are bounded to 0.18–1.5.
Debug snapshots include full-precision ground coordinates; rounded screen pixels
are insufficient for measuring slow movement into depth.

Navigation erodes by a 0.3 m footprint diameter, with at least one grid cell of
clearance, finds targets in the starting connected component, runs eight-connected
A* without corner cutting, then shortcuts only along visible floor. Interactables
and hotspots take precedence over floor clicks, including below y=680. This can
make some floor beneath broad object bounding boxes unclickable; region-accurate
object picking is a later refinement. `previewWalk` exposes the exact route for
read-only QA, while recordings and the journey drive `__anima.click`.

Step 6 remains separate: author exit polygons within reachable floor, validate
parent/child arrival points and connected routes, and replace the generated-place
left-edge shortcut. Walk-behind objects need aligned alpha masks and per-object
feet baselines, lifecycle/loading support, and independent crossing tests. The
existing exterior vehicle overlay retains its authored baseline; general scene
occluders are not part of this walking migration.

Walking verification: `tmp/walkarea/REPORT.md` records the real-time 1920×1080,
24 fps takes and inspected 6 fps sheets. Measured wall-clock ground-speed CV:
road depth 0.003327; road diagonals 0.003381; alley 0.003407; exterior 0.003330;
interior 0.003157 (all below 0.15). Town run 4 passed with 52 cached call-ledger
rows and zero uncached calls. Both anchor art checks pass. All package typechecks
pass; full game lint is affected by separate concurrent occluder JSON artifacts,
while game source/script lint passes. Toward idle retains the inherited profile
pose: a safety hook blocked the follow-up idle/telemetry edit; away idle holds
its away-cycle frame.


## Animation-owned walking and geometry review (2026-10-11)

The motor supports screen-space root displacement on animation frame changes.
Hermes uses the sheet fps, per-frame `rootMotion` and the current perspective scale;
the legacy metre-speed mode remains available to other engine clients. Generate the
metadata with `packages/sprite-tools/scripts/root-motion.py sheet.json --axis x|y
--travel -1|1`. The script retains its measured seven-row alpha contact centroid in
`footContacts`, uses measured deltas during contact, and recovers lateral drift on
airborne frames so the cycle has no net sideways locomotion. Position follows the
navigation polyline, including small signed stance corrections. Scale is recomputed
at the new position. Toward and away stops retain their corresponding neutral pose.

**Acceptance limitation:** the supplied lowest-alpha contact metric includes heel/toe
roll and lateral movement in the depth sprites. Projection onto a straight path
cannot cancel its perpendicular component. The measured side cycle is much closer;
this work must not be described as passing the depth-walk acceptance gate. Full
per-walk results and frame sequences are in `tmp/walkqa` (local, not versioned).

Object picking and hover share the alpha mask of each available occluder. A floor
pixel has priority; other objects fall back to their box minus visible floor. An
object click searches reachable floor in front of its contact and requests options
only after arrival. Erode physical floor first, then clip the feet at the caption
boundary, so a UI edge does not consume additional navigable ground.

Walk-behind PNGs use per-column supporting contacts. Contact samples retain their
own column's bottom; canopy columns do not become supporting floor contacts.
The nearest supporting baseline extends to overhanging portions of the image;
only overlapping opaque pixels actually hide Hermes. Equal depth draws Hermes last.
Layers wholly outside all reachable sprite bounds are hidden, but retain their masks
for interaction. Authored anchor layers and exit JSON are versioned; generated place
data and segmentation cache metadata remain local.

Hidden floor is bridged **geometrically**, by filling only an occluder silhouette
strip above its baseline when visible floor exists immediately on both sides of
that strip. No model predicts hidden floor. This is the owner's chosen rule from
the walking brief; the prior-art patent discussion is retained in the local research.
It does not invent routes where either visible support side is missing.

Generated children have parent-return edge regions. Eroded/clipped exit approaches
are projected onto navigable floor, and authored door destinations come from the
existing story routes. Known neighbour destinations take precedence over a parent.
Walking into a region triggers once until the character leaves it; far exits invoke
the existing narrator travel pipeline. New place creation completes object perception,
occluders and exits before persisting the place. `?debug=1` shows these regions.

`render-walk.mjs --plan=plan.json --out=tmp/walkqa/place` captures lossless game frames
through the exclusive virtual clock and encodes at exactly 24 fps. A plan supplies
`place`, optional `start`, and `beats` with `name`, `click` (or `object`/`exit`) and
`frames`. All runs force `?mute=1`. `--keep-frames` retains PNGs; telemetry and 6 fps
contact sheets accompany each clip. Exact duplicate counts during walking supplement
`freeze.py`, whose whole-frame threshold can classify small sprites as inactive.
