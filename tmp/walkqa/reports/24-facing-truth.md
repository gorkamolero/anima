# Brief 24: facing truth

Status: **FAIL — acceptance is not met.** All 139 final captures, checks and visual reviews are complete; 0/139 pass every bar. The planner and side-stride requirements remain incomplete.

Baseline: 83e5099, open-world-mvp. Read goal, brief 23, findings F22-F24 and last 12 commits. Preserving pre-existing calls.md, reviewer walkstats.py and AgentDebug.test.ts changes. Reviewer tools are read-only. Owner ports 4410/8090 untouched; QA 4317/8080, mute=1. No generation; segmentation 0/10.

## Work log

- Baseline reports 42 time-budget searches among 139 walks. Facing gate replaced by reviewer stance checker for brief 24; pixel height uses exact-frame expected height and requires at least 50% measurable frames.
- De-drift attempt 1 rejected before writing because original sheet bounds clip translated boots. Attempt 2 uses transparent padding, preserving every alpha pixel. Retracked contacts agree with exact source contacts plus translation to <0.01 px on all three corrected cycles; diagonal art remains unchanged. Viewed all 85 corrected frames in contact sheets. The original toward stance has an off-boot keypoint at its wraparound; raw kpcheck also confuses visually similar boots on unchanged diagonal frames. These are not called passes.
- Added data-driven sheet frame dimensions so padded sprites are decoded correctly. Worker uses the same production simulator with a 5 s / 250,000 node cap and 1.2 m turn cost. Facing selection compares actual first/last body samples using the reviewer view-ray sign; every prospective stop continuation is checked too.
- Raw keypoint registration ambiguously jumps to the other boot, including on unchanged diagonals. Independent alpha-distance audit checks every planted point: all three corrected sheets and toward-right are within 5 px of opaque artwork; six unchanged away-right frames are 5.1–6.7 px away. The earlier suspected toward off-boot visual observation was not confirmed by this pixel audit. Neither audit proves identity through overlapping boots.
- Retiming preserves every source pose: side stance time is proportional to measured horizontal distance, with the short stance at 2.2 steps/s. This equalizes mean stance speed and stays within the cadence bar; it does **not** make the 277/400 px endpoint distances equal. Time reparameterization alone cannot do that. The chosen pose-preserving retiming therefore only partially meets the requested side-stride correction; the unequal endpoint distances remain an explicit limitation.
- First 139-target diagnostic with strict heading-run/turn constraints: 25 complete search reasons, 111 exhausted, 3 node-budget; 31 complete after permitted anchor refinement. No time-budget result. This is a failed attempt, retained under tuning-attempt1. Fixed a stop validator that had incorrectly judged suffix fragments of stances; the second diagnostic judges each actual stance segment.
- Frozen final runtime at 138c78e. 469 tests, typecheck, lint pass; verify:art all scenes pass (existing vending-machine warning). Worker cancellation test verifies pending planning is not walking, remains still, resolves on cancellation and ignores stale replies. Zero-corner synthetic tests cover near/mid/far stride scales with <=1 heading change.
- Second 139-target diagnostic: 30 complete reasons, 106 exhausted, 3 node-budget; 35 complete after bounded refinement. Additional 30 s / 2,000,000-node diagnostics: road/near-left exhausts 1,089,379 states in 13.28 s; road/exit-edge-right exhausts 1,334,767 in 16.42 s; road/diagonal-toward still time-budgets at 30 s. These are failures of this discretized action set/search, not proof of mathematical impossibility. Outside/near-left, church/far-right, lobby/far-right and square/near-left also exhaust promptly under the increased cap.
- Town replay 112 fails depot-left: 157.50 px endpoint error against 29.78 px half-stride. Its saved ledger has 7 calls, **0 uncached**. Generation providers disabled; OpenRouter narration enabled. This is a regression, not a passing replay.
- Corrected baseline 23: reviewer facing 25/139; exact-frame pixel height plus explicit alpha-overlap censorship 101/139. Measurements use original 83e5099 sprite assets in a temporary snapshot (removed automatically), not transformed assets against old video.

## Final evidence and comparison

