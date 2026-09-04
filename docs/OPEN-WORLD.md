# Open-World Innsmouth
**Status:** design draft, 2026-09-03. Nothing built yet.

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
                    SMALL: overlay / regional inpaint, hidden behind voice line (~3-5s)
                    NEW:   fresh keyframe, iris out slowly under narration (~10-15s, prefetched when possible)
```

Rule one: **most clicks never touch the image pipeline.** The narrator rates the visual delta; NONE is the default.
## Visual state (the cache key)
```
{ location, timeOfDay, weather, damage, npcsPresent[] }
```

Nothing else changes the picture. Inventory, flags, relationships live in text and sprites. Two runs that reach "harbor, night, fog, intact, [zadok]" get the same image. This is what makes the cache hit and the town coherent.
## Load-time strategy
1. **Bake the spine.** Anchor locations × their common visual states are generated at build time. The town is always warm.
  
2. **Prefetch on dwell.** While the player is in a scene, render its exits in the current visual state and the narrator's top predicted outcomes.
  
3. **Simulated players warm the cache.** The Pulse's test harness already runs groups of AI player archetypes through a story. Anima's StoryScript runtime and `window.__anima` can drive the real game. Combine them: run hundreds of agent sessions before launch, and every narrator resolution and every generated scene they trigger is cached. Real players mostly walk through a town that already exists. Metric: **cache hit rate on real-player actions**. Re-run the swarm whenever the guide or the art prompt changes.
  
4. **Hide the rest in fiction.** Stream text and ElevenLabs audio immediately (The Pulse does this today). A spoken caption buys 8–15s. If still not ready, hold on ambience over a dark frame. Never a spinner.
  
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
## The walking line (the unsolved piece)

Every attempt so far asked a model for the line and every model failed. The diagnosis: LLMs and image models are bad at pixel coordinates, and "the walking line" is a geometry problem posed as a vision question. Split it.

**What the engine actually needs** (`GroundLineConfig`, `ArtLandmarks.ts`): a path `y(x)` of ~6 points, and a scale factor per point. The verifier's perspective model is already linear: pixels-per-metre `ppm(y) = a·(y − horizonY)`. So the whole scale curve collapses to **one number, `horizonY`, plus one calibration constant** (how tall Hermes is at one reference point, a design choice, today `figureCalibration 0.8`).

**Two paths, in order of preference:**

1. **Inherit.** Generated scenes are *edits* of anchor scenes with hand-calibrated lines, with the instruction to keep camera, horizon and ground. New interiors are edits of a few camera templates. The line is copied, never derived. This covers most of the town.
2. **Derive**, only for a genuinely new camera:
   - **Floor mask** from SAM 3 (prompt: floor / ground / road / sand). Not an LLM.
   - **Horizon** from a depth model (Depth Anything v2): fit a plane to floor-mask depth, `horizonY` is the row where that plane meets the image plane. Not an LLM.
   - **Path `y(x)`**: per column of the floor mask take a fixed fraction of its vertical extent (mid-depth), low-pass, downsample to 6 points, catmull-rom. Columns with no floor become `freeWalkRanges` gaps.
   - **Scale** from `horizonY` and the calibration constant via the existing linear model. Write the result as a `.landmarks.json` so `verify:art` runs unchanged.
   - **Judge, not source:** render Hermes at five points and ask a vision model only "feet on ground, plausible size, yes/no". Models are fine at judging what they are bad at producing.

Semantics from the LLM, coordinates from perception models, verification from the tool that already exists. Occlusion (walking behind things) stays out of scope.
## Build order
1. **Narrator route** in `api/` (Hono, Vercel AI SDK). Pulse guide, structured output. Text-only, on the two depot scenes that already run.
  
2. **Visual state + cache** (Turso) + exit prefetcher.
  
3. **Keyframe → hotspots → groundline.** nano-banana-2 with ART-STYLE prompt, segmentation, derived groundline, verified with existing tools.
  
4. **Bake the anchors** from the story graph. Open the doors.
  
5. **Port the Pulse harness** to drive Anima's runtime and the narrator route. Run the swarm, measure hit rate, tune.
  
## Open questions
- Segmentation: SAM 3 vs. asking the image model / Gemini for labeled boxes. Boxes may be enough for hotspots; masks needed for floor.
  
- Does the existing StoryScript stay as the _spine_ (scripted beats still fire) with the narrator filling the gaps, or does the narrator own everything and StoryScript becomes the world bible? Leaning spine.
  
- Cost ceiling per session.
