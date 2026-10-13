# Brief 27 — validity checks and the reachable lattice

**Status: acceptance FAILS.** The lattice is larger, but the requested 90% half-stride arrival and zero stuck-start bars are not met. These are named implementation limitations, not proof that the scenes are impossible.

Branch `open-world-mvp`; baseline `7218629`. Read `docs/FOOTFALL-GOAL.md`, brief 26, and the ten requested commits. Production fixes are individually committed with the requested co-author. No reviewer tools or assets were edited. Pre-existing `calls.md`, `tools/walkstats.py`, and `AgentDebug.test.ts` were preserved.

## Result

- Nearest-standable arrival: **12 / 116 → 27 / 118 within half a stride** (22.9% after); **26 → 44 within one stride** (37.3% after). **90 → 74 beyond one stride.** Before: 118 arrival records, 2 scene transfers, 21 missing. After: 121 records, 3 transfers, 18 missing. The denominators are exactly those emitted by the unchanged reviewer tool.
- All-walk median expansions: **30 → 75**. Median among walks beyond one stride: **32.5 → 64.5**. The 4,000-node cap is unchanged.
- Reviewer-style stuck count (arrival present, same scene, final target >150 px from first logged body, net body movement <40 px): **8 → 5**. Counting walks without arrival records too: **28 → 22**. Missing arrival records: **21 → 18**. The arrival-only audit omits these; they are not successes.
- **139/139 floor and object-contact, body clearance, stance lock, scale, and draw-order passes.** Maximum measured stance excursion **0.0 px**. Pier/object's prior 59.63 px excursion and inside/exit-bus_platform's off-floor return are repaired.
- Final simulator: **139 walks in 8.713 s**, read-only stored records, no network calls. Final evidence: [`27-final`](../sim/27-final/), [`diagnostics.json`](../sim/27-final/diagnostics.json), [`checks.json`](../sim/27-final/checks.json).

## What actually rejected actions

Counts below aggregate all observed plans per walk, including destination arrivals. They are rejected simulator calls, not frames or distinct physical states. A rejected call gets its final concrete failure reason. `entry` and `stop-entry` are separate calls. Final entry selection validates an advance before accepting its phase, so advance failures move into the entry histogram; zero final `advance` failures does not mean that collision checks were removed. Full action-by-reason counts are in the following table and each walk's rejection file.

| Action / rejection | Before | After |
|---|---:|---:|
| `entry:no-entry-frame` | 1,128 | 1,136 |
| `stop-entry:no-entry-frame` | 1,128 | 1,136 |
| `entry:no-exit-frame` | 0 | 0 |
| `rest:no-exit-frame` | 0 | 0 |
| `advance:no-stance` | 0 | 0 |
| `entry:facing-invalid` | 19,656 | 48,134 |
| `rest:facing-invalid` | 505 | 2,188 |
| `entry:sole-off-floor` | 0 | 17,108 |
| `stop-entry:sole-off-floor` | 0 | 179 |
| `advance:sole-off-floor` | 4,492 | 0 |
| `rest:sole-off-floor` | 368 | 1,072 |
| `entry:sole-on-object-footprint` | 0 | 0 |
| `entry:body-off-clearance` | 0 | 17,398 |
| `advance:body-off-clearance` | 4,350 | 0 |
| `rest:body-off-clearance` | 716 | 2,388 |
| `entry:swept-segment-blocked` | 0 | 3,828 |
| `advance:swept-segment-blocked` | 1,286 | 0 |
| `rest:swept-segment-blocked` | 91 | 196 |
| `entry:settle-does-not-fit` | 299 | 138 |
| `stop-entry:settle-does-not-fit` | 356 | 172 |
| `rest:settle-does-not-fit` | 10 | 4 |

Search pruning, separately from physical validity:

| Reason | Before | After |
|---|---:|---:|
| `search:cost-bound` | 2,101 | 193 |
| `search:duplicate` | 120 | 187 |
| `search:reversal` | 89,736 | 237,432 |
| `search:score-bound` | 8,945 | 13,450 |
| `search:turn-limit` | 17,536 | 72,268 |

The dominant physical failures are facing and body/sole geometry. The standing support mismatch accounts for many `no-entry-frame` results and is intentional: reverse settles must use the physical support drawn in the standing sheet. `optimal: true` means exhaustive within this bounded action graph, turn limits and cost bound; it is not global reachability of the floor.

