# Brief 29 — clean routes

**Not accepted: route enforcement improves, but arrivals regress substantially.** The final simulator has 43/132 arrivals within half a stride and 66/132 within one stride, versus 103/128 and 113/128 in brief 28. Seven scene transfers are excluded from the arrival denominator (28: eleven). All 139 walks retain arrival records. No scenes or walks were removed. This is not completion of `docs/FOOTFALL-GOAL.md`.

Branch `open-world-mvp`; starting commit `39f40c8`. Read the goal, brief 28 report, the improved reviewer, and `git log -10`. Existing changes to `calls.md`, reviewer `walkstats.py`, and untracked `AgentDebug.test.ts` were preserved. No reviewer tool was edited.

## Production changes

- One search owns a click. Removed the up-to-eight stand-and-pivot continuations that reset run/reversal/turn budgets. Standing pivots are offered only at the initial state; playback contains one final stop, never a restart pivot mid-plan.
- `minHeadingRun: 2` rejects turns out of a one-stance middle run in search, including the stop edge. First and final runs may have one stance. Heading history is part of duplicate detection, so successive legal small turns cannot silently produce a cumulative reversal.
- Compute the eight-connected shortest route once on the clearance mask, with visibility string pulling and >25° corners, using the reviewer's 1.4142 diagonal cost and ties-to-even line sampling. Actual stance collision checks remain conservative. A corner can reset the heading envelope once, within 0.6 ground metres, when the new heading is within 45° of the route's outgoing direction. The overall budget is `2 + 2 × corners`; only reached corners release their extra budget. Immediate turns over 120° remain forbidden even at corners.
- Explore all valid entry phases instead of the first valid phase. A single fixed 12,000-node budget replaces independent 4,000-node continuation budgets. Every rejected branch remains in the histogram. Search is deterministic in the simulator and browser worker.
- All entry and exit stances use the 30° facing limit; removed the earlier 35° first/last-stance tolerance. All measured walking stances agree within the reviewer's 30° limit.
- Arrival half-stride comes from a full authored support interval at arrival depth, without collision rejection or a two-pixel floor. A blocked hypothetical next step and a short exit fragment cannot shrink the measurement. This corrects telemetry; it does not move those four unreachable arrivals.

Unit tests cover the middle-run rule, cumulative reversal, corner location and one-use allowance, heading budget including the stop edge, start-only pivot enumeration, motor pivot/stop structure, entry alternatives, shortest-route corner extraction, and collision-independent authored stride measurement.

## Simulator and unchanged reviewer gates

Every retained completed simulator run invoked `facing_stance.py` (including `route_corners`), `arrival_vs_standable.py`, `lockcheck.py`, and `walkstats.py`, through [review29.py](../review29.py). An early corner-refactor syntax error produced no completed corpus; it was fixed before the retained `29-corners` run. No browser was used during the simulator iterations.

| Run | Half stride | Within one stride | Beyond one stride | Facing | Flicker walks | Reversal walks | Max lock px | Off-floor / object contacts |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Brief 26 | 12/116 | 26/116 | 90 | 94/139 | 0 | 0 | 59.63 | nonzero / 0 |
| Brief 27 | 27/118 | 44/118 | 74 | 95/139 | 0 | 0 | 0 | 0 / 0 |
| Brief 28 | 103/128 | 113/128 | 15 | 89/139 | 21 | 12 | 1.32 | 0 / 0 |
| [29-single](../sim/29-single/gates.log) | 41/133 | 64/133 | 69 | 115/139 | 1 | 0 | 1.32 | 0 / 0 |
| [29-entries](../sim/29-entries/gates.log) | 48/132 | 71/132 | 61 | 114/139 | 3 | 0 | 1.32 | 0 / 0 |
| [29-corners](../sim/29-corners/gates.log) | 47/132 | 67/132 | 65 | 111/139 | 3 | 0 | 1.32 | 0 / 0 |
| [29-facing](../sim/29-facing/gates.log) | 43/132 | 66/132 | 66 | 120/139 | 3 | 0 | 0.61 | 0 / 0 |
| [29-confirm](../sim/29-confirm/gates.log) | 43/132 | 66/132 | 66 | 120/139 | 3 | 0 | 0.61 | 0 / 0 |

