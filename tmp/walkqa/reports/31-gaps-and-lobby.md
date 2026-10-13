# Brief 31 — gaps and lobby

Retained motor change: **ed50f23**. Baseline gate: `half=104 one=4 far=18 facing=132 reversals=0 flicker=1 lock=0 offfloor=0 objcontacts=0`.

| Committed change | Gate line |
|---|---|
| `ed50f23` — motor/planner/tests/floor | `run=31-preserve-arrivals half=109 one=4 far=12 facing=132 reversals=0 flicker=1 lock=0 offfloor=0 objcontacts=0` |
| This evidence-only report | Same source and gate line above; no engine changes |

Floor raised to half=109; facing=132, reversals=0, flicker≤1 retained. Rejected candidates were not committed. Gate and reviewer tools were not edited by this work (the checkout already had a dirty `walkstats.py`).

Narrow gaps are measured in ground metres across exact raster intervals: raw-floor, object-free sole landings; each unsupported span <40% of the sole stride; body clearance everywhere except qualifying gaps. Solid footprints remain impassable. Tests cover 10 cm, 1 m, objects, clearance and actual motor prediction.

**Lobby diagnosis:** baseline near-left rejected `entry:body-off-clearance=2286`, `rest:body-off-clearance=2098`; the raw-floor hole near x1430–1470/y1048 is not a pillar footprint. Gap support enables the rug crossing: motor distance 1491→3.8 px (far-left 1566→9.4 px). A second failure left adjacent route bends unconsumed when a real turn landed ~0.77 m from a 0.6 m corner radius. Consume compatible nearby bends together; bounded fallback searches use 1.2 m and a gap-compatible direct heuristic. Far-right improves 841→196 px but still exhausts its node budget. Entrance destinations use an actual supported straight finish; refinement cannot replace an achieved arrival with an incomplete detour.

**Arrival target remains unmet:** 109/125 same-scene walks = **87.2%**, plus 14 completed transfers. Four misses are within one stride; 12 are farther. [Every miss, distance, rejection histogram, limitation and sheet path](../sim/31-preserve-arrivals/validation/arrival-misses.json). Far misses: pier far-right/diagonal-toward (1640/1638 px), near-left/far-left/narrow-gap (360/75/195); lobby far-right/near-right/diagonal-away/diagonal-toward (197/229/316/368); road near-right/diagonal-away (380/304); outside occluder-behind (398). These remain bounded authored-gait/clearance/turn-search limitations, not proofs that all possible routes are impossible. Pier water spans include ~0.41 m and 1.23 m at y846; the gap rule does not turn those into walkable floor. Full FOOTFALL signoff stays open.

**Seven facing failures explained** ([raw output](../sim/31-preserve-arrivals/validation/facing.jsonl)); none waived:

| Walk | Explanation |
|---|---|
| grocery/unreachable | Zero measurable walking stances; planted finish is within half a stride (66 px). |
| pier/unreachable | Zero measurable walking stances; planted finish is within half a stride (69 px). |
| inside/exit-bus_platform | 100% stance agreement; toward-right(1), right(3), toward-right(1), toward(4): 3 changes >2 and one flicker. |
| outside/exit-edge-right | 100% agreement; 6 changes >2 across the transfer and destination walk. |
| road/exit-edge-left | 100% agreement; toward-left(1), left(6), away-left(2), toward-left(3): 3 changes >2. |
| road/exit-edge-left-1 | Same aliased route and failure. |
| road/exit-edge-left-2 | Same aliased route and failure. |

The reviewer aggregates cross-scene runs with a two-change limit. That explains the exit failures; it does not make their turns visually clean.

**Visual pass:** inspected all 139 eight-frame sheets and extra-heading annexes made with unchanged `tools/composite.py`. [Manifest](../sim/31-preserve-arrivals/sheets/manifest.json), [review record](../sim/31-preserve-arrivals/validation/visual-review.json). No definite floor-support, limb-through-object or layer-order defect found in these sampled panels. Findings remain:

- Unnecessary out-and-back route: `tmp/walkqa/sim/31-preserve-arrivals/sheets/inside-unreachable.png` (+ `-turns.png`).
- Trapped-strip detours: `tmp/walkqa/sim/31-preserve-arrivals/sheets/pier-far-right.png` and `pier-diagonal-toward.png`.
- Busy exit turns: `tmp/walkqa/sim/31-preserve-arrivals/sheets/inside-exit-bus_platform.png` and `outside-exit-edge-right.png` (+ annexes).

Static sheets establish sampled composition, not full-motion approval. All additional heading changes are retained in `*-turns.png`; absent cut/settle phases use the adjacent final moving frame.

**Final checks:** [8/8 browser walks exact](../sim/31-preserve-arrivals/browser/diff-report.json), zero numeric differences (outside/inside/road/alley × near-left/near-right). `pnpm test:run --maxWorkers=1`: **516/516**, 55 files; typecheck, lint and `verify:art --generated` pass. The first suite run during capture hit two timeouts; the unmodified serial rerun passed. [Validation logs](../sim/31-preserve-arrivals/validation/).

[Town replay 3103](../sim/31-preserve-arrivals/validation/town/run-3103.json): **25 checkpoints, 0 uncached calls**. Entire brief ledger: **236 cached / 0 uncached**; external provider calls blocked by the QA server guard. An earlier invocation omitted `--replay` and failed its cached-options check; the corrected replay and final replay both passed. No paid calls. QA process groups stopped, five task-created world sessions removed; 4317/8080 closed, owner's 4410/8090 preserved. No push, merge or deploy. Existing `calls.md`, `walkstats.py`, and untracked `AgentDebug.test.ts` changes preserved.
