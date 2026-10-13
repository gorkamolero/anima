# Brief 23: state-lattice footstep search

Status: implementation, 139-walk capture, checks and visual review complete. **Acceptance failed: 0/139 walks pass every goal bar.** Reversals are 0, but median cycle changes remain 4 and only 38/139 meet the strict turn limit. Named limitations below remain failures.

Baseline read: goal (octilinear amendment d781796), brief 22, findings, last 20 commits. Branch open-world-mvp. Existing changes to calls.md, tools/walkstats.py and untracked AgentDebug.test.ts are preserved. Reviewer tools are not edited. Owner ports 4410/8090 are protected; QA uses 4317/8080 with mute=1.

Budget: 0/10 segmentation calls; no image edits or generated video.

## Work log

- Confirmed old planner marks any safe stopping prefix complete and restricts reversals only within doglegs. Replacing it with bounded A* over physical support states, validated by the motor's actual sheet simulator.
- Harness baseline has 139 cases, including short/degenerate walks; plans will be regenerated with ground-distance evidence before capture.
- Attempt 1 synthetic regressions: eliminated no-motion fallback; 44 planner/motor tests now pass. New suite covers 0/20/45/70/90 degrees at two stride scales, L corridor, pillar, wide/narrow gap, unreachable projection, blocked settle, and deterministic budget exhaustion.
- First real-sheet browser probe reaches node/time budgets (~670–1007 expansions in 30 ms); exterior deepest and diagonal-toward are partial, so this is not a passing implementation. Optimising simulation and stop evaluation before capture.
- Search repair: admissible distance-to-goal-region heuristic (stop displacement is paid as an edge); final goal radius is capped as well as limited to half the simulated support stride. Removed unused leg decomposition and recovery code. Both sole contacts are now validated throughout the settle, with body sweeps also checked across support transfers.
- Exact-depth stance cache reuses real sheet samples; positions are quantised only for the search closed set. Direct fixed-point placement is used where perspective has no lateral residual. No anchor correction is currently needed/used (zero slide).
- Plans regenerated for all 139 retained cases. A live preflight checks physical standing feasibility and measures planted-sole-to-reachable-target ground distance >=2 m. Church's previous targets were too central (maximum available distance 1.3–1.93 m for several cases); target repairs are recorded, not silently retained as useful tests. An old stepped-street exit is absent from live geometry and retains a coverage failure.
- Attempt 1 captured exterior diagonal-toward: 279 frames, 10.60 m start distance, complete goal found within the 30 ms budget. Viewed its full trajectory: no heading reversal, but 4 cycle changes against a limit of 2, with a deep foreground detour and a body-origin hook at the first major corner. This remains a visual/turn-count failure. Evidence: `harness-23/attempt1/outside/diagonal-toward-trajectory.png`.
- Optimisation attempt 2 checks the exact union of the stance's horizontal body sweeps in one segment (same coverage as checking every frame separately). Real-sheet probe near-left: 258 expansions, 8.9 ms; deeper/diagonal probes still hit the time budget. Extended-budget diagnostic solved the old diagonal in 82.4 ms and exhausted 12,000 nodes for deepest; it is diagnostic only, not the production budget.
- Town replay 105 failed alley-left: ground-space goal alone was insufficient for the legacy screen-space half-stride gate. Added the screen-space condition as an additional goal constraint; replay 106 passed, 0 uncached.
- Accounting for the full stop travel and evaluating every possible stop regressed replay 107 at depot-far due to time-budget exhaustion (21.90 px error versus 19.92 px half-stride). Replaced distance-based stop pruning with exact, collision-independent exit-anchor candidates. This is conservative: all possible exits are considered before discarding collision checks. Replay **108 passes, 0 uncached calls**. All 50 character/planner tests pass, including exact support playback with replanning disabled.
- Full regression before final stop-pruning optimisation: 460 tests, typecheck, lint and all art checks pass. Final rerun pending. Frozen-source capture begins after the exact-exit-anchor commit.
- Church object plan attempts 1–2 failed the physical 2 m start requirement for the old left-window click and the first altar-window hit pixel. A third attempt selects an actual altar-window hit near (1080,450), and live preflight verifies 2.000044 m to its reachable approach. This changes the object click within the same scene, not the floor or scale. All selected starts and target repairs remain in plan.json.
- Final source at `2bb295f`: 460 tests, typecheck, lint pass; art verification all scenes passes. Town replay 108 (same source) passes with 0 uncached calls. Full captures and unchanged reviewer checks are running. Early complete captures still fail some path/facing/pixel-height gates; no pass claim.
- Additional controlled real-sheet simulator comparison is evaluating turn penalties 0.6/0.9/1.2 without editing production source or reviewer tools.
- Turn-cost comparison on 139 real-sheet simulations: 0.6/0.9/1.2 completed 94/94/93 goals; median changes stayed 3 (446/436/432 total). Raising cost alone did not solve the defect.
- Standing double-support experiment: 91 complete goals, median 2 changes (368 total), 31 cases meeting both turn and arrival limits versus 18 with one initial support. Added both physically grounded initial support states to the lattice and required the selected reverse-settle sheet's actual planted label. The initial experiment's 18.75 px cancellation regression was caught by the existing test and fixed with that entry constraint.
- With the entry constraint, the 139-case comparison gives 98/97/97 complete goals at costs 0.6/0.9/1.2, median 2 changes. Retained 0.6.
- Replays 109/110 still hit the budget at depot-far, 1.98 px outside the screen tolerance. Added the explicitly permitted <=0.99 px/stance whole-plan anchor refinement: fixed headings and stance count, every support and settle resimulated, invalid trials discarded, 3 ms reserved from the 30 ms budget. Replay **111 passes, 0 uncached calls**. New tests cover successful bounded refinement and rejection by the floor validator.
- Earlier partial captures are retained under `attempt2/`; they are not mixed into the new capture. Plans now require >=2.02 m from **both** standing soles before clicking, covering either selected initial support. The church object case verifies 2.151 m.
- Metric-definition audit: the earlier tuning numbers count changes between the eight walking **headings**, not start/rest texture changes. Counting texture+mirror transitions during walking reproduces brief 22's median **4**, while heading-only changes have median **2**. Both metrics will be retained; the stricter texture count remains the gate pending the owner's answer. This distinction was not made in the earlier progress comparison.
- Final implementation `32b3d67`: 463 tests and typecheck pass. Full revised capture is split into disjoint scene groups; source hashes are recorded per walk. No runtime changes during this capture.

