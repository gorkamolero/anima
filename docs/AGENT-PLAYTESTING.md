# Agent Playtesting

How an agent (or CI) drives, observes, and asserts against a running Anima
game. This is the layer that lets agents actually *playtest* — not just read
code and guess.

## The API: `window.__anima`

Every `BaseScene` installs `window.__anima` in `create()`
(`packages/engine/src/debug/AgentDebug.ts`). No per-game wiring needed.

```js
const anima = window.__anima;

anima.step(1000);        // advance the game 1s of virtual time, frame by frame
anima.click(1000, 550);  // click at GAME coords (1920x1080), scaled to the canvas
anima.hover(x, y);       // pointer move
anima.snapshot();        // structured dump: characters, hotspots, groundline, camera
anima.scene;             // the live BaseScene — call scene-specific APIs on it

// pump frames until a condition holds (throws after timeoutMs of virtual time)
await anima.waitUntil((snap) => {
  const hermes = snap.characters.find((c) => c.id === "hermes");
  return hermes.animationState === "idle" && Math.abs(hermes.x - 755) <= 8;
});
```

`snapshot().characters[]` gives per-character `x/y/scale/baseScale/depth/
visible/flipX/displayHeight/animationState/animationKey/textureKey/bounds` —
enough to assert sizing, occlusion order, and animation state numerically
instead of squinting at screenshots.

## Why virtual time and mouse events (the two traps)

1. **Hidden tabs freeze the game.** Phaser runs on `requestAnimationFrame`,
   which never fires in a hidden/headless tab. The game *looks* alive
   (screenshots render, input handlers fire) but `preUpdate` never runs:
   characters play their walk animation while frozen in place, and every
   awaited `walkToPosition()` hangs forever. `anima.step()`/`waitUntil()`
   drive `game.loop.step()` with a virtual clock, so tests behave identically
   visible, hidden, or headless. Never wait on RAF or wall-clock `setTimeout`
   (background tabs throttle timers to ≥1s).

2. **Phaser ignores synthetic `PointerEvent`s.** It listens for `mousedown`/
   `mouseup`/`mousemove` (and touch). `anima.click()` dispatches the right
   events at canvas-scaled coordinates — don't hand-roll `PointerEvent`s.

## Running a playtest

```bash
pnpm dev                                              # game on :8080
cd adventures/shadow-over-innsmouth
pnpm playtest                                         # full journey, 10 checks
node scripts/playtest-journey.mjs http://other:8080/  # custom url
```

`scripts/playtest-journey.mjs` is the reference implementation: it drives a
complete player journey (talk → walk → use → scene transition → round trip)
via `agent-browser` + `__anima`, asserts states and sizes at each beat, and
saves screenshots to `tmp/`. Known past bugs live in it as named
`REGRESSION` checks (sticky talk animation, scale loss on round trip) — add
one for every behavior bug you fix.

Write few, comprehensive journeys — one test that creates real state,
mutates it, and verifies the result beats ten that check UI existence.

## The tween trap: Phaser tweens run on wall-clock time

`TweenManager.getDelta()` uses `Date.now()`, not the game loop's delta
(Phaser 3.60+). Consequence: **tweened motion is invisible to the virtual
clock** — under `step()`-driven playtests it doesn't move at all, and during
frame-by-frame recording it races at real-time speed and desyncs from the
footage.

Rule: any gameplay motion that must be playtestable or filmable is driven
from `update(time, delta)` with the loop delta — never `this.tweens`.
See `StoryGameScene.updateHermesPath()` for the pattern (scripted path with
per-frame distance budget). Tweens remain fine for purely cosmetic,
untimed flourishes.

## Verify staging semantically — never by looking at pixels

Staging claims ("hidden behind the bus", "head shows above the car",
"arrives at door scale", "never stops moving") are geometry claims. Assert
them on numbers, not screenshots:

- **`__anima.visibility(characterId)`** — the visibility oracle. Samples
  the character's own silhouette alpha, tests each body point against
  every higher-depth textured object's alpha, returns the visible
  fraction. Pure geometry + texture lookup, no rendering.