The historical facing columns were freshly recomputed with the improved reviewer, not copied from the older 26/27 reports. Historical arrival/safety columns retain their reported definitions and original stride telemetry. Final source: [review29.json](../sim/29-facing/review29.json), [arrival gate](../sim/29-facing/arrival_vs_standable.log), [walkstats](../sim/29-facing/walkstats.log), [diagnostics and full histograms](../sim/29-facing/diagnostics.json).

The unchanged full-walk facing gate remains **120/139**, not a universal pass. Its three remaining flicker flags are inside/exit-bus_platform, road/exit-far, and alley/exit-far: each joins an outgoing plan's final run to a new scene's first run. Each scene's plan separately has zero flicker and zero reversals. Those supplemental per-scene checks do not override the full-walk gate. Other failures include zero-walking-stance stops and heading budgets computed over completed/partial trajectories or concatenated scene transfers. Two reviewer-style stuck starts remain. The source rules are per plan; the report does not silently exempt any walk.

## Requested arrival misses and named limitations

All five requested cases remain **implementation limitations**, not proofs of geometric unreachability. Removing restart pivots exposes much larger misses in lobby/far-right and some other formerly improving walks. The phase-search and strict-corner iterations did not solve these. Plots show brief 28 on the left and the final result on the right: white start, red body trajectory, yellow target, blue raw floor, green clearance.

| Named limitation | 28 → 29 residual to nearest standable px | Final half-stride px | Expanded nodes | Dominant rejection categories | Evidence |
|---|---:|---:|---:|---|---|
| L29-pier-near-right | 1668.5 → 1690.8 | 49.08 | 36 | entry:no-entry-frame: 88, stop-entry:no-entry-frame: 88, entry:facing-invalid: 79, search:reversal: 42 | [histogram](../sim/29-facing/pier/near-right-rejections.json), [trajectory](29-trajectories/pier-near-right.png) |
| L29-pier-diagonal-away | 1685.3 → 1708.0 | 49.08 | 36 | entry:no-entry-frame: 88, stop-entry:no-entry-frame: 88, entry:facing-invalid: 79, search:reversal: 42 | [histogram](../sim/29-facing/pier/diagonal-away-rejections.json), [trajectory](29-trajectories/pier-diagonal-away.png) |
| L29-road-far-right | 110.9 → 602.5 | 50.68 | 10634 | search:turn-limit: 32596, search:reversal: 31812, search:min-heading-run: 5972, entry:facing-invalid: 1734 | [histogram](../sim/29-facing/road/far-right-rejections.json), [trajectory](29-trajectories/road-far-right.png) |
| L29-lobby-far-right | 130.4 → 1786.0 | 18.39 | 26 | entry:facing-invalid: 68, search:reversal: 48, entry:no-entry-frame: 40, stop-entry:no-entry-frame: 40 | [histogram](../sim/29-facing/lobby/far-right-rejections.json), [trajectory](29-trajectories/lobby-far-right.png) |
| L29-inside-object | 254.8 → 276.9 | 28.45 | 1695 | search:reversal: 4995, search:turn-limit: 2272, search:min-heading-run: 2236, entry:facing-invalid: 929 | [histogram](../sim/29-facing/inside/object-rejections.json), [trajectory](29-trajectories/inside-object.png) |
| L29-road-near-right | 0.7 → 1801.1 | 47.25 | 269 | search:reversal: 741, search:min-heading-run: 448, search:turn-limit: 288, entry:facing-invalid: 137 | [histogram](../sim/29-facing/road/near-right-rejections.json), [trajectory](29-trajectories/road-near-right.png) |
| L29-lobby-near-left | 14.0 → 1601.9 | 59.31 | 141 | search:reversal: 357, entry:facing-invalid: 290, search:min-heading-run: 112, entry:no-entry-frame: 88 | [histogram](../sim/29-facing/lobby/near-left-rejections.json), [trajectory](29-trajectories/lobby-near-left.png) |
| L29-outside-far-right | 6.5 → 504.5 | 15.68 | 4247 | search:reversal: 12651, search:turn-limit: 8992, search:min-heading-run: 4216, entry:facing-invalid: 1819 | [histogram](../sim/29-facing/outside/far-right-rejections.json), [trajectory](29-trajectories/outside-far-right.png) |

The four previously degenerate half-strides are now: inside/unreachable **65.47 px**, alley/unreachable **55.27 px**, pier/unreachable **79.98 px**, grocery/unreachable **72.29 px** (previously 2 px each). Their anchors are unchanged. These count as telemetry corrections, not four arrival-motion fixes.

