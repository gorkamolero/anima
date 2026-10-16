# Footfall

`@anima/footfall` is Anima's deterministic, sprite-contact-driven walking system for 2.5D adventure backgrounds. It contains the production geometry and footstep planner, the Phaser motor binding, a headless runner, derivation contracts and reusable QA functions. Innsmouth is one consumer; game narrative, asset naming, persistence and provider credentials stay outside the package.

## Model

**Perspective.** A horizon and scale slope project screen positions to ground space and back. Optional horizontal residuals preserve authored calibration. A walk area supplies base scale and clamps. Degenerate legacy calibration can use a constant model. Derivation records can carry regional depth/scale descriptions; the current runtime walk area still uses one perspective model.

**Walk area.** Row-major binary masks describe visible floor, raw physical support, routing clearance and object footprints separately. Clearance erosion happens in ground units. Baseline-guided geometric bridging restores floor behind occluders; it does not predict hidden floor with a trained model. Supported narrow gaps retain their existing stride-sweep rules.

**Footstep lattice.** Navigation proposes a route; the bounded planner searches authored stance transitions in eight ground headings. Each transition uses the sheet's physical contact points, permitted entry/exit phases, facing validity and clearance. Authored strides determine attainable arrivals: arbitrary clicks need not coincide with a planted stop.

**Foot locking and settles.** The motor projects the planted contact through the current scale and flip, then solves sprite placement around that anchor. Switching support, standing pivots and drawn settle frames retain the existing timing, cancellation and worker behavior. No pose interpolation or altered animation data is introduced by this package. The pure planner requires an injected `now` clock. The motor uses a virtual clock and a deterministic 1,600–8, 000-node budget based on horizontal ground span so worker and headless route selection remain identical.

**Occlusion.** Occluder baselines determine behind/in-front ordering from the planted foot. Alpha-aware object hits and support footprints are separate from draw order. Numbered semantic outlines are associated with named interactables by category and bounding-box overlap, then tested against their actual alpha. Partial category masks add positive hits while preserving named-box fallback; exact named masks remain authoritative, with split outlines combined. The Phaser adapter loads alpha masks and renders object layers; the pure core consumes geometry and alpha callbacks.

**Exits.** Boundary-inclusive regions, requested-exit guards, latches and return approaches determine when travel may begin. The game owns travel and narrative resolution. The runner receives scene records and transition timing so the same motion and exit logic can run without browser rendering.

## Layout

- `core/characters/`: foot contacts, locking, stance/stride sweeps, heading, clearance routes and lattice search.
- `core/walkarea/`, `core/groundline/`, `core/occlusion/`: perspective, masks, navigation, authored anchors, floor bridging, object hits, arrivals and exits. No DOM, Phaser or Node runtime imports.
- `phaser/`: worker-backed motor, sprite pose binding, placement debug overlay and occluder layers.
- `derive/`: image-to-ground/occluder/exit provider contract and serialized data types. The existing cached fal implementation lives in `api/src/services/footfall-provider.ts`.
- `sim/`: injected headless runner, scene/walk interfaces and capture-clock subdivision.
- `qa/`: deterministic coverage plans and log checks. Reviewer Python programs remain independent acceptance tools.

## Quick start

```ts
import { CharacterMotor, findPath } from '@anima/footfall';
import { spriteFootBinding } from '@anima/footfall/phaser/spriteFootBinding';

const binding = spriteFootBinding(() => sprite, name => sheets[name]);
const motor = new CharacterMotor(sprite, area, onMotion, {
  current: binding.current,
  show: binding.show,
  select: heading => directionalPose(heading),
  standing: heading => standingPose(heading),
});
motor.place(spawn);
void motor.walk(findPath(area.mask, sprite, clickedPoint));
// Call once from the Phaser scene update:
motor.update(deltaMs);
// Scene shutdown:
motor.detach();
```

Pass your game's directional sheet mapping; Footfall does not assume Hermes asset names. Keep the motor as the sole position/scale owner during a walk. `phaser/debugOverlay` exposes the existing overlay drawing function; Innsmouth enables it with `?debug=1` and owns labels and visibility.

## Data formats

Coordinates use the existing 1920 × 1080 scene space. Sprite contacts use unscaled sheet-frame pixels, origin at the frame's top left. The rendered sprite origin is bottom centre. `flipX` mirrors horizontal contact offsets.

```json
{"name":"walk-right","frameWidth":612,"frameHeight":1059,"fps":24,
 "contacts":[{"planted":"L","L":{"x":300,"y":1030},"R":{"x":350,"y":1028}}],
 "switchFrames":[0]}
```

`FootCycle` also supports `frameDurationsMs`, `passingFrames`, `settleFrames`, and `matchedCut` (standing sheet, compatible headings, entry and exit frames). Contact labels must match the authored drawings. Every displayed frame needs contact data.

```json
{"mask":{"width":2,"height":2,"data":[0, 0,1,1]},
 "perspective":{"horizonY":470,"slope":0.002,"pixelsPerMetre":300},
 "baseScale":0.5,"scaleClamp":{"min":0.18,"max":1.5}}
```

Masks map their full raster extent to scene space; nonzero cells are supported. Optional `rawMask`, `clearanceMask` and `objectFootprints` preserve their distinct meanings. Perspective additionally accepts `cx`, `focalLength`, `constant` and `residual: [{x,k}]`. See the interfaces for derivation-region polygons, masks and piecewise `scaleAtY` records.

```json
{"id":"crate","label":"crate","bbox":{"x":800,"y":500,"w":200,"h":300},
 "baseline":[{"x":800,"y":800},{"x":1000,"y":800}],"png":"crate.png"}
```