## Verified fixes and rejected hypotheses

1. **Default cost bound did not fund turns.** A 1.2 m L corridor with a permitted 90° turn failed the new test. Turn preference cost was consuming a bound derived only from geometric distance. The default now includes the maximum cost of permitted turns; explicit caller bounds are unchanged. The test went red → green. This accounts for most corpus arrival improvement: the first budget-only run already reaches 27 half-stride arrivals and median 75 expansions.
2. **Sampled sweep skipped short free intervals.** A segment crossing two grid lines just apart was rejected as a diagonal adjacency through a blocked neighbour, although the segment never intersected that cell. New tests first failed, then passed with exact grid traversal. Endpoints remain exact; no clearance dilation or general blocked-cell tolerance is used. The routing algorithm is unchanged. A real blocked crossing still fails. This did not increase the corpus arrival count.
3. **Object soles were not explicitly rejected.** The existing raw-floor distinction was correct; changing soles to another mask was unnecessary. A boot on an object footprint with clear raw floor/body passed the old predictor and fails the new test correctly. Raw-floor checks now also reject object footprints for planted/landing/settle soles. This is a correctness fix, not a relaxation; the corpus does not exercise this rejection.
4. **Marginal initial clearance cell.** New test: a body starting 1 px outside the clearance boundary can take an inward first stance, while a later stance or a deeper invalid start is rejected. Only the initial boundary cell may be exited; the landing body must be inside the unchanged mask. Raw soles and object exclusions remain strict. This does not repair the named corpus stuck starts; no final corpus body-clearance violations are introduced.
5. **Entry selection stopped before collision validation.** A compatible first phase could clip a boundary while a later compatible phase was safe. The new regression test first failed. Entry selection now checks the stance before accepting that phase and tries the next compatible phase when blocked. It does not add arbitrary source frames or change drawn supports.
6. **Return threshold used sprite origin.** A door at the first floor row placed its boot above that floor despite a valid origin. New test first failed. Door returns now snap the sole to the threshold, consistent with passage returns. Inside/exit-bus_platform is now on floor.
7. **Idle turns locked the incoming sheet's free boot.** A new test reproduces drift through the settle. An idle turn now pivots on the incoming drawn support and validates the full settle; an unsafe turn is declined. Pier/object retains a safe pose with zero drift. This does not establish successful object interaction or correct final facing.

**Facing hypothesis:** ordinary stances already use the reviewer's 30° tolerance; first/last fragments use 35°. The away pair's 90°/94° difference alone cannot explain these rejections. A simulator-only ablation disabled facing checks, then was completely reverted: half-stride arrivals rose to 54, but the unchanged facing gate fell from 80 to 44 passes and reported 213 flagged stance entries versus 10 (each per-walk list is capped at eight). Road's two stuck starts persisted. Relaxing facing therefore hides real disagreement and does not solve the lattice. No facing tolerance, source art, or reviewer gate was changed.

The uninstrumented brief-26 final and `27-before` have **139/139 identical motion logs**, excluding only the newly added `contact.plan.search.rejections` field. See [`instrumentation-baseline.json`](../sim/27-final/validation/instrumentation-baseline.json).

## Iteration evidence

| Simulator run | Change | Half-stride arrivals | Median expansions |
|---|---|---:|---:|
| `27-before` | Instrumented baseline | 12 | 30 |
| `27-budget` | Turn-budget allowance | 27 | 75 |
| `27-sweep` | Exact physical sweep | 27 | 75 |
| `27-objects` | Explicit object-sole exclusion | 27 | 75 |
| `27-boundary` | Initial boundary-cell escape | 27 | 75 |
| `27-entries` | Try collision-valid entry | 27 | 75 |
| `27-ablate-facing` | Diagnostic only; reverted | 54 | 174 |
| `27-final` | Door return and safe idle-turn fixes | 27 | 75 |

Every retained behavior fix has a recorded failing test before implementation. Red/green logs are retained under `27-final/validation`. Reviewer tools were not edited.

## Search distribution

