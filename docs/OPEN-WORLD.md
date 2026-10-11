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

Semantics from the LLM, coordinates from perception models, verification from the tool that already exists. Occlusion (walking behind things) stays out of scope.
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