Occluders may include `floorDecal`, `obstacle` and height/mask-coverage metadata. Exit records use `id`, `kind` (`edge-left`, `edge-right`, `near`, `far`, `door`), `region: [{x,y}]`, and optional `approach`, `label`, `to`.

## Run your own scenes

Use `generateWalkPlan(sceneRecord)` from `qa/plans`, or supply `{beats:[{name,start:[x,y],click:[x,y]}]}`. Plans cover extrema, diagonals, behind/back crossings, a corridor candidate, unreachable and object clicks, and each exit. Missing coverage is reported on the beat; inspect generated plans for your scene.

Call `simulateWalks` from `sim/runner` with:

- `scenes`: named `{location, plan}` records;
- `loadWalkRecords`: prepared geometry, alpha callbacks, exits and connections;
- `sheets`, `animation`, `initialTexture`: your sprite metadata and directional mapping;
- `storedOptions`: cached interaction responses;
- `Fade`: your transition clock (Innsmouth uses Phaser's actual Fade implementation);
- `save(path,value)`: your log sink, plus optional `out`, selected walk names, extra sprite occluders and immediate-transition locations.

The runner returns a report and writes per-frame arrays, events, search rejections and scene geometry through the sink. It makes no provider calls. For live verification against generated candidates, the API accepts `ANIMA_WORLD_DB_URL=file:/absolute/path/to/qa.db`; a copied database can contain those derivations without changing the saved world. Unset it to use the normal project database. Shipped anchor assets are separate from database-backed generated scenes and must be accounted for explicitly. Execution timings in the top-level run report are diagnostic; scene JSON is deterministic.

Innsmouth's read-only adapter remains runnable from the repository root:

```sh
api/node_modules/.bin/tsx adventures/shadow-over-innsmouth/scripts/simulate-walks.mts --run=my-run
node scripts/compare-footfall-runs.mjs tmp/walkqa/sim/pkg-before tmp/walkqa/sim/my-run
pnpm --filter @anima/footfall test
pnpm --filter @anima/footfall typecheck
pnpm --filter @anima/footfall lint
```

For example, with the emitted frame array and geometry JSON:

```ts
import { checkFootLock, checkFloor, checkScale } from '@anima/footfall/qa';
const metadata = (texture: string) => sheets[texture];
const results = {
  lock: checkFootLock(frames, metadata),
  floor: checkFloor(frames, geometry, metadata),
  scale: checkScale(frames, geometry),
};
```

For QA, import `qa/checks`: `checkFootLock`, `checkFloor`, `checkScale`, `checkFacing`, `checkArrival`, `checkDrawOrder`, `checkPath`, `checkExits` and `checkFrozenFrames`. Supply sheet metadata and scene areas. Facing accepts the independently calculated route corner count; path checking accepts an independent shortest octilinear distance; draw order requires exact alpha-overlap callbacks. Frozen-frame checking requires rendered frame hashes, not transform logs. Telemetry cannot establish drawn-boot accuracy or pixel-height correctness; retain rendered review and the independent reviewer tools for those bars.

## Planning bounds and current evidence

Each click uses one bounded footstep search. Support changes and grounded restarts are edges in that frontier; there is no retry ladder. State retains heading/run limits and the captured start's turn allowance. Intermediate pivots use normal body clearance. Exact terminal playback validates measured facing before accepting a route.

Planning reuses deterministic Dijkstra frontiers, exact stance samples, immutable entry/standing pose lists, and playback-prefix checkpoints. Checkpoints include the following step because its anchor determines stride length. These caches do not approximate positions, weaken collision checks or change the fixed node budgets. Planning changes are checked against per-frame motion logs; interaction event timing is checked separately.

Current verification (2026-10-16, derivation 20 candidates and rebuilt occluder data): `128-playback-full` passes with 113 half-stride arrivals, 137 facing passes, 0 reversals/flicker/floor violations/object contacts, planning p90 260 ms and max 863 ms. `128-playback-gen` passes with 33 half-stride arrivals, 41 facing passes, 0 reversals/flicker/floor violations/object contacts, p90 286 ms and max 484 ms. All 185 package tests and 123 API tests pass, as do root typecheck and lint. Identical stop edges are evaluated once, preserving stop-only phases. At the first reachable support, valid finishes are ranked by their complete sampled playback, without changing route costs. Visible peak jumps improve in 47 of 180 walks and increase in none against run118; animation defects remain. Prefix checkpoints retain consumed poses and the next anchor used for stride length. Cache optimizations preserve all 180 playback logs against the finish-ranking run before cache optimization. The square building click again selects the building after semantic outlines were regenerated; options wait for facing settles. The source keeps SAM floor/water/object signals and adds cached MoGe geometry; original saved scene floors are not overwritten by the harness candidate override. Older run87 used different occluder sidecars, so its 120 main-scene arrivals are historical evidence, not current-input results.

The complete Footfall goal remains open. Remaining arrival misses include a quay entrance that loads correctly but cannot complete its inward stride. Exact-alpha draw-order checks pass all 180 run128 walks; 60 run105 crossing triplets and four run128 before/after turn triplets were reviewed, exposing unresolved direction-change pose jumps. Complete run128 visual sign-off remains open. Contact sheets are available for every walk. Strict zero-duplicate animation, complete path/feet/pixel-scale verification, interaction/exit coverage, browser parity, art verification and the town replay still need sign-off. Deliberate two-tick settle poses and the authored cadence are retained; passing numeric gates does not waive these remaining requirements. See `tmp/walkqa/report.md` and `tmp/walkqa/reports/FINAL.md` for the current audit.