- All 139 final-source walks captured; unchanged checks completed. Visual review continues (46 recorded). Church far-right still has 14 heading changes and a foreground loop. Zero immediate reversals is insufficient to establish a good path.
- Post-capture audit found object interception shortening actual goals for lobby/deepest and stepped-street/diagonal-away, occluder-behind. Harness now selects unintercepted floor pixels and checks the actual post-click goal distance; these three are being recaptured. Old preflight distances alone were insufficient evidence.
- Corrected independent trajectory export to stop at the first scene departure, eliminating false chords on return to the source scene. Reviewer tools remain unchanged.

- Eight additional intercepted floor/unreachable clicks identified. The first rerun skipped existing files because --redo was missing; caught by event timestamps and original rug interaction still present. Explicit --redo captures now running. Harness records click repairs and excludes object hits when finding fallback targets; actual support-to-goal distance is asserted after the click. Rechecking these six scenes; stepped-street visual review records foreground detours, crossing pose discontinuities and bent-knee rest poses as failures. No runtime edits during repair.

- Final harness repairs completed with explicit --redo. All 139 walks have current image-hash-backed visual reviews; all 139 source hashes match the frozen runtime. The minimum actual support-to-goal ground distance among the 129 non-unreachable cases is **2.022 m**. Nine captures still barely move (<1 s walking or <40 px source-scene net displacement), including seven ordinary clicks: this is now exposed as planner failure rather than a short-distance plan.

## Implemented planner

The motor executes a bounded state-lattice A* plan without per-stance replanning. The closed set quantises planted ground position to 3 cm and includes support foot, heading and stance phase. Actions simulate the actual sheet's foot-locked half-cycle at landing depth. Same-heading and 45-degree changes are preferred, 90-degree changes are penalised, and larger changes are disallowed after standing. Cost includes ground distance, 0.6 m per 45 degrees, an extra 90-degree penalty and a small step charge. The Euclidean distance-to-goal-region lower bound remains admissible; stop travel is paid as an edge.

Both grounded standing supports are considered, with entry labels constrained to the real reverse-settle drawing. Actions validate both soles against raw floor, body against the eroded walk area, object footprints and swept movement; all settle frames are checked. The stop goal requires ground and screen half-stride proximity. A goal radius cap prevents a large diagonal stride from permitting a visibly distant stop. The nearest walk-area projection is computed before lattice search.

The 12,000-node/30 ms budget includes a reserved 3 ms for the permitted anchor correction: fixed headings and stance count, <=0.99 px slide per stance, three refinement passes, with every modified stance and stop revalidated. Search uses cached exact-depth simulations and direct algebraic placement where perspective permits it. The returned partial plan is labelled incomplete and logged. Old dogleg, beam and steering helpers were removed; no fallback steering remains.