### Complete residual limitation inventory

Every final residual beyond half a stride is named below, including regressions. `nearest-reachable` describes the bounded action search, not floor connectivity.

| Limitation | Half-stride multiples | Distance px | Search outcome | Histogram |
|---|---:|---:|---|---|
| L29-outside-deepest | 3.94 | 59.3 | nearest-reachable | [counts](../sim/29-facing/outside/deepest-rejections.json) |
| L29-outside-far-left | 5.22 | 552.0 | nearest-reachable | [counts](../sim/29-facing/outside/far-left-rejections.json) |
| L29-outside-far-right | 32.18 | 504.5 | nearest-reachable | [counts](../sim/29-facing/outside/far-right-rejections.json) |
| L29-outside-diagonal-toward | 4.54 | 476.8 | nearest-reachable | [counts](../sim/29-facing/outside/diagonal-toward-rejections.json) |
| L29-outside-occluder-behind | 6.66 | 495.5 | nearest-reachable | [counts](../sim/29-facing/outside/occluder-behind-rejections.json) |
| L29-outside-occluder-back | 5.74 | 312.4 | nearest-reachable | [counts](../sim/29-facing/outside/occluder-back-rejections.json) |
| L29-outside-unreachable | 2.81 | 33.4 | nearest-reachable | [counts](../sim/29-facing/outside/unreachable-rejections.json) |
| L29-outside-object | 2.09 | 115.4 | nearest-reachable | [counts](../sim/29-facing/outside/object-rejections.json) |
| L29-outside-exit-depot_doors | 1.28 | 24.5 | nearest-reachable | [counts](../sim/29-facing/outside/exit-depot_doors-rejections.json) |
| L29-outside-exit-edge-left | 8.40 | 337.9 | nearest-reachable | [counts](../sim/29-facing/outside/exit-edge-left-rejections.json) |
| L29-outside-exit-edge-left-1 | 8.40 | 337.9 | nearest-reachable | [counts](../sim/29-facing/outside/exit-edge-left-1-rejections.json) |
| L29-outside-exit-edge-right | 21.95 | 450.0 | nearest-reachable | [counts](../sim/29-facing/outside/exit-edge-right-rejections.json) |
| L29-outside-exit-far | 1.52 | 18.1 | nearest-reachable | [counts](../sim/29-facing/outside/exit-far-rejections.json) |
| L29-inside-deepest | 2.12 | 49.7 | nearest-reachable | [counts](../sim/29-facing/inside/deepest-rejections.json) |
| L29-inside-far-left | 4.60 | 477.3 | nearest-reachable | [counts](../sim/29-facing/inside/far-left-rejections.json) |
| L29-inside-diagonal-away | 1.20 | 26.5 | nearest-reachable | [counts](../sim/29-facing/inside/diagonal-away-rejections.json) |
| L29-inside-diagonal-toward | 1.16 | 60.0 | complete | [counts](../sim/29-facing/inside/diagonal-toward-rejections.json) |
| L29-inside-occluder-behind | 1.12 | 27.5 | nearest-reachable | [counts](../sim/29-facing/inside/occluder-behind-rejections.json) |
| L29-inside-object | 9.73 | 276.9 | nearest-reachable | [counts](../sim/29-facing/inside/object-rejections.json) |
| L29-road-near-left | 6.24 | 168.8 | node-budget | [counts](../sim/29-facing/road/near-left-rejections.json) |
| L29-road-near-right | 38.12 | 1801.1 | nearest-reachable | [counts](../sim/29-facing/road/near-right-rejections.json) |
| L29-road-far-left | 1.50 | 41.1 | node-budget | [counts](../sim/29-facing/road/far-left-rejections.json) |
| L29-road-far-right | 11.89 | 602.5 | nearest-reachable | [counts](../sim/29-facing/road/far-right-rejections.json) |
| L29-road-diagonal-away | 38.10 | 1800.2 | nearest-reachable | [counts](../sim/29-facing/road/diagonal-away-rejections.json) |
| L29-road-diagonal-toward | 11.83 | 599.7 | nearest-reachable | [counts](../sim/29-facing/road/diagonal-toward-rejections.json) |
| L29-road-narrow-gap | 1.41 | 79.0 | node-budget | [counts](../sim/29-facing/road/narrow-gap-rejections.json) |
| L29-road-exit-edge-right | 9.05 | 160.8 | node-budget | [counts](../sim/29-facing/road/exit-edge-right-rejections.json) |
| L29-alley-near-left | 1.22 | 62.2 | nearest-reachable | [counts](../sim/29-facing/alley/near-left-rejections.json) |
| L29-alley-near-right | 1.14 | 92.6 | nearest-reachable | [counts](../sim/29-facing/alley/near-right-rejections.json) |
| L29-alley-deepest | 1.26 | 16.4 | nearest-reachable | [counts](../sim/29-facing/alley/deepest-rejections.json) |
| L29-alley-far-right | 2.17 | 227.6 | nearest-reachable | [counts](../sim/29-facing/alley/far-right-rejections.json) |
| L29-alley-diagonal-toward | 3.02 | 316.1 | nearest-reachable | [counts](../sim/29-facing/alley/diagonal-toward-rejections.json) |
| L29-alley-occluder-behind | 2.58 | 69.5 | nearest-reachable | [counts](../sim/29-facing/alley/occluder-behind-rejections.json) |
| L29-alley-occluder-back | 2.58 | 69.5 | nearest-reachable | [counts](../sim/29-facing/alley/occluder-back-rejections.json) |
| L29-alley-object | 1.41 | 41.9 | nearest-reachable | [counts](../sim/29-facing/alley/object-rejections.json) |
| L29-pier-near-left | 12.92 | 1611.3 | nearest-reachable | [counts](../sim/29-facing/pier/near-left-rejections.json) |
| L29-pier-near-right | 34.45 | 1690.8 | nearest-reachable | [counts](../sim/29-facing/pier/near-right-rejections.json) |
| L29-pier-deepest | 4.35 | 570.7 | nearest-reachable | [counts](../sim/29-facing/pier/deepest-rejections.json) |
| L29-pier-far-left | 23.59 | 1157.8 | nearest-reachable | [counts](../sim/29-facing/pier/far-left-rejections.json) |
| L29-pier-far-right | 32.42 | 1667.7 | nearest-reachable | [counts](../sim/29-facing/pier/far-right-rejections.json) |
| L29-pier-diagonal-away | 34.80 | 1708.0 | nearest-reachable | [counts](../sim/29-facing/pier/diagonal-away-rejections.json) |
| L29-pier-diagonal-toward | 32.69 | 1682.0 | nearest-reachable | [counts](../sim/29-facing/pier/diagonal-toward-rejections.json) |
| L29-pier-occluder-behind | 2.07 | 223.6 | nearest-reachable | [counts](../sim/29-facing/pier/occluder-behind-rejections.json) |
| L29-pier-narrow-gap | 9.06 | 269.8 | nearest-reachable | [counts](../sim/29-facing/pier/narrow-gap-rejections.json) |
| L29-pier-object | 7.45 | 877.9 | nearest-reachable | [counts](../sim/29-facing/pier/object-rejections.json) |
| L29-pier-exit-edge-left | 7.60 | 896.0 | nearest-reachable | [counts](../sim/29-facing/pier/exit-edge-left-rejections.json) |
| L29-pier-exit-edge-right | 14.77 | 625.7 | nearest-reachable | [counts](../sim/29-facing/pier/exit-edge-right-rejections.json) |
| L29-stepped-street-near-left | 3.62 | 127.9 | nearest-reachable | [counts](../sim/29-facing/stepped-street/near-left-rejections.json) |
| L29-stepped-street-near-right | 1.18 | 42.5 | complete | [counts](../sim/29-facing/stepped-street/near-right-rejections.json) |
| L29-stepped-street-deepest | 1.53 | 21.0 | nearest-reachable | [counts](../sim/29-facing/stepped-street/deepest-rejections.json) |
| L29-stepped-street-far-right | 2.80 | 74.5 | nearest-reachable | [counts](../sim/29-facing/stepped-street/far-right-rejections.json) |
| L29-stepped-street-diagonal-away | 1.05 | 32.9 | nearest-reachable | [counts](../sim/29-facing/stepped-street/diagonal-away-rejections.json) |
| L29-stepped-street-diagonal-toward | 1.34 | 41.8 | nearest-reachable | [counts](../sim/29-facing/stepped-street/diagonal-toward-rejections.json) |
| L29-stepped-street-occluder-behind | 2.13 | 57.0 | nearest-reachable | [counts](../sim/29-facing/stepped-street/occluder-behind-rejections.json) |
| L29-stepped-street-occluder-back | 5.44 | 158.8 | nearest-reachable | [counts](../sim/29-facing/stepped-street/occluder-back-rejections.json) |
| L29-stepped-street-narrow-gap | 5.16 | 128.9 | nearest-reachable | [counts](../sim/29-facing/stepped-street/narrow-gap-rejections.json) |
| L29-stepped-street-unreachable | 7.32 | 118.0 | nearest-reachable | [counts](../sim/29-facing/stepped-street/unreachable-rejections.json) |
| L29-stepped-street-object | 6.95 | 186.7 | nearest-reachable | [counts](../sim/29-facing/stepped-street/object-rejections.json) |
| L29-stepped-street-exit-edge-left | 2.50 | 276.4 | nearest-reachable | [counts](../sim/29-facing/stepped-street/exit-edge-left-rejections.json) |
| L29-stepped-street-exit-far | 3.36 | 53.0 | nearest-reachable | [counts](../sim/29-facing/stepped-street/exit-far-rejections.json) |
| L29-church-near-right | 3.08 | 109.1 | nearest-reachable | [counts](../sim/29-facing/church/near-right-rejections.json) |
| L29-church-diagonal-toward | 3.08 | 109.1 | nearest-reachable | [counts](../sim/29-facing/church/diagonal-toward-rejections.json) |
| L29-church-occluder-behind | 3.08 | 109.1 | nearest-reachable | [counts](../sim/29-facing/church/occluder-behind-rejections.json) |
| L29-church-occluder-back | 3.06 | 108.2 | nearest-reachable | [counts](../sim/29-facing/church/occluder-back-rejections.json) |
| L29-church-object | 1.05 | 28.2 | complete | [counts](../sim/29-facing/church/object-rejections.json) |
| L29-lobby-near-left | 27.01 | 1601.9 | nearest-reachable | [counts](../sim/29-facing/lobby/near-left-rejections.json) |
| L29-lobby-near-right | 12.52 | 1137.3 | nearest-reachable | [counts](../sim/29-facing/lobby/near-right-rejections.json) |
| L29-lobby-deepest | 2.39 | 38.2 | nearest-reachable | [counts](../sim/29-facing/lobby/deepest-rejections.json) |
| L29-lobby-far-left | 27.86 | 1692.4 | nearest-reachable | [counts](../sim/29-facing/lobby/far-left-rejections.json) |
| L29-lobby-far-right | 97.14 | 1786.0 | nearest-reachable | [counts](../sim/29-facing/lobby/far-right-rejections.json) |
| L29-lobby-diagonal-away | 12.17 | 1106.3 | nearest-reachable | [counts](../sim/29-facing/lobby/diagonal-away-rejections.json) |
| L29-lobby-diagonal-toward | 100.18 | 1842.0 | nearest-reachable | [counts](../sim/29-facing/lobby/diagonal-toward-rejections.json) |
| L29-lobby-object | 14.33 | 313.8 | nearest-reachable | [counts](../sim/29-facing/lobby/object-rejections.json) |
| L29-grocery-near-right | 2.50 | 259.6 | nearest-reachable | [counts](../sim/29-facing/grocery/near-right-rejections.json) |
| L29-grocery-far-left | 1.50 | 80.2 | nearest-reachable | [counts](../sim/29-facing/grocery/far-left-rejections.json) |
| L29-grocery-far-right | 9.30 | 292.0 | nearest-reachable | [counts](../sim/29-facing/grocery/far-right-rejections.json) |
| L29-grocery-diagonal-away | 6.29 | 380.9 | nearest-reachable | [counts](../sim/29-facing/grocery/diagonal-away-rejections.json) |
| L29-grocery-diagonal-toward | 7.71 | 241.9 | nearest-reachable | [counts](../sim/29-facing/grocery/diagonal-toward-rejections.json) |
| L29-grocery-occluder-behind | 1.63 | 23.1 | nearest-reachable | [counts](../sim/29-facing/grocery/occluder-behind-rejections.json) |
| L29-grocery-occluder-back | 1.83 | 55.5 | nearest-reachable | [counts](../sim/29-facing/grocery/occluder-back-rejections.json) |
| L29-grocery-narrow-gap | 1.55 | 128.2 | nearest-reachable | [counts](../sim/29-facing/grocery/narrow-gap-rejections.json) |
| L29-grocery-object | 1.40 | 60.8 | nearest-reachable | [counts](../sim/29-facing/grocery/object-rejections.json) |
| L29-square-deepest | 1.99 | 41.3 | nearest-reachable | [counts](../sim/29-facing/square/deepest-rejections.json) |
| L29-square-far-left | 13.60 | 557.9 | nearest-reachable | [counts](../sim/29-facing/square/far-left-rejections.json) |
| L29-square-far-right | 3.96 | 301.6 | nearest-reachable | [counts](../sim/29-facing/square/far-right-rejections.json) |
| L29-square-diagonal-away | 1.45 | 42.4 | nearest-reachable | [counts](../sim/29-facing/square/diagonal-away-rejections.json) |
| L29-square-diagonal-toward | 5.35 | 407.8 | nearest-reachable | [counts](../sim/29-facing/square/diagonal-toward-rejections.json) |
| L29-square-occluder-behind | 2.37 | 53.4 | nearest-reachable | [counts](../sim/29-facing/square/occluder-behind-rejections.json) |
| L29-square-exit-edge-left | 3.33 | 274.8 | nearest-reachable | [counts](../sim/29-facing/square/exit-edge-left-rejections.json) |