- **Per-frame semantic traces** — step the virtual clock, record
  `{x, y, scale, anim, visibleFraction}` per frame, then assert on the
  timeline: max hidden span, no stall while visible, arrival size vs a
  landmark. See the instrumented depot-doors step in
  `scripts/playtest-journey.mjs`.

Why this is the rule: pixel tools failed both ways in practice. ffmpeg's
freezedetect flagged a small distant walking figure (and a talking head)
as "frozen"; eyeballing extracted frames misjudged beat timing repeatedly;
meanwhile the oracle was correct every time. Video is a deliverable for
HUMANS to judge look and feel — agents verify with traces.

agent-browser note: always pass `--session <name>` (the scripts use
`--session anima`) — the default session is shared machine-wide, and
another tool can navigate your tab between commands.

## Recording video

`__anima.captureFrame()` advances one output frame of virtual time and
returns the rendered canvas as a JPEG data URL — deterministic 30fps
filming that works headless (no screen recording; WebGL is read via
Phaser's `renderer.snapshot` during the stepped render).

```bash
pnpm record            # films the full journey -> tmp/anima-journey.mp4
pnpm record -- --debug # keep the placement overlay visible
```

`scripts/record-journey.mjs` is the reference: click a beat, film N
seconds, pull frames to disk, encode with ffmpeg. Edit its `BEATS` array
to film a different scenario.

## Interactive debugging from an agent session

With any browser-eval tool (preview eval, agent-browser, claude-in-chrome):

```js
window.__anima.step(500);                      // unfreeze a hidden tab
window.__anima.click(1550, 450);               // use the depot doors
await window.__anima.waitUntil(s => !s.inputBlocked);
window.__anima.snapshot();                     // see what actually happened
```

Scene-specific state (story runtime, review scene id, output lines) is on
`window.__anima.scene` — e.g. `StoryGameScene.getReviewQaSnapshot()`.

## Art landmarks: backgrounds describe their own geometry

Every background ships a `backgrounds/<image>.landmarks.json` recording what
the art actually contains — so scene data is **derived and verified**, never
hand-tuned against pixels. The engine module is
`packages/engine/src/verification/ArtLandmarks.ts`; the live entry point is
`window.__anima.verifyArt(landmarksUrl)`.

```jsonc
{
  "image": "my-scene.png",
  "space": "game",              // rects in 1920x1080 game coords
  "horizonY": 470,              // optional: perspective vanishing line
  "figureCalibration": 0.8,     // optional: accepted creative deviation, explicit
  "landmarks": [
    // known-height objects anchor the pixels-per-meter perspective model
    { "id": "kat", "kind": "figure", "rect": {...}, "realHeightM": 1.65, "standingFactor": 0.78 },
    { "id": "bus", "kind": "object", "rect": {...}, "realHeightM": 3.0,
      "use": false, "note": "painted at half scale - needs art fix" },
    // regions declare what a hotspot must cover
    { "id": "bench", "kind": "region", "rect": {...}, "hotspotId": "waiting_bench" }
  ]
}
```

`verifyArt` checks four things and reports each failure **with the value to
use instead**:

1. **Art internal consistency** — landmarks that disagree with each other
   (elements painted at incompatible scales) are flagged; no data fix can
   satisfy them, only an art fix. `use: false` + note records the known ones.
2. **Character scale** — each rendered character's pixel height vs the model.
3. **Groundline scale curve** — every scaleFactor vs geometry (kills fake
   perspective like a 41% size swing on a flat walkline).
4. **Hotspot bounds** — each hotspot must overlap its declared art region.

Run it: `pnpm verify:art` (in the adventure, dev server running). **When a
background regenerates, update its landmarks file, run `pnpm verify:art`,
and apply the suggested numbers** — that is the whole recalibration workflow.

Derived values in scene data carry a comment pointing at their landmarks
file. If you change one by hand, verify:art will tell on you.

## What this still can't see

- **Occlusion**: scenes are single flat images; characters render on top of
  everything. "Walks behind X" needs foreground cutout layers before it can
  be asserted (task chip exists for the bus).