Recorded search reasons: **84 goal, 42 time budget, 13 exhausted**. After allowed refinement, 98 first plans report complete and 41 incomplete. These are planner claims, not acceptance: independent physical-click/exit checking passes only 83 walks. Recorded search elapsed time is at most 28.30 ms; this field excludes some surrounding motor/start overhead and is not a browser-wide hard latency proof.

## Validation and evidence

- **463 tests in 49 files**, typecheck and lint pass. Synthetic planner tests cover 0/20/45/70/90 degrees at near/far stride scales, L corridor, pillar, passable/impassable gaps, unreachable projection, near-wall settle, deterministic budget exhaustion, both standing supports, bounded slide and exact playback without replanning.
- `verify:art`: all 16 scenes pass (existing inside vending-machine calibration warning remains).
- Town replay **111 passes, 0 uncached calls**, mute enabled. Fal was disabled; OpenRouter narration was allowed.
- Final capture: **139 walks, 17,909 frames, 10 scenes**, 0 harness timeouts. All videos align with telemetry and all freeze checks pass.
- Every trajectory is `harness-23/<scene>/<walk>-trajectory.png`. Every trajectory, full contact sheet, flagged and random feet crop, crossing triple and six-frame rest strip was viewed. Corrected source-only overlays were reviewed again for the pier exits and depot doors.
- [Per-walk bars, coordinates and visual notes](23-walk-evidence.md), [machine-readable index](../harness-23/evidence-index.json), [source/video/image hash audit](../harness-23/evidence-audit.json), [reviewer aggregate](../harness-23/results.json).
- Logs: [tests](../harness-23/tests-final.log), [typecheck](../harness-23/typecheck-final.log), [lint](../harness-23/lint-final.log), [art](../harness-23/art.log), [town](../harness-23/town-final2.log), [run111](../harness-23/run-111.json).

## Comparison (passing walks out of 139)

Starts and some targets were regenerated in 23, so this is a coverage comparison, not a controlled identical-path performance experiment. Earlier degenerate walks inflated some pass counts. No failed check was waived.

| Bar | 20 | 21 | 22 | 23 |
|---|---:|---:|---:|---:|
| Planted lock (reviewer <=1 px) | 138 | 136 | 137 | 137 |
| Raw floor | 138 | 138 | 137 | 136 |
| Telemetry scale | 139 | 139 | 139 | 138 |
| Pixel height | 25 | 41 | 23 | 16 |
| Facing | 0 | 4 | 5 | 3 |
| Telemetry draw order | 139 | 138 | 139 | 139 |
| Octilinear path + body clearance | 12 | 96 | 28 | 14 |
| Legacy click/exit | 14 | 3 | 16 | 12 |
| Zero frozen walking frames | 137 | 139 | 137 | 139 |
| Video/log alignment | 139 | 139 | 139 | 139 |
| Visual review | 1 | 22 | 13 | 2 |
| Every required bar | 0 | 0 | 0 | 0 |

The lock checker retains its stricter 1 px gate rather than relaxing it to the goal's 1.5 px. Telemetry draw-order success does **not** establish correct mask pixels: the visual failures remain. Physical sole/half-stride behavior passes **83/139**, versus 57/139 in 22; legacy behavior is separately retained.

| Motion metric | 20 | 21 | 22 | 23 |
|---|---:|---:|---:|---:|
| Median texture+mirror cycle changes | 9 | 2 | 4 | 4 |
| Maximum cycle changes | 83 | 7 | 16 | 15 |
| Median source heading changes | 7 | 0 | 2 | 3 |
| Walks with immediate >90-degree heading reversal | 106 | 10 | 54* | 0 |

*The independent baseline extractor finds 54 in 22 versus the reviewer's 53; the discrepancy is retained rather than silently claiming the same implementation. It reproduces the reviewer's median 4 texture changes. `cycleChanges` includes start/settle and destination walking textures, matching that counting convention; `headingChanges` counts only the eight source-scene directions before first departure. Turn limits use 1 + the number of >25-degree ground-space corners in the pre-click walk-area route. Strict cycle-limit pass: **38/139**; heading-only pass: **53/139**. Zero reversal does not forbid a loop made from several small turns.

## Named limitations and attempt evidence

These are unaccepted limitations. The experiments below are real sheet simulations and/or browser captures, not proof that every newly observed pixel defect received two targeted repairs. The per-walk index maps each failed bar to these IDs.