| Population | min | p25 | median | p75 | p90 | p95 | max |
|---|---:|---:|---:|---:|---:|---:|---:|
| Before/all | 2 | 11 | 30 | 68 | 287 | 438.4 | 4000 |
| After/all | 2 | 13.5 | 75 | 341.5 | 2757.6 | 4000 | 4000 |
| Before/beyond stride | 2 | 12.25 | 32.5 | 70.25 | 223 | 329.35 | 4000 |
| After/beyond stride | 2 | 13.25 | 64.5 | 147.5 | 1112.7 | 4000 | 4000 |

## Simulator gates against brief 26

Each cell is **brief 26 → brief 27 passes / scene count**. Path keeps the 1.05× octilinear bar. Turns keep one change per 300 px. Facing is the stance reviewer, not a relabeled per-frame score. The larger search improves arrival and behavior but reduces path/facing passes; these regressions are explicit failures.

| Scene | Walks | Lock | Slide | Floor | Scale | Facing | Turns | Path | Behavior | Depth |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| alley | 14 | 14 → 14 | 13 → 13 | 14 → 14 | 14 → 14 | 10 → 10 | 14 → 13 | 5 → 4 | 0 → 2 | 14 → 14 |
| church | 12 | 12 → 12 | 11 → 12 | 12 → 12 | 12 → 12 | 10 → 11 | 12 → 11 | 1 → 0 | 0 → 0 | 12 → 12 |
| grocery | 12 | 12 → 12 | 12 → 12 | 12 → 12 | 12 → 12 | 9 → 8 | 12 → 12 | 5 → 4 | 1 → 2 | 12 → 12 |
| inside | 13 | 13 → 13 | 10 → 10 | 12 → 13 | 13 → 13 | 9 → 9 | 13 → 13 | 9 → 6 | 2 → 2 | 13 → 13 |
| lobby | 12 | 12 → 12 | 8 → 8 | 12 → 12 | 12 → 12 | 6 → 5 | 10 → 9 | 7 → 6 | 0 → 1 | 12 → 12 |
| outside | 17 | 17 → 17 | 14 → 17 | 17 → 17 | 17 → 17 | 11 → 8 | 14 → 14 | 8 → 3 | 3 → 5 | 17 → 17 |
| pier | 14 | 13 → 14 | 10 → 10 | 14 → 14 | 14 → 14 | 9 → 9 | 11 → 11 | 8 → 8 | 0 → 1 | 14 → 14 |
| road | 17 | 17 → 17 | 15 → 15 | 17 → 17 | 17 → 17 | 8 → 8 | 13 → 13 | 4 → 4 | 3 → 3 | 17 → 17 |
| square | 13 | 13 → 13 | 9 → 10 | 13 → 13 | 13 → 13 | 7 → 5 | 12 → 11 | 5 → 4 | 0 → 5 | 13 → 13 |
| stepped-street | 15 | 15 → 15 | 11 → 12 | 15 → 15 | 15 → 15 | 7 → 7 | 13 → 13 | 9 → 8 | 2 → 3 | 15 → 15 |
| **Total** | **139** | **138 → 139** | **113 → 119** | **138 → 139** | **139 → 139** | **86 → 80** | **124 → 120** | **61 → 47** | **11 → 24** | **139 → 139** |

`walkstats.py`: zero off-floor and zero object contacts. `floorcheck20.py` additionally confirms zero body-clearance violations. The full reviewer suite ran on `27-objects`; 133 final walks reuse results only after exact comparison of all input logs except unused search diagnostics, plus identical events, navigation and area data. Six changed walks were rechecked with the unchanged suite; see [`gate-reuse.json`](../sim/27-final/validation/gate-reuse.json). This avoids repeating expensive identical geodesic computations. Final walkstats ran over all 139.

Pixel-height and freeze checks from brief 26 are not re-certified from headless numeric logs. The requested eight-walk final browser capture provides frame logs and videos, not full-corpus visual sign-off.

## Named per-walk limitations

Every missing arrival and every stop beyond half a stride is listed below. Each link contains that walk's complete rejection histogram and all plans. `nearest-reachable` is a limitation of the implementation's action graph; `node-budget` is explicitly incomplete search. No scene is dropped. Additional path/facing/behavior failures for every walk are recorded in `diagnostics.json` and `checks.json`.

