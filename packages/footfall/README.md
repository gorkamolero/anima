# Footfall

`@anima/footfall` is Anima's deterministic, continuous-path walking system for 2.5D adventure backgrounds. It contains the production geometry and navigation, the Phaser motor binding, a headless runner, derivation contracts and reusable QA functions. Innsmouth is one consumer; game narrative, asset naming, persistence and provider credentials stay outside the package.

## Model

`WalkMotor` moves the ground point (`anchor`) continuously along a copied navigation path on every render update. Ground speed follows the gait: `strideScale` (a multiple of the stride the sheet draws) times `stridesPerSecond`, per heading if wanted; screen speed is that times `pixelsPerMetre × scaleAt(anchor)`. `speedMetresPerSecond` overrides it absolutely. Perspective supplies depth scaling, optional horizontal calibration and scale clamps. Navigation uses floor masks and object clearance; occluder baselines determine draw order from the ground point.

The ground heading selects the directional drawing. Side and diagonal cycles advance by distance travelled: each drawing lasts as long as the body needs to cover the sheet distance the planted sole travels to the next drawing, so the feet stay on the ground at any speed. Depth cycles (toward, away) have no lateral sole travel and advance at their authored frame durations. Turns preserve the fractional gait phase. The default ground speed is the side cycle's own speed at its authored rate. Per-sheet `bodyCentreX` aligns the drawn body horizontally; otherwise the motor uses the cycle's mean sole midpoint. The mean sole row locates the drawing vertically. Optional `drawnHeight` normalises each sheet's sprite scale relative to the `left` cycle.

On arrival the anchor snaps exactly to the final waypoint, the standing pose appears, `walking` becomes false, and the walk promise resolves. The arrival record exposes the target and final anchor for exit handling. Boundary-inclusive exit regions, requested-exit guards and latches decide when travel starts; the game owns destination loading and narrative resolution. `stop()` resolves an interrupted walk at its current anchor and shows the standing pose.

## Layout

- `core/characters/`: contact types and projection helpers, plus ground-heading selection.
- `core/walkarea/`, `core/groundline/`, `core/occlusion/`: perspective, masks, navigation, authored anchors, floor bridging, object hits, arrivals and exits. No DOM, Phaser or Node runtime imports.
- `phaser/`: continuous walking motor, sprite pose binding, placement debug overlay and occluder layers.
- `derive/`: image-to-ground/occluder/exit provider contract and serialized data types. The existing cached fal implementation lives in `api/src/services/footfall-provider.ts`.
- `sim/`: injected headless runner, scene/walk interfaces and capture-clock subdivision.
- `qa/`: deterministic coverage plans and log checks. Reviewer Python programs remain independent acceptance tools.

## Quick start

```ts
import { WalkMotor, findWalkPath } from '@anima/footfall';
import { spriteFootBinding } from '@anima/footfall/phaser/spriteFootBinding';

const binding = spriteFootBinding(() => sprite, name => sheets[name]);
const motor = new WalkMotor(sprite, area, onMotion, {
  current: binding.current,
  show: binding.show,
  select: heading => directionalPose(heading),
  standing: heading => standingPose(heading),
});
motor.place(spawn);
void motor.walk(findWalkPath(area, motor.anchor, clickedPoint));
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

Optional `bodyCentreX` and `drawnHeight` describe the drawn body in sheet pixels. Every displayed frame needs contact data. Walking animation advances at the cycle's native `fps`.

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

The runner returns a report and writes per-frame arrays, events and scene geometry through the sink. It makes no provider calls. For live verification against generated candidates, the API accepts `ANIMA_WORLD_DB_URL=file:/absolute/path/to/qa.db`; a copied database can contain those derivations without changing the saved world. Unset it to use the normal project database. Shipped anchor assets are separate from database-backed generated scenes and must be accounted for explicitly. The frame arrays contain sprite position, scale, texture/frame, heading, ground anchor, path, arrival, draw order and interaction state. The run report includes frame counts, arrivals, limitations and elapsed time; elapsed time is diagnostic.

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
import { checkFloor, checkScale } from '@anima/footfall/qa';
const metadata = (texture: string) => sheets[texture];
const results = {
  floor: checkFloor(frames, geometry, metadata),
  scale: checkScale(frames, geometry, metadata, leftCycle),
};
```

For QA, import `qa/checks`: `checkFloor`, `checkScale`, `checkFacing`, `checkArrival`, `checkDrawOrder`, `checkPath`, `checkExits` and `checkFrozenFrames`. Supply sheet metadata and scene areas. Scale checking takes the sheet lookup and reference left cycle when height normalisation is used. Facing compares consecutive ground positions and accepts the independently calculated route corner count plus scene geometry (needed for constant perspective); arrival checks the exact final navigation endpoint. Path checking accepts an independent shortest octilinear distance; draw order requires exact alpha-overlap callbacks. Frozen-frame checking requires rendered frame hashes, not transform logs. Telemetry cannot establish drawn-boot accuracy or pixel-height correctness; retain rendered review and the independent reviewer tools for those bars.