**L1 — Native-stride reachability and incomplete-plan arrival.** Walk-area connectivity and a valid standing pose do not guarantee that an allowed entry/stance/stop sequence exists. Attempt 1 was single-support search plus exact exit pruning; attempt 2 added double-support standing roots and constrained entry labels. Replays 109/110 still missed arrival, leading to the bounded slide correction and passing replay111. The final sweep still has 41 incomplete initial plans. Road near-right/diagonal-away only settle, lobby far-right/diagonal-toward and pier far-left/narrow-gap are stationary. Their zero turn counts do not constitute success. Evidence: [first probe](../harness-23/probe.log), [double-support experiment](../harness-23/double-support.log), [failed town](../harness-23/town-double-support2.log), [final per-walk index](23-walk-evidence.md).

**L2 — Turn cost, body hooks and path length.** A* eliminates immediate reversals but does not meet the turn/length bars. First real-sheet 139-case comparison at turn costs 0.6/0.9/1.2 reached 94/94/93 goals; median heading changes stayed 3. The double-support and entry-constrained second comparison reached 98/97/97 with median 2. These trials used then-current plans; later click repairs make their totals non-identical to the final capture. Final costs remain 0.6. Foreground loops, repeated neighbouring headings and body-origin hooks remain visible; church far-right has 14 heading changes. Only 14 final walks meet the path gate. Evidence: [first comparison](../harness-23/tuning/turn-0.6.json), [higher penalty](../harness-23/tuning/turn-1.2.json), [second comparison](../harness-23/final-tuning/turn-0.6.json), [second higher penalty](../harness-23/final-tuning/turn-1.2.json), [captured first depot attempt](../harness-23/attempt1/outside/diagonal-toward-trajectory.png). A mathematically admissible search heuristic is not a guarantee of a good budget-limited result.

**L3 — Exit/object integration.** A valid nearest-floor stop is not always inside an exit trigger; destination mappings and rollback behavior are separate from lattice feasibility. Town replays improved across two support/arrival repair rounds, but they do not cover all generated-scene exits. Final legacy click/exit checks pass only 12/139. A stepped-street exit from the prior plan is absent in live geometry and remains a named coverage failure. Pier exit source overlays intentionally stop before destination rollback. No claim of two targeted destination-map repairs is made; this part of acceptance remains outstanding.

**L4 — Drawn silhouette and rest-pose continuity.** Pixel height passes only 16/139 although telemetry scale passes 138/139. Crossing triples show abrupt height/pose changes, and several stable stops remain bent-kneed. Brief22's uniform-scale and vertical-only experiments were both rejected; the native drawings were preserved under this brief's no-art-edit constraint. Occlusion/tracking failures are also retained, not presented as a pure calibration result. [Prior attempt evidence and measured silhouette mismatch](22-octilinear.md#named-limitations-and-acceptance-gaps).

**L5 — Physical appearance differs from cached floor/mask geometry.** Road roots/traps and square fountain expose false floor or visual occlusion; square far-left/far-right intersect the fountain silhouette, while square narrow-gap loses torso/shins to a storefront mask. Some final road stops have jagged missing shins. Brief21 mask refinement and brief22 cached apron migration are prior repair attempts for this class; they do not prove two targeted repairs for each new cutout. The raw-floor validator cannot correct incorrect input geometry. No segmentation or image edits were made; these failures are retained explicitly. [Prior boundary](22-octilinear.md#named-limitations-and-acceptance-gaps), plus each walk's crossing/feet notes in the evidence table.

**L6 — Harness semantic coverage.** The distance requirement now passes for every ordinary walk. Two actual harness repair rounds removed intercepted floor clicks: first lobby/deepest and stepped-street diagonal-away/occluder-behind; then lobby narrow-gap, stepped far-right and six unreachable clicks. The first second-round invocation lacked --redo and skipped files; it was detected and rerun correctly. However, church target relocation can duplicate extremal destinations and no longer proves the original narrow-gap/occluder semantics. Synthetic corridor tests pass, but they do not restore missing real-scene coverage. A nearest walk-area projection is not certified to be lattice-reachable. These are additional acceptance gaps, not silent replacements for the requested cases.

## Scope and handoff

Runtime frozen at **32b3d67** throughout the final sweep. Small implementation commits: `6ee3c40`, `266a712`, `bce61b9`, `2bb295f`, `32b3d67`; harness/report checkpoint `5bacc30`. All use the requested co-author trailer. No push, merge or deployment. Reviewer tools were not edited; pre-existing dirty files remain untouched. Segmentation calls **0/10**; no generated or edited art/video (only requested QA recording and plots). The implementation is available for review, but **FOOTFALL-GOAL is not achieved**. Two-attempt evidence is strongest for planner arrival/turns and harness interception; generated exit mappings and newly isolated mask boundaries still lack two targeted repair proofs.

Cleanup verified: QA API4317 and game8080 stopped. Owner processes remain listening on 4410 (PID74022) and 8090 (PID74015). No task capture/check browser process remains. Verification artifacts and failed-attempt evidence are retained.