| Limitation ID | Half-stride multiples | Expanded | Search outcome | Stuck | Rejection histogram |
|---|---:|---:|---|---|---|
| `L27-outside-near-left` | 3.60 | 83 | nearest-reachable |  | [full counts](../sim/27-final/outside/near-left-rejections.json) |
| `L27-outside-near-right` | 3.61 | 89 | nearest-reachable |  | [full counts](../sim/27-final/outside/near-right-rejections.json) |
| `L27-outside-far-left` | 15.59 | 35 | nearest-reachable |  | [full counts](../sim/27-final/outside/far-left-rejections.json) |
| `L27-outside-occluder-behind` | 1.41 | 3392 | nearest-reachable |  | [full counts](../sim/27-final/outside/occluder-behind-rejections.json) |
| `L27-outside-occluder-back` | 13.49 | 187 | nearest-reachable |  | [full counts](../sim/27-final/outside/occluder-back-rejections.json) |
| `L27-outside-unreachable` | 5.36 | 148 | nearest-reachable |  | [full counts](../sim/27-final/outside/unreachable-rejections.json) |
| `L27-outside-exit-depot_doors` | 1.38 | 225 | nearest-reachable |  | [full counts](../sim/27-final/outside/exit-depot_doors-rejections.json) |
| `L27-outside-exit-edge-left` | 30.43 | 105 | nearest-reachable |  | [full counts](../sim/27-final/outside/exit-edge-left-rejections.json) |
| `L27-outside-exit-edge-left-1` | 30.43 | 105 | nearest-reachable |  | [full counts](../sim/27-final/outside/exit-edge-left-1-rejections.json) |
| `L27-outside-exit-edge-right` | 37.17 | 204 | nearest-reachable |  | [full counts](../sim/27-final/outside/exit-edge-right-rejections.json) |
| `L27-outside-exit-far` | 4.31 | 146 | nearest-reachable |  | [full counts](../sim/27-final/outside/exit-far-rejections.json) |
| `L27-inside-near-left` | no arrival | 3 | nearest-reachable | yes | [full counts](../sim/27-final/inside/near-left-rejections.json) |
| `L27-inside-near-right` | 3.73 | 68 | nearest-reachable |  | [full counts](../sim/27-final/inside/near-right-rejections.json) |
| `L27-inside-deepest` | 2.90 | 120 | nearest-reachable |  | [full counts](../sim/27-final/inside/deepest-rejections.json) |
| `L27-inside-far-left` | no arrival | 3 | nearest-reachable | yes | [full counts](../sim/27-final/inside/far-left-rejections.json) |
| `L27-inside-far-right` | 3.30 | 91 | nearest-reachable |  | [full counts](../sim/27-final/inside/far-right-rejections.json) |
| `L27-inside-diagonal-away` | 3.80 | 68 | nearest-reachable |  | [full counts](../sim/27-final/inside/diagonal-away-rejections.json) |
| `L27-inside-diagonal-toward` | 16.59 | 11 | nearest-reachable |  | [full counts](../sim/27-final/inside/diagonal-toward-rejections.json) |
| `L27-inside-occluder-behind` | 3.69 | 77 | nearest-reachable |  | [full counts](../sim/27-final/inside/occluder-behind-rejections.json) |
| `L27-inside-unreachable` | no arrival | 1976 | nearest-reachable |  | [full counts](../sim/27-final/inside/unreachable-rejections.json) |
| `L27-inside-object` | 3.59 | 95 | nearest-reachable |  | [full counts](../sim/27-final/inside/object-rejections.json) |
| `L27-road-near-left` | 3.19 | 4000 | node-budget |  | [full counts](../sim/27-final/road/near-left-rejections.json) |
| `L27-road-near-right` | 900.55 | 3 | nearest-reachable | yes | [full counts](../sim/27-final/road/near-right-rejections.json) |
| `L27-road-far-left` | 1.05 | 4000 | node-budget |  | [full counts](../sim/27-final/road/far-left-rejections.json) |
| `L27-road-far-right` | 8.45 | 4000 | node-budget |  | [full counts](../sim/27-final/road/far-right-rejections.json) |
| `L27-road-diagonal-away` | 900.10 | 3 | nearest-reachable | yes | [full counts](../sim/27-final/road/diagonal-away-rejections.json) |
| `L27-road-diagonal-toward` | 7.33 | 4000 | node-budget |  | [full counts](../sim/27-final/road/diagonal-toward-rejections.json) |
| `L27-road-occluder-behind` | 1.37 | 65 | nearest-reachable |  | [full counts](../sim/27-final/road/occluder-behind-rejections.json) |
| `L27-road-narrow-gap` | 8.36 | 189 | nearest-reachable |  | [full counts](../sim/27-final/road/narrow-gap-rejections.json) |
| `L27-road-unreachable` | 1.77 | 378 | nearest-reachable |  | [full counts](../sim/27-final/road/unreachable-rejections.json) |
| `L27-road-exit-edge-left` | 3.11 | 447 | nearest-reachable |  | [full counts](../sim/27-final/road/exit-edge-left-rejections.json) |
| `L27-road-exit-edge-left-1` | 3.11 | 447 | nearest-reachable |  | [full counts](../sim/27-final/road/exit-edge-left-1-rejections.json) |
| `L27-road-exit-edge-left-2` | 3.11 | 447 | nearest-reachable |  | [full counts](../sim/27-final/road/exit-edge-left-2-rejections.json) |
| `L27-road-exit-edge-right` | 8.57 | 4000 | node-budget |  | [full counts](../sim/27-final/road/exit-edge-right-rejections.json) |
| `L27-alley-near-left` | no arrival | 2 | nearest-reachable | yes | [full counts](../sim/27-final/alley/near-left-rejections.json) |
| `L27-alley-deepest` | 1.11 | 145 | nearest-reachable |  | [full counts](../sim/27-final/alley/deepest-rejections.json) |
| `L27-alley-far-left` | 2.91 | 280 | nearest-reachable |  | [full counts](../sim/27-final/alley/far-left-rejections.json) |
| `L27-alley-diagonal-away` | 1.88 | 723 | nearest-reachable |  | [full counts](../sim/27-final/alley/diagonal-away-rejections.json) |
| `L27-alley-diagonal-toward` | 1.26 | 1088 | nearest-reachable |  | [full counts](../sim/27-final/alley/diagonal-toward-rejections.json) |
| `L27-alley-occluder-behind` | 1.47 | 4000 | node-budget |  | [full counts](../sim/27-final/alley/occluder-behind-rejections.json) |
| `L27-alley-occluder-back` | 1.47 | 4000 | node-budget |  | [full counts](../sim/27-final/alley/occluder-back-rejections.json) |
| `L27-alley-narrow-gap` | 1.20 | 326 | nearest-reachable |  | [full counts](../sim/27-final/alley/narrow-gap-rejections.json) |
| `L27-alley-unreachable` | 3.79 | 36 | nearest-reachable |  | [full counts](../sim/27-final/alley/unreachable-rejections.json) |
| `L27-alley-object` | 1.16 | 75 | nearest-reachable |  | [full counts](../sim/27-final/alley/object-rejections.json) |
| `L27-alley-exit-far` | 4.38 | 98 | nearest-reachable |  | [full counts](../sim/27-final/alley/exit-far-rejections.json) |
| `L27-alley-exit-near` | 2.87 | 76 | nearest-reachable |  | [full counts](../sim/27-final/alley/exit-near-rejections.json) |
| `L27-pier-near-left` | 11.29 | 12 | nearest-reachable |  | [full counts](../sim/27-final/pier/near-left-rejections.json) |
| `L27-pier-near-right` | 34.45 | 7 | nearest-reachable |  | [full counts](../sim/27-final/pier/near-right-rejections.json) |
| `L27-pier-deepest` | 4.81 | 14 | nearest-reachable |  | [full counts](../sim/27-final/pier/deepest-rejections.json) |
| `L27-pier-far-left` | no arrival | 2 | nearest-reachable | yes | [full counts](../sim/27-final/pier/far-left-rejections.json) |
| `L27-pier-far-right` | 58.74 | 5 | nearest-reachable |  | [full counts](../sim/27-final/pier/far-right-rejections.json) |
| `L27-pier-diagonal-away` | 34.80 | 7 | nearest-reachable |  | [full counts](../sim/27-final/pier/diagonal-away-rejections.json) |
| `L27-pier-diagonal-toward` | 59.03 | 5 | nearest-reachable |  | [full counts](../sim/27-final/pier/diagonal-toward-rejections.json) |
| `L27-pier-occluder-behind` | 2.46 | 37 | nearest-reachable |  | [full counts](../sim/27-final/pier/occluder-behind-rejections.json) |
| `L27-pier-narrow-gap` | no arrival | 2 | nearest-reachable | yes | [full counts](../sim/27-final/pier/narrow-gap-rejections.json) |
| `L27-pier-unreachable` | 34.27 | 6 | nearest-reachable |  | [full counts](../sim/27-final/pier/unreachable-rejections.json) |
| `L27-pier-object` | no arrival | 8 | nearest-reachable | yes | [full counts](../sim/27-final/pier/object-rejections.json) |
| `L27-pier-exit-edge-left` | no arrival | 8 | nearest-reachable | yes | [full counts](../sim/27-final/pier/exit-edge-left-rejections.json) |
| `L27-pier-exit-edge-right` | 7.19 | 8 | nearest-reachable |  | [full counts](../sim/27-final/pier/exit-edge-right-rejections.json) |
| `L27-stepped-street-near-left` | no arrival | 3 | nearest-reachable | yes | [full counts](../sim/27-final/stepped-street/near-left-rejections.json) |
| `L27-stepped-street-deepest` | 1.82 | 76 | nearest-reachable |  | [full counts](../sim/27-final/stepped-street/deepest-rejections.json) |
| `L27-stepped-street-far-right` | 352.33 | 2 | nearest-reachable | yes | [full counts](../sim/27-final/stepped-street/far-right-rejections.json) |
| `L27-stepped-street-diagonal-toward` | 381.29 | 2 | nearest-reachable | yes | [full counts](../sim/27-final/stepped-street/diagonal-toward-rejections.json) |
| `L27-stepped-street-occluder-behind` | 7.18 | 22 | nearest-reachable |  | [full counts](../sim/27-final/stepped-street/occluder-behind-rejections.json) |
| `L27-stepped-street-occluder-back` | no arrival | 3 | nearest-reachable | yes | [full counts](../sim/27-final/stepped-street/occluder-back-rejections.json) |
| `L27-stepped-street-narrow-gap` | no arrival | 3 | nearest-reachable | yes | [full counts](../sim/27-final/stepped-street/narrow-gap-rejections.json) |
| `L27-stepped-street-unreachable` | 4.27 | 29 | nearest-reachable |  | [full counts](../sim/27-final/stepped-street/unreachable-rejections.json) |
| `L27-stepped-street-object` | 1.16 | 130 | nearest-reachable |  | [full counts](../sim/27-final/stepped-street/object-rejections.json) |
| `L27-stepped-street-exit-edge-right` | 7.65 | 40 | nearest-reachable |  | [full counts](../sim/27-final/stepped-street/exit-edge-right-rejections.json) |
| `L27-stepped-street-exit-far` | 1.84 | 32 | nearest-reachable |  | [full counts](../sim/27-final/stepped-street/exit-far-rejections.json) |
| `L27-church-near-left` | 6.63 | 24 | nearest-reachable |  | [full counts](../sim/27-final/church/near-left-rejections.json) |
| `L27-church-near-right` | 3.08 | 36 | nearest-reachable |  | [full counts](../sim/27-final/church/near-right-rejections.json) |
| `L27-church-deepest` | 2.56 | 13 | nearest-reachable |  | [full counts](../sim/27-final/church/deepest-rejections.json) |
| `L27-church-far-left` | 2.72 | 13 | nearest-reachable |  | [full counts](../sim/27-final/church/far-left-rejections.json) |
| `L27-church-far-right` | 3.82 | 16 | nearest-reachable |  | [full counts](../sim/27-final/church/far-right-rejections.json) |
| `L27-church-diagonal-away` | 3.82 | 16 | nearest-reachable |  | [full counts](../sim/27-final/church/diagonal-away-rejections.json) |
| `L27-church-diagonal-toward` | 3.08 | 36 | nearest-reachable |  | [full counts](../sim/27-final/church/diagonal-toward-rejections.json) |
| `L27-church-occluder-behind` | 3.08 | 36 | nearest-reachable |  | [full counts](../sim/27-final/church/occluder-behind-rejections.json) |
| `L27-church-occluder-back` | 3.06 | 36 | nearest-reachable |  | [full counts](../sim/27-final/church/occluder-back-rejections.json) |
| `L27-church-narrow-gap` | 2.72 | 13 | nearest-reachable |  | [full counts](../sim/27-final/church/narrow-gap-rejections.json) |
| `L27-church-unreachable` | 2.00 | 26 | nearest-reachable |  | [full counts](../sim/27-final/church/unreachable-rejections.json) |
| `L27-church-object` | 1.64 | 28 | nearest-reachable |  | [full counts](../sim/27-final/church/object-rejections.json) |
| `L27-lobby-near-left` | 23.92 | 13 | nearest-reachable |  | [full counts](../sim/27-final/lobby/near-left-rejections.json) |
| `L27-lobby-near-right` | 6.87 | 1398 | nearest-reachable |  | [full counts](../sim/27-final/lobby/near-right-rejections.json) |
| `L27-lobby-deepest` | 2.90 | 3300 | nearest-reachable |  | [full counts](../sim/27-final/lobby/deepest-rejections.json) |
| `L27-lobby-far-left` | no arrival | 3 | nearest-reachable | yes | [full counts](../sim/27-final/lobby/far-left-rejections.json) |
| `L27-lobby-far-right` | no arrival | 2 | nearest-reachable | yes | [full counts](../sim/27-final/lobby/far-right-rejections.json) |
| `L27-lobby-diagonal-away` | 14.00 | 1398 | nearest-reachable |  | [full counts](../sim/27-final/lobby/diagonal-away-rejections.json) |
| `L27-lobby-diagonal-toward` | no arrival | 2 | nearest-reachable | yes | [full counts](../sim/27-final/lobby/diagonal-toward-rejections.json) |
| `L27-lobby-occluder-behind` | 2.16 | 61 | nearest-reachable |  | [full counts](../sim/27-final/lobby/occluder-behind-rejections.json) |
| `L27-lobby-occluder-back` | no arrival | 90 | nearest-reachable | yes | [full counts](../sim/27-final/lobby/occluder-back-rejections.json) |
| `L27-lobby-unreachable` | 3.13 | 92 | nearest-reachable |  | [full counts](../sim/27-final/lobby/unreachable-rejections.json) |
| `L27-lobby-object` | 2.47 | 4000 | node-budget |  | [full counts](../sim/27-final/lobby/object-rejections.json) |
| `L27-grocery-near-right` | 4.37 | 75 | nearest-reachable |  | [full counts](../sim/27-final/grocery/near-right-rejections.json) |
| `L27-grocery-deepest` | 4.62 | 57 | nearest-reachable |  | [full counts](../sim/27-final/grocery/deepest-rejections.json) |
| `L27-grocery-far-left` | 43.67 | 8 | nearest-reachable |  | [full counts](../sim/27-final/grocery/far-left-rejections.json) |
| `L27-grocery-far-right` | 10.13 | 121 | nearest-reachable |  | [full counts](../sim/27-final/grocery/far-right-rejections.json) |
| `L27-grocery-diagonal-away` | 9.49 | 84 | nearest-reachable |  | [full counts](../sim/27-final/grocery/diagonal-away-rejections.json) |
| `L27-grocery-diagonal-toward` | 8.39 | 32 | nearest-reachable |  | [full counts](../sim/27-final/grocery/diagonal-toward-rejections.json) |
| `L27-grocery-occluder-behind` | 2.18 | 369 | nearest-reachable |  | [full counts](../sim/27-final/grocery/occluder-behind-rejections.json) |
| `L27-grocery-narrow-gap` | 7.44 | 9 | nearest-reachable |  | [full counts](../sim/27-final/grocery/narrow-gap-rejections.json) |
| `L27-grocery-unreachable` | 68.04 | 80 | nearest-reachable | yes | [full counts](../sim/27-final/grocery/unreachable-rejections.json) |
| `L27-square-near-left` | no arrival | 3 | nearest-reachable | yes | [full counts](../sim/27-final/square/near-left-rejections.json) |
| `L27-square-near-right` | 3.17 | 49 | nearest-reachable |  | [full counts](../sim/27-final/square/near-right-rejections.json) |
| `L27-square-far-right` | no arrival | 2 | nearest-reachable | yes | [full counts](../sim/27-final/square/far-right-rejections.json) |
| `L27-square-diagonal-away` | 2.93 | 221 | nearest-reachable |  | [full counts](../sim/27-final/square/diagonal-away-rejections.json) |
| `L27-square-diagonal-toward` | no arrival | 2 | nearest-reachable | yes | [full counts](../sim/27-final/square/diagonal-toward-rejections.json) |
| `L27-square-occluder-behind` | 18.13 | 12 | nearest-reachable |  | [full counts](../sim/27-final/square/occluder-behind-rejections.json) |
| `L27-square-object` | 2.94 | 325 | nearest-reachable |  | [full counts](../sim/27-final/square/object-rejections.json) |