Runtime/assets frozen at `138c78e`; evidence tooling finalized separately. All 139 source hashes and reviewed-image hashes match the checkout. Captures contain 16,609 frames at 24 fps, 1920×1080; all 139 6 fps sheets, trajectories, flagged/random foot crops, crossing triples and final six rest frames were inspected. Four off-heading stance-start crops were additionally inspected in [facing-review](../harness-24/facing-review/off-stances.png). No captured walk timed out. Capture completion is not route success.

[Per-walk table and visual notes](24-walk-evidence.md) name every failed walk, its checks, actual start, clicked/reachable targets and endpoint error. Local detailed data: [results](../harness-24/results.json), [evidence index](../harness-24/evidence-index.json), [hash audit](../harness-24/evidence-audit.json), [walkstats](../harness-24/walkstats.log).

| Measurement | Brief 23 | Brief 24 |
|---|---:|---:|
| Captured / visually reviewed | 139 / 139 | 139 / 139 |
| All bars pass | 0 | 0 |
| Facing stance gate (corrected) | 25 | 110 |
| Exact-frame pixel height (corrected) | 101 | 86 |
| Floor | 136 | 139 |
| Perspective telemetry scale | 138 | 139 |
| Draw order | 139 | 139 |
| Path including actual ratio | 14 | 41 |
| Physical arrival | 83 | 29 |
| Click / exit behavior | 12 | 5 |
| Lock excursion ≤1.5 px | 137 | 135 |
| No frozen walking frames | 139 | 137 |
| Video/log alignment | 139 | 139 |
| Visual pass | 2 | 6 |
| Median heading changes | 3 | 1 |
| Search reaches goal / complete reason | 84 | 29 |
| Search time-budget | 42 | 0 |
| Search node-budget | 0 | 3 |
| Search exhausted | 13 | 107 |
| Planner complete after refinement | 98 | 34 |

Facing/height baseline is recomputed with corrected gates; other baseline columns are retained measurements (lock rechecked at 1.5 px). Brief 23 called a reached search `goal`; brief 24 calls it `complete`. The corrected baseline is [here](../harness-24/baseline23/summary.json). Baseline all-bars failure remains certain, even though its legacy overall aggregate used the old gates.

**Budget target fails:** 29/139 = 20.9%, not ≥99%. Removing the 27 ms main-thread deadline did not make valid paths available. The final run has no time-budget exits, but 107 exhausted searches and three node-budget exits. Its worker remains responsive and cancellable. It holds the standing pose while planning; it does not play a start animation concurrently.

**Height regression:** 86/139 versus corrected 101/139. Forty clips have <50% measurable frames; fourteen have an excessive exact-frame relative error (one overlaps both groups). Censored frames themselves do not fail. Canonical side-height deviation is diagnostic only. Telemetry scale passing does not override pixel-height failure or implausible scene calibration (particularly pier).

**Facing:** all 110 passes contain measured stances; 25 failures have no measurable walking stances, four have off-heading samples. The four reported off-heading samples are lobby/object frame 185 (30.6°), and road/exit-edge-left, -1, -2 frame 71 (33.1°). The simulator validator therefore does not establish that every rendered stance is valid. The start/stop/render sampling discrepancy remains unresolved. Straight synthetic near/mid/far tests pass ≤1 heading change, but inside/object has two full-trajectory heading changes on a zero-corner route (including a final settle direction); the stricter user requirement is not established for all real walks.

## Named failures and attempt record

These IDs identify failures, not waivers. The per-walk table attaches them to every affected capture. Two real planner repair attempts are retained; not every remaining defect class received two independent repairs, so the brief's alternative acceptance condition is also unmet.