## Final browser and regression verification

- **8/8 browser equivalence PASS**: outside, inside, road, alley × near-left/near-right, with exact equality of every logged field, **zero differences and maximum numeric difference 0**. [Comparison](../equivalence-29/diff-report.json), [captured-source audit](../sim/29-facing/validation/browser-source-audit.json). MP4s and contact sheets accompany the logs. The first outside walk was recaptured after the final generic planner-key change; all eight final captures match current source hashes.
- The final `29-confirm` simulator run matches **all 139 frame logs byte-for-byte** against `29-facing`, with all four gates rerun. [Confirmation](../sim/29-facing/validation/confirmation.json), [confirmation gates](../sim/29-confirm/gates.log). This confirms that retaining first-run state in the generic unconstrained planner did not change the measured motor plans.
- **498 tests / 53 files PASS**, typecheck PASS, lint PASS, **`verify:art --generated` all scenes PASS**. [Tests](../sim/29-facing/validation/tests.log), [typecheck](../sim/29-facing/validation/typecheck.log), [lint](../sim/29-facing/validation/lint.log), [art](../sim/29-facing/validation/art.log).
- **Town replay 133 FAIL**, on the first depot-left walk: residual **73.1289 px**, reported full authored half-stride **72.8098 px**. It never completed the town circuit. [Failure record](../sim/29-facing/validation/town-133.json), [log](../sim/29-facing/validation/town.log). This remains an explicit acceptance blocker, not a passed replay. Its ledger window recorded **12 cached / 0 uncached calls** (overlapping other QA checks).
- The initial QA launch omitted `/api` from `VITE_API_BASE_URL`, so restore/save requests returned 404; the launch environment was corrected. An initial use of the generic render runner lacked required frame counts and produced no proof clips. Both were superseded by the existing exact-equivalence harness, with complete fresh captures. No dotenv file changed.
- Final brief-29 call audit: **100 cached / 0 uncached calls**. The API child had provider credentials absent, and the existing network guard blocked external fetch/HTTP. [Audit](../sim/29-facing/validation/call-audit.json).
- QA browser sessions closed. **API 4317 and game 8080 stopped**, verified no listeners. Owner ports **4410/8090 were untouched**. [Port check](../sim/29-facing/validation/stopped-ports.json). Task-created probes, unused capture plans, empty frame staging and scratch formatting/test logs were removed; simulator runs, verification logs, videos and plots are retained.
- Production commits: `d263569` route/history search rules; `748dc7f` one continuous motor plan and authored stride telemetry; `68edbe0` strict entry/exit facing and single-search budget; `382934c` first-run duplicate state and alternative-entry test. Every commit carries the requested co-author trailer. [Final production source hashes](../sim/29-facing/validation/source-sha256.json).

Supplemental per-location analysis reports **146 scene segments, zero flicker, zero reversals, zero agreement failures, eight zero-stance segments and four change-limit failures**. [Segment evidence](../sim/29-facing/validation/location-facing.json). It does not replace the unchanged 120/139 whole-walk facing result.

No paid calls, push, merge, deployment, GitHub settings change, key write, dotenv edit, asset generation, or reviewer-tool edit was performed. Full Footfall path/scale/depth/video and visual sign-off are not recertified by these four gates or eight browser walks. The arrival regression and failed town replay keep this brief and the overall goal unaccepted.