The five arrival-bearing stuck walks are road/near-right, road/diagonal-away, stepped-street/far-right, stepped-street/diagonal-toward, and grocery/unreachable. Road expands three states; stepped-street expands two. The strict collision/entry failures remain after turn-budget expansion, exact sweeps, first-cell escape and (in the diagnostic run) removal of facing checks. Their complete histograms above are the retained evidence, not a claim that further repairs are impossible.

## Final browser / regression verification

- **8/8 browser equivalence PASS**, outside/inside/road/alley × near-left/near-right. Every logged field, frame count, and rejection counter compared; **zero differences, maximum numeric difference 0**. No excluded keys. [`diff-report.json`](../equivalence-27/diff-report.json); frame logs, MP4s and sheets are in the same directory. Stationary walks remain stationary; equality is not walking acceptance.
- **483 tests / 52 files PASS**, typecheck PASS, lint PASS, `verify:art --generated` all scenes PASS. Final commands were repeated after the equivalence capture completed. Logs: [`validation`](../sim/27-final/validation/).
- **Saved town replay 128 FAIL** at depot-left: residual **158.485958 px**, half-stride **71.555166 px**, absorbed distance 0. **2 cached / 0 uncached calls**. Same arrival failure as brief 26. [`town-128.json`](../sim/27-final/validation/town-128.json).
- The first town invocation accidentally omitted `--replay`: normal cached journey 127 reached road/far and failed at **49.992687 px / 14.861746 px half-stride**, with **23 cached / 0 uncached calls**. It was followed by the explicitly requested saved replay, not represented as that replay. [`town-127.json`](../sim/27-final/validation/town-127.json).
- Final API ledger audit: **117 calls, 117 cached, 0 uncached** across capture and both town runs. All provider credentials were absent from the child environment; a preload blocked external fetch/HTTP so a cache miss could not become a paid call. [`call-audit.json`](../sim/27-final/validation/call-audit.json).
- QA browser session closed; listeners on **4317 and 8080 stopped and verified absent**. Task-created temporary patch scripts/source backups removed. No owner server was stopped.
- Production commits: `cf48a11` diagnostics, `4d93bc6` search budget, `71546e9` sweep/object soles, `195df98` marginal starts, `d5ede00` entry selection, `08c5945` per-walk simulator histograms, `7bfc84a` door arrival, `71234a2` idle turns. Final source hashes: [`source-sha256.json`](../sim/27-final/source-sha256.json).

This brief does **not** meet the goal: 74 arrival-bearing walks remain beyond one stride, 18 have no arrival record, five arrival-bearing starts remain stuck, and facing/path/turn/behavior bars fail. The histogram and named limitations are delivered without widening acceptance tolerances.

## Reproduce

```sh
api/node_modules/.bin/tsx adventures/shadow-over-innsmouth/scripts/simulate-walks.mts --run=27-repeat
tmp/walkqa/tools/venv/bin/python tmp/walkqa/tools/arrival_audit.py tmp/walkqa/sim/27-repeat
tmp/walkqa/tools/venv/bin/python tmp/walkqa/tools/arrival_vs_standable.py tmp/walkqa/sim/27-repeat
WALKQA_ROOT=tmp/walkqa/sim/27-repeat tmp/walkqa/tools/venv/bin/python tmp/walkqa/check26.py tmp/walkqa/sim/27-repeat
```

No paid calls, push, merge, deployment, settings change, key write, dotenv edit, asset generation, or reviewer-tool edit was authorized or performed. Only API 4317 and game 8080 were used for the final browser/town phase; owner ports 4410/8090 were untouched.