- **L1 — incomplete native-stride routes / no walking.** All ten scenes are retained. First full 139-target run used facing-valid lattice actions, strong turn cost and restricted heading runs. Second fixed suffix-only stop validation and repeated all 139 targets. Complete reasons improved 25→30 in simulator diagnostics (the rendered harness obtains 29). Additional extended-budget attempts still exhaust or time-budget. See [first](../harness-24/tuning-attempt1/turn-1.2.json), [second](../harness-24/tuning/turn-1.2.json), [extended road](../harness-24/extended-road-budget/turn-1.2.json), [extended others](../harness-24/extended-budget/turn-1.2.json). Examples: [outside/near-left](../harness-24/outside/near-left-sheet.png), [pier/far-left](../harness-24/pier/far-left-sheet.png). This demonstrates a limitation of this implementation/search, not impossibility for the scene.
- **L2 — path detours and rendered facing disagreement.** Both planner attempts constrain turns and stance validity, but actual path efficiency passes only 41/139. [Alley/occluder-back](../harness-24/alley/occluder-back-trajectory.png) shows a staircase detour; [inside/object](../harness-24/inside/object-trajectory.png) shows a zero-corner heading violation. Budget alone did not fix these.
- **L3 — object/exit behavior and town regression.** Only five click/exit behavior checks pass. [Inside/exit-bus_platform](../harness-24/inside/exit-bus_platform-sheet.png) stops before the door; [pier/exit-edge-left](../harness-24/pier/exit-edge-left-sheet.png) barely moves. Both full planner attempts address approach reachability; the final town replay still fails. No claim that exit/event logic independently received two repairs.
- **L4 — pixel measurement/calibration.** Corrected gate and full rerun reveal low measurable coverage and exact-frame errors. [Pier/deepest](../harness-24/pier/deepest-sheet.png) visibly dwarfs scenery. De-drift padding preserves alpha and exact-frame metadata, but this brief does not contain two scene-calibration repairs. This remains open rather than an accepted limitation.
- **L5 — lock, stop pose and visual continuity.** Four lock checks fail; two freeze checks fail; visual pass only 6/139. [Inside/diagonal-toward](../harness-24/inside/diagonal-toward-sheet.png) and [pier/occluder-back](../harness-24/pier/occluder-back-sheet.png) stop in lifted-foot poses. Side art correction plus retiming does not resolve the unequal stance endpoint lengths. Two independent stop-pose repairs were not completed.
- **L6 — coverage confidence.** Narrow-gap/occluder candidates remain explicitly tagged in the per-walk table; a named candidate is not independent proof of the narrowest traversable gap or a successful crossing. No scene or walk was dropped. This requirement remains open.

**Side retiming is partial:** the requested frame redistribution to equalize stance distances is not delivered. Retiming allocates duration in proportion to source travel (approximately 400 and 277 px), equalizing average speed while keeping every pose. It cannot equalize endpoint displacement without changing which poses form a stance. Cadence is ~1.801 steps/s. The remaining limp/unequal lengths must not be described as solved.

## Reproduction and validation

- Art: `python3 packages/sprite-tools/scripts/dedrift-cycles.py`, followed by the existing contact/root-motion scripts; [translation/contact record](../harness-24/art/dedrift.json), [registration check](../harness-24/art/kpcheck.txt), [alpha-distance audit](../harness-24/art/keypoint-alpha-audit.json). All corrected sheets were inspected frame by frame. Diagonals retain their original direction and data.
- Harness: `tmp/walkqa/harness24.mjs` with the saved 139-target plans; API 4317/game 8080, `?mute=1`. `check-watch24.py` runs unchanged reviewer lockcheck, walkstats and facing_stance plus fixed pixelheight and other gates. Facing now depends on trajectory/corner-file freshness; all 139 were explicitly recomputed after the files existed.
- Aggregation: `tmp/walkqa/tools/venv/bin/python tmp/walkqa/results24.py` then `tmp/walkqa/tools/venv/bin/python tmp/walkqa/aggregate24.py`. Neither turns missing checks nor failures into passes.
- Tests: **469/469**, 50 files. Typecheck and lint pass. `verify:art`: all 16 scenes pass, existing vending-machine size warning retained. Logs: [tests](../harness-24/tests-final.log), [typecheck](../harness-24/typecheck-final.log), [lint](../harness-24/lint-final.log), [art](../harness-24/art.log).
- Town run 112: **FAIL**, depot-left 157.50 px endpoint error vs 29.78 px half-stride. [Replay log](../harness-24/town-attempt1.log), ledger `tmp/open-world-demo/run-112.json`: seven calls, zero uncached. fal disabled; OpenRouter narration allowed.
- Pixelheight self-tests retain resize/shortening rejection and add censored-but-correct coverage. Reviewer facing self-test retained unchanged. No reviewer tool was edited; pre-existing walkstats changes were preserved.
- Generation/segmentation calls: **0**. No keys or dotenv written. No push, merge, deploy or settings changes. QA servers stopped; verified 4317/8080 have no listeners and owner 4410/8090 remain running. Task-created patch staging scripts removed; useful capture/diagnostic evidence retained.
