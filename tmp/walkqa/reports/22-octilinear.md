# Brief 22: octilinear footsteps

Status: full 139-walk capture, checks and visual review complete. **Goal not achieved: 0/139 complete passes.** Named limitations below remain failures; the two-attempt fallback is not established for every newly isolated defect.

Read brief 21, findings, goal and the last 15 commits. Existing owner changes to
`docs/FOOTFALL-GOAL.md`, `tmp/walkqa/tools/walkstats.py`, `tmp/walkqa/calls.md`
and untracked `AgentDebug.test.ts` are preserved. The goal already contains the
requested octilinear amendment. Protected reviewer tools remain unchanged.

## Work log

- Baseline: brief 20 0/139 complete passes; brief 21 0/139 complete passes,
  behavior 3/139, exits 1/19, silhouette height 41/139.
- Planner repair: measure native drawn strides through the simulator; enumerate
  two contiguous runs in both orders and validate their landings and stop.
- Segmentation calls so far: 0/20. No image/video generation.

- Attempt 1: exterior near-left arrived 37.28 px from target (half-stride 64.98).
  Inspecting its sheet revealed a late reversal. Attempt 2 measures paired support
  landings rather than pose-origin displacement: 28.52 px versus 30.73 half-stride,
  with left -> away-left -> away along successive route legs.
- Town 93 passed first walk, failed right because a blocked future stride forced a
  bogus 2 px tolerance. Town 94 corrected that and reached road, but could not start.
  Town 95 allowed a safe forward native run when the nominal bracket was blocked:
  road left reached 12.54 px versus 9.29 half-stride. Three bounded correction
  simulations repaired this residual. **Town 96 completes, 0 uncached calls.**
- Alleged net apron at crossing 50 belongs to crate-0's mask. Low crate/basket
  columns now split into a floor decal using cached pixels; no segmentation call.
- Height audit retains the original gate. Brief-21 frame counts: 7,317 pass;
  1,014 canonical-vs-drawing discrepancy; 2,145 rendered/tracking/occlusion discrepancy;
  538 clipped, 127 indistinguishable, 23 invisible. These categories need image review,
  not a blanket relaxation of the size bar.
- The additional obstacle-order test exposed collision-dependent bracket selection.
  Native directions are now measured without collision rejection; execution candidates
  still validate every stance and settle. The obstructed order test passes.
- Retaining the old behavior checker untouched exposes a criterion mismatch: it tests
  sprite-origin distance <=12 px. `behavior22.py` separately tests the physical sole
  against half a drawn stance and preserves `legacyPass`; both will be reported.
- Final source replay 99 passes with 0 uncached calls. Replay 97 exposed a blocked
  starting drawing despite a clear route centre; replay 98's native departure fixed
  it but missed road-near by 0.78 px beyond the half-stride bar. The correction cap is
  now 0.99 px per stance (still <=1), and replay 99 passes all 25 records.
- Size repair trials (not installed): uniform 1.0441x scaling and vertical-only
  1.0441x scaling about the planted foot make the 987 px away rest approach the
  1030.5 px canonical silhouette. The first breaks calibrated scale by 4.41%; the
  second changes proportions and raises the head about 20 screen pixels. See
  `harness-22/size-trials/comparison.png` and the three raw screenshots/JSON records.
  Both are rejected; no art asset was edited by these trials.
- Reversal repair experiments 100–103: a global >90-degree turn guard, then an
  opposite-cycle-only guard, each with additional whole-walk residual redistribution,
  broke later town arrivals (road near and alley right). These are retained in
  `experiments/reversal-guards/strict-global.ts` and `run-100.json`–`run-103.json`.
  Final motor rejects opposite cycles within each dogleg; obstacle-route leg joins
  remain a named limitation if they reverse. Final replay **104: 25 records,
  32 shared-ledger cached calls, 0 uncached, no error**. The complete fixed-source
  capture starts after commit `20e617d`; earlier partial sweeps are attempts 1–6.
- **Alley apron fixed in the exact original crossing**: replayed original 21 frames
  49/50/51 with identical texture frame, scale, position and anchor, changing only
  the cached occluder layers. The left boot is now intact at 50 and 51. Before:
  [brief-21 crossing](../harness-21/alley/deepest-crops/crossing-review-000.png).
  After: [same-pose crossing](../harness-22/apron-proof/crossing-after.png).



## Named limitations and acceptance gaps

These remain failures, not waived passes. Each walk in the evidence index retains
its individual checks and visual observations. The index links corresponding brief-21 and brief-22 captures. Those are two
implementation evaluations, not evidence of two targeted repairs for each new defect.

- **L1 — Truncated native-stride arrival.** Brief 21 beam planning and brief 22
  bracketing/order flips/midpoint subdivision both fail in narrow support regions.
  A safe stopping prefix is still treated as a complete plan; the game can stop
  outside half a stride. Stationary church and interior-doorway captures expose it.
- **L2 — Route-join reversals and excessive distance.** Two-run decomposition is
  enforced per dogleg, not across all visibility-route legs. The global turn guards
  in replays 100 and 102, and residual variants 101/103, broke town arrival; they
  were rejected. The retained local guard does not establish a no-reversal walk.
- **L3 — Exit arrival and destination mapping.** Physical-sole arrival replaced
  sprite-origin arrival, but the half-stride fallback does not guarantee an anchor
  inside every exit polygon. Exterior depot doors still stop without transition.
  Pier edge-right fires once, then rolls back because its destination lacks the
  physical edge-left return exit. This is a separate mapping defect.
- **L4 — Canonical silhouette versus drawn rest.** The away standing drawing is
  987 px versus the canonical side median 1030.5 px (4.22% shorter); toward standing
  is 991 px (3.83% shorter). Uniform and vertical-only scale trials are both saved
  and rejected above. The size discrepancy remains; tracking/occlusion failures
  are reported separately and do not excuse it.
- **L5 — Occluder fragments and authored floor ambiguity.** Brief 21 mask refinement
  and brief 22 cached apron classification fix the original alley boot cut, but
  other captures still show boot fragments near the vending machine, abrupt post
  crossings, and apparent walking across raised roots or pier gaps. Cached mask
  migration is not evidence that every object boundary is correct.
- **L6 — Path optimum model.** The updated checker computes a canonical ground-space
  octilinear norm visibility geodesic, with Euclidean optimum retained. At oblique
  boundaries this is an infimum; it does not construct a finite native-stride path
  using the depth-varying drawing directions. Its output must not be described as
  proof of that stronger achievable-path optimum. Truncated walks can also have a
  deceptively low length ratio; arrival remains an independent mandatory bar.

Validation on the frozen implementation: 465 tests in 49 files, typecheck, lint,
16 art checks, and town replay104 pass. No segmentation calls or generated art.
Logs: [tests](../harness-22/tests-final.log),
[typecheck](../harness-22/typecheck-final.log), [lint](../harness-22/lint-final.log),
[art](../harness-22/art.log), [town](../harness-22/town-dogleg-guard.log).





## Final evidence and attempt boundaries

All **139/139 walks** were captured at frozen runtime commit `20e617d`, with
**18,170 frames**, **0 timeouts**, all checker outputs present, and all 139 visual
manifests reviewed. Capture source hashes match current runtime files; reviewed
image hashes match their manifests. [Verification](../harness-22/verification-final.json).
The clean final checker log has no traceback or missing-file errors; earlier partial
sweep logs remain as failed-attempt evidence.

The unchanged behavior gate improves **3 → 16/139**. The requested physical-sole
half-stride assessment passes **57/139** when exact exit-region containment is
also required. Legacy exit transition behavior improves **1 → 8/19**, but only
2 source anchors are inside their requested regions, and neither also passes
all destination checks: **0/19 exact exits pass**. This does not satisfy the exit fix.
Pixel height regresses **41 → 23/139**; observed occlusion artifacts and genuinely
shorter rest drawings are both retained, rather than excused by the scale gate.
Visual review passes **13/139**, independently of numeric checks.

Repair evidence for L1: [attempt 1](../harness-22/probe.log),
[attempt 2](../harness-22/probe2.log), [departure repair](../harness-22/run-97.json),
[bounded correction](../harness-22/run-99.json), and each final walk's paired index.
L2: [global-turn rejection](../harness-22/run-100.json),
[opposite-only rejection](../harness-22/run-102.json), residual variants
[101](../harness-22/run-101.json)/[103](../harness-22/run-103.json), and the retained
[experimental source](../harness-22/experiments/reversal-guards/strict-global.ts).
L4: [uniform and vertical trials](../harness-22/size-trials/comparison.png),
[baseline height classification](../harness-22/height-audit-baseline.json), and
[diagnostic frames](../harness-22/height-evidence/).

L3 source-arrival repair was exercised repeatedly in town replays 93–104, but
**the separately discovered pier return-exit mapping error has not had two targeted
repairs**. L5 has the brief-21 refinement and brief-22 cached mask migration, but
**new road gutter and stepped-street boardwalk defects have not had two targeted
repairs**. Representative cuts: [road deepest](../harness-22/road/deepest-crops/feet-review-000.png),
[boardwalk](../harness-22/stepped-street/diagonal-toward-crops/feet-review-000.png),
[building crossing](../harness-22/stepped-street/narrow-gap-crops/crossing-review-000.png).
These are acceptance gaps, not limitations declared accepted by the owner.
L6 is a checker-model gap and likewise is not a certified implementation of the
stronger achievable-path optimum. Self-tests still pass for the implemented model.

The complete town replay104 passes all 25 records with **32 cached ledger calls,
0 uncached calls**, muted. Segmentation calls: **0/20**. No generated or edited
character/background art or video; apron work only reclassifies existing cached
mask pixels. All verification logs and failed trials remain local. Runtime servers
on **4317/8080 were stopped**; owner **4410/8090** listeners were preserved.
[Ports after cleanup](../harness-22/ports-after.txt). No push, merge or deployment.


## Results (generated from saved evidence)

| Check | Brief 20 | Brief 21 | Brief 22 |
|---|---:|---:|---:|
| lock | 138/139 | 136/139 | 137/139 |
| floor | 138/139 | 138/139 | 137/139 |
| scale | 139/139 | 139/139 | 139/139 |
| height | 25/139 | 41/139 | 23/139 |
| facing | 0/139 | 4/139 | 5/139 |
| draworder | 139/139 | 138/139 | 139/139 |
| path | 12/139 | 96/139 | 28/139 |
| behavior | 14/139 | 3/139 | 16/139 |
| freeze | 137/139 | 139/139 | 137/139 |
| video | 139/139 | 139/139 | 139/139 |
| visual | 1/139 | 22/139 | 13/139 |

The behavior row preserves the unchanged <=12 px sprite-origin checker. The following supplementary column applies the requested physical-sole half-stride bar. Path 22 uses ground-space octilinear norm; 20/21 retain their original Euclidean screen-space assessments.

| Scene | Captured | Half-stride behavior | Legacy behavior | Visual reviewed |
|---|---:|---:|---:|---:|
| alley | 14/14 | 8/14 | 2/14 | 14/14 |
| church | 12/12 | 3/12 | 0/12 | 12/12 |
| grocery | 12/12 | 6/12 | 0/12 | 12/12 |
| inside | 13/13 | 6/13 | 2/13 | 13/13 |
| lobby | 12/12 | 4/12 | 1/12 | 12/12 |
| outside | 17/17 | 8/17 | 3/17 | 17/17 |
| pier | 14/14 | 2/14 | 0/14 | 14/14 |
| road | 17/17 | 6/17 | 7/17 | 17/17 |
| square | 13/13 | 10/13 | 0/13 | 13/13 |
| stepped-street | 15/15 | 4/15 | 1/15 | 15/15 |

## Walk evidence index

L1 arrival, L2 turns/length, L3 exits, L4 height, L5 contact/masks, L6 optimum model. These are triage references, not waived checks. Every row links the earlier implementation and this frozen capture; two captures alone do not establish two repairs for every newly discovered defect.

| Walk | Brief 21 | Frames | Failed/missing checks | Limitation references | Visual observation |
|---|---|---:|---|---|---|
| [alley/near-left](../harness-22/alley/near-left-sheet.png) | [21](../harness-21/alley/near-left-sheet.png) | 144 | facing, path, height, visual | L2, L4, L5, L6 | Viewed whole arc/feet/settle: left descent repeatedly switches side and away-left, then toward and reverses away at left wall; boots intact across apron, final stand stable 138-143. |
| [alley/near-right](../harness-22/alley/near-right-sheet.png) | [21](../harness-21/alley/near-right-sheet.png) | 191 | behavior, facing, path, height, visual | L2, L4, L5, L6 | Viewed full route, both feet sheets and settle 185-190: right then reverses left then away then right/toward-right repetitions; final bent stride held beside foreground net/trap. Flat apron boots intact. |
| [alley/deepest](../harness-22/alley/deepest-sheet.png) | [21](../harness-21/alley/deepest-sheet.png) | 144 | behavior, facing, path, height, visual | L2, L4, L5, L6 | Viewed whole arc and both feet sheets: left then right-away then away ascent; repeated small left/right offsets along deep run. Final tiny away stand 138-143 visibly detached from floor plane near wall, no settle motion. |
| [alley/far-left](../harness-22/alley/far-left-sheet.png) | [21](../harness-21/alley/far-left-sheet.png) | 148 | behavior, facing, path, height, visual | L2, L4, L5, L6 | Viewed whole arc, feet and settle: long left leg then away leg then left leg around crate; final 142-147 stable but soles appear above painted floor/box area. No slicing in sampled net passage. |
| [alley/far-right](../harness-22/alley/far-right-sheet.png) | [21](../harness-21/alley/far-right-sheet.png) | 209 | behavior, facing, path, height, visual | L2, L4, L5, L6 | Viewed whole route, two feet sheets and settle 203-208: right then toward then right/toward-right toggles before reversing away at wall; final away stand stable, no apron boot slicing. |
| [alley/diagonal-away](../harness-22/alley/diagonal-away-sheet.png) | [21](../harness-21/alley/diagonal-away-sheet.png) | 166 | behavior, facing, path, height, visual | L2, L4, L5, L6 | Viewed full arc and both feet sheets: away-right reverses toward then repeats right/toward-right before away-left and away at wall; final stand 160-165 steady but large detour. |
| [alley/diagonal-toward](../harness-22/alley/diagonal-toward-sheet.png) | [21](../harness-21/alley/diagonal-toward-sheet.png) | 213 | behavior, facing, path, height, visual | L2, L4, L5, L6 | Viewed entire route, two feet sheets and final 207-212: toward then right then toward-right repeatedly near wall; final bent-knee stride held instead of straight stand beside trap. Flat net does not slice sampled early boots. |
| [alley/occluder-behind](../harness-22/alley/occluder-behind-sheet.png) | [21](../harness-21/alley/occluder-behind-sheet.png) | 28 | behavior, facing, visual, goal22 behavior | L1, L2, L5, L6 | Viewed whole 28-frame arc and feet/stop sheets: stationary start beside left wall, only bent-to-straight settle; no actual behind-object walk. Boots remain intact. |
| [alley/occluder-back](../harness-22/alley/occluder-back-sheet.png) | [21](../harness-21/alley/occluder-back-sheet.png) | 28 | behavior, facing, visual, goal22 behavior | L1, L2, L5, L6 | Viewed full 28-frame arc, feet and stop 22-27: no meaningful travel, merely initial bend to straight side stand at start by left wall; boots intact. |
| [alley/narrow-gap](../harness-22/alley/narrow-gap-sheet.png) | [21](../harness-21/alley/narrow-gap-sheet.png) | 37 | behavior, facing, height, visual, goal22 behavior | L1, L2, L4, L5, L6 | Viewed whole short arc and feet/settle: tiny left then toward movement stops deep in alley; final 31-36 stand visibly floating above painted ground near facade. No stop drift. |
| [alley/unreachable](../harness-22/alley/unreachable-sheet.png) | [21](../harness-21/alley/unreachable-sheet.png) | 74 | behavior, facing, path, visual | L2, L5, L6 | Viewed full sheet, feet and settle 68-73: initial left leg immediately reverses into away-right then front-right at wall; stable final stand, boots intact in sampled floor/net passage. |
| [alley/object](../harness-22/alley/object-sheet.png) | [21](../harness-21/alley/object-sheet.png) | 84 | behavior, facing, height, visual, goal22 behavior | L1, L2, L4, L5, L6 | Viewed whole arc and feet/settle: left then away-left then left approach to crate; final away stand 78-83 floats over crate shadow area instead of grounded contact. |
| [alley/exit-far](../harness-22/alley/exit-far-sheet.png) | [21](../harness-21/alley/exit-far-sheet.png) | 148 | behavior, facing, path, height, visual, goal22 behavior | L3, L2, L4, L5, L6 | Viewed entire route/transition and feet/settle: left then reverses right before away, later left and away again; transition reaches new alley once, destination stable 142-147. Reversals remain. |
| [alley/exit-near](../harness-22/alley/exit-near-sheet.png) | [21](../harness-21/alley/exit-near-sheet.png) | 225 | facing, path, height, visual, goal22 behavior | L3, L2, L4, L5, L6 | Viewed entire route/transition, both feet sheets and final 219-224: left immediately reverses right then toward; exit transitions once into road and walk-in stops. Reversal persists, no apron clipping in sampled feet. |
| [church/near-left](../harness-22/church/near-left-sheet.png) | [21](../harness-21/church/near-left-sheet.png) | 38 | behavior, visual, goal22 behavior | L1, L5, L6 | Short approach ends in bent-knee diagonal rest; boots intact but requested lateral traversal is truncated. |
| [church/near-right](../harness-22/church/near-right-sheet.png) | [21](../harness-21/church/near-right-sheet.png) | 52 | behavior, facing, visual | L2, L5, L6 | Short rightward approach changes to away-right and back; narrow pew-side strip cuts right trouser in final pose. |
| [church/deepest](../harness-22/church/deepest-sheet.png) | [21](../harness-21/church/deepest-sheet.png) | 28 | behavior, facing, visual, goal22 behavior | L1, L2, L5, L6 | Stationary hold with no meaningful walk to the requested depth; straight rest and intact boots do not establish arrival. |
| [church/far-left](../harness-22/church/far-left-sheet.png) | [21](../harness-21/church/far-left-sheet.png) | 39 | behavior, facing, visual, goal22 behavior | L1, L2, L5, L6 | Viewed all sheets and stop frames: short truncated traversal with abrupt away turn then side settle; boots intact, upright final pose. |
| [church/far-right](../harness-22/church/far-right-sheet.png) | [21](../harness-21/church/far-right-sheet.png) | 39 | behavior, facing, visual, goal22 behavior | L1, L2, L5, L6 | Short truncated approach with abrupt side-to-diagonal turn; straight final rest but no full requested aisle traversal. |
| [church/diagonal-away](../harness-22/church/diagonal-away-sheet.png) | [21](../harness-21/church/diagonal-away-sheet.png) | 61 | behavior, facing, path, height, goal22 behavior | L1, L2, L4, L6 | Viewed complete sheet, all flagged and random feet, and six stop frames: clear aisle traversal with intact boots and upright stable side settle; numerical bars remain independent. |
| [church/diagonal-toward](../harness-22/church/diagonal-toward-sheet.png) | [21](../harness-21/church/diagonal-toward-sheet.png) | 81 | behavior, facing, path, height, goal22 behavior | L1, L2, L4, L6 | Viewed complete sheet, flagged and random feet, and six stop frames: forward traversal, intact boots, stable upright front settle; numerical bars remain independent. |
| [church/occluder-behind](../harness-22/church/occluder-behind-sheet.png) | [21](../harness-21/church/occluder-behind-sheet.png) | 28 | behavior, facing, visual, goal22 behavior | L1, L2, L5, L6 | Stationary hold beside the pew; the requested behind-object crossing is not executed. |
| [church/occluder-back](../harness-22/church/occluder-back-sheet.png) | [21](../harness-21/church/occluder-back-sheet.png) | 42 | behavior, facing, path, height, visual | L2, L4, L5, L6 | All review images viewed including crossing 9/10/11: spurious pew-colored pixels cut the trouser at frame 9; front settle stable and boots intact. |
| [church/narrow-gap](../harness-22/church/narrow-gap-sheet.png) | [21](../harness-21/church/narrow-gap-sheet.png) | 61 | behavior, facing, path, height, visual | L2, L4, L5, L6 | Viewed all sheets and stop frames: toward-left-away route reverses depth before stopping; feet intact and stable but route fails no-reversal intent. |
| [church/unreachable](../harness-22/church/unreachable-sheet.png) | [21](../harness-21/church/unreachable-sheet.png) | 28 | behavior, facing, height, visual, goal22 behavior | L1, L2, L4, L5, L6 | Immediate turn and settle without a meaningful walk to the nearest reachable point; feet remain intact. |
| [church/object](../harness-22/church/object-sheet.png) | [21](../harness-21/church/object-sheet.png) | 90 | behavior, facing, path, visual, goal22 behavior | L1, L2, L5, L6 | All review images viewed: forward then sideways approach has several terminal cycle changes before side rest; boots intact, interaction arrival judged separately. |
| [grocery/near-left](../harness-22/grocery/near-left-sheet.png) | [21](../harness-21/grocery/near-left-sheet.png) | 103 | behavior, facing, path, height, visual | L2, L4, L5, L6 | All images viewed: lateral reversal shortly after departure, then leftward traversal; intact boots but bent-knee diagonal final pose. |
| [grocery/near-right](../harness-22/grocery/near-right-sheet.png) | [21](../harness-21/grocery/near-right-sheet.png) | 81 | behavior, facing, path, height, visual | L2, L4, L5, L6 | All images viewed: side-away-side-toward sequence changes depth direction during lateral crossing; feet intact and stable upright front stop. |
| [grocery/deepest](../harness-22/grocery/deepest-sheet.png) | [21](../harness-21/grocery/deepest-sheet.png) | 83 | behavior, facing, height, visual, goal22 behavior | L1, L2, L4, L5, L6 | All images viewed: left-away-left-away-right sequence creates extra corners in depth approach; boots intact and upright side settle in aisle. |
| [grocery/far-left](../harness-22/grocery/far-left-sheet.png) | [21](../harness-21/grocery/far-left-sheet.png) | 28 | behavior, facing, visual, goal22 behavior | L1, L2, L5, L6 | All images viewed: stationary right doorway hold with no requested leftward movement; upright rest and intact feet. |
| [grocery/far-right](../harness-22/grocery/far-right-sheet.png) | [21](../harness-21/grocery/far-right-sheet.png) | 139 | behavior, facing, path, height, visual | L2, L4, L5, L6 | All images viewed: right run turns toward barrels then reverses away to doorway; stable side rest, repeated depth reversal. |
| [grocery/diagonal-away](../harness-22/grocery/diagonal-away-sheet.png) | [21](../harness-21/grocery/diagonal-away-sheet.png) | 122 | behavior, facing, path, height, visual | L2, L4, L5, L6 | All images viewed: right-away-right-away-toward-away sequence repeats turns near doorway; intact boots and stable back settle but route is not a clean dogleg. |
| [grocery/diagonal-toward](../harness-22/grocery/diagonal-toward-sheet.png) | [21](../harness-21/grocery/diagonal-toward-sheet.png) | 103 | behavior, facing, path, height | L2, L4, L6 | All images viewed: rightward approach followed by toward settle, boots intact through barrel-side passage and stable upright final pose; numeric path/facing gates remain independent. |
| [grocery/occluder-behind](../harness-22/grocery/occluder-behind-sheet.png) | [21](../harness-21/grocery/occluder-behind-sheet.png) | 57 | behavior, facing, height, goal22 behavior | L1, L2, L4, L6 | Left run then away run, stable rear standing pose; all inspected soles intact and no visible occlusion slice. |
| [grocery/occluder-back](../harness-22/grocery/occluder-back-sheet.png) | [21](../harness-21/grocery/occluder-back-sheet.png) | 144 | behavior, facing, path, height, visual, goal22 behavior | L1, L2, L4, L5, L6 | Extended doorway approach followed by rightward detour and leftward return; multiple route turns. Final side stance stable; inspected soles intact. |
| [grocery/narrow-gap](../harness-22/grocery/narrow-gap-sheet.png) | [21](../harness-21/grocery/narrow-gap-sheet.png) | 43 | behavior, facing, path, height, visual | L2, L4, L5, L6 | All images viewed: short toward-left approach truncates near doorway; final diagonal rest visibly bent at knee despite intact feet. |
| [grocery/unreachable](../harness-22/grocery/unreachable-sheet.png) | [21](../harness-21/grocery/unreachable-sheet.png) | 236 | behavior, facing, path, height, visual, goal22 behavior | L1, L2, L4, L5, L6 | All four images viewed: walks away to back aisle, reverses toward, then away again before front settle; boots intact, major no-reversal violation. |
| [grocery/object](../harness-22/grocery/object-sheet.png) | [21](../harness-21/grocery/object-sheet.png) | 78 | behavior, facing, path, height, visual, goal22 behavior | L1, L2, L4, L5, L6 | Left, toward, left and away runs double back near counter; final bent diagonal pose remains above sacks. Boots intact in inspected frames. |
| [inside/near-left](../harness-22/inside/near-left-sheet.png) | [21](../harness-21/inside/near-left-sheet.png) | 144 | behavior, facing, height, visual | L2, L4, L5, L6 | Extended leftward run then away turn beside vending machine; final rear stance clips at left edge. Boots otherwise intact in inspected samples. |
| [inside/near-right](../harness-22/inside/near-right-sheet.png) | [21](../harness-21/inside/near-right-sheet.png) | 161 | behavior, facing, path, height, visual | L2, L4, L5, L6 | Side-away-side sequence crosses room; boot and floor fragments at35-45 near vending machine. Final stance clipped at right edge. |
| [inside/deepest](../harness-22/inside/deepest-sheet.png) | [21](../harness-21/inside/deepest-sheet.png) | 168 | behavior, facing, path, height, visual, goal22 behavior | L1, L2, L4, L5, L6 | Rightward run reverses left then repeatedly switches away/toward near doorway. Final front standing pose stable; boots intact. |
| [inside/far-left](../harness-22/inside/far-left-sheet.png) | [21](../harness-21/inside/far-left-sheet.png) | 204 | behavior, facing, path, height, visual | L2, L4, L5, L6 | Left then toward then extended left run; final stance clips at left screen edge. Inspected floor contacts remain intact. |
| [inside/far-right](../harness-22/inside/far-right-sheet.png) | [21](../harness-21/inside/far-right-sheet.png) | 170 | behavior, facing, path, height, visual | L2, L4, L5, L6 | Repeated side/diagonal changes across room; feet stop over upright doorway jamb rather than clear floor. Final rear-diagonal stance is stable. |
| [inside/diagonal-away](../harness-22/inside/diagonal-away-sheet.png) | [21](../harness-21/inside/diagonal-away-sheet.png) | 167 | behavior, facing, height, visual, goal22 behavior | L1, L2, L4, L5, L6 | Many alternating side and diagonal runs across floor, then away at doorway; final rear stance stable. Visible boot artifact at frames64-66. |
| [inside/diagonal-toward](../harness-22/inside/diagonal-toward-sheet.png) | [21](../harness-21/inside/diagonal-toward-sheet.png) | 161 | facing, path, height, visual | L2, L4, L5, L6 | Many side and diagonal changes despite broad clear floor; final character clipped at right screen edge. Boot fragments at64-66. |
| [inside/occluder-behind](../harness-22/inside/occluder-behind-sheet.png) | [21](../harness-21/inside/occluder-behind-sheet.png) | 61 | behavior, facing, path, height, visual | L2, L4, L5, L6 | Moves away then left and diagonal back toward start; extra turn leaves endpoint near initial doorway. Stable rear diagonal settle. |
| [inside/occluder-back](../harness-22/inside/occluder-back-sheet.png) | [21](../harness-21/inside/occluder-back-sheet.png) | 28 | behavior, facing, path, visual, goal22 behavior | L1, L2, L5, L6 | No departure during28-frame attempt; soles and stationary pose visible at doorway. |
| [inside/narrow-gap](../harness-22/inside/narrow-gap-sheet.png) | [21](../harness-21/inside/narrow-gap-sheet.png) | 28 | behavior, facing, path, visual, goal22 behavior | L1, L2, L5, L6 | All28 frames stationary at doorway; attempted walk does not depart. Standing soles intact. |
| [inside/unreachable](../harness-22/inside/unreachable-sheet.png) | [21](../harness-21/inside/unreachable-sheet.png) | 39 | behavior, path, goal22 behavior | L1, L2, L6 | Short diagonal approach stops upright beside ticket booth; no visible reversal or sliced sole in reviewed samples. |
| [inside/object](../harness-22/inside/object-sheet.png) | [21](../harness-21/inside/object-sheet.png) | 125 | behavior, facing, path, height, visual, goal22 behavior | L1, L2, L4, L5, L6 | Toward then repeated side/diagonal turns near vending machine; ends bent diagonal stance instead of upright settle, with partial left-edge clipping. |
| [inside/exit-bus_platform](../harness-22/inside/exit-bus_platform-sheet.png) | [21](../harness-21/inside/exit-bus_platform-sheet.png) | 75 | floor, facing, path, height, goal22 behavior | L3, L2, L4, L5, L6 | Rightward approach visibly transitions once to exterior bus terminal; final destination stance stable and boots intact. |
| [lobby/near-left](../harness-22/lobby/near-left-sheet.png) | [21](../harness-21/lobby/near-left-sheet.png) | 281 | behavior, facing, path, height, visual | L2, L4, L5, L6 | All five images viewed: extended right-edge departure and multi-turn detour before left crossing; boots intact, final back rest clipped by screen edge. |
| [lobby/near-right](../harness-22/lobby/near-right-sheet.png) | [21](../harness-21/lobby/near-right-sheet.png) | 259 | behavior, facing, path, height, visual | L2, L4, L5, L6 | All five review images viewed: long traversal uses repeated diagonal/side changes; boots intact, back-facing stop at clipped right boundary; no clean two-run route. |
| [lobby/deepest](../harness-22/lobby/deepest-sheet.png) | [21](../harness-21/lobby/deepest-sheet.png) | 60 | behavior, facing, height, visual, goal22 behavior | L1, L2, L4, L5, L6 | All images viewed: right-toward-right-away cycle sequence truncates the depth approach; upright final back pose and intact boots. |
| [lobby/far-left](../harness-22/lobby/far-left-sheet.png) | [21](../harness-21/lobby/far-left-sheet.png) | 28 | behavior, facing, height, visual, goal22 behavior | L1, L2, L4, L5, L6 | All images viewed: stationary tiny character at far-right doorway, no requested crossing; clear boots but no arrival. |
| [lobby/far-right](../harness-22/lobby/far-right-sheet.png) | [21](../harness-21/lobby/far-right-sheet.png) | 28 | behavior, facing, path, height, visual, goal22 behavior | L1, L2, L4, L5, L6 | All images viewed: stationary at left frame boundary throughout, no requested approach; upright rest with screen clipping. |
| [lobby/diagonal-away](../harness-22/lobby/diagonal-away-sheet.png) | [21](../harness-21/lobby/diagonal-away-sheet.png) | 389 | behavior, facing, path, height, visual, goal22 behavior | L1, L2, L4, L5, L6 | Crosses room then repeated away/toward reversals along right column; foot fragments at68-86. Ends stable rear stance near doorway. |
| [lobby/diagonal-toward](../harness-22/lobby/diagonal-toward-sheet.png) | [21](../harness-21/lobby/diagonal-toward-sheet.png) | 28 | behavior, facing, path, height, visual, goal22 behavior | L1, L2, L4, L5, L6 | Stationary28-frame attempt at left column; no walking departure, left side clipped. |
| [lobby/occluder-behind](../harness-22/lobby/occluder-behind-sheet.png) | [21](../harness-21/lobby/occluder-behind-sheet.png) | 82 | behavior, facing, path, visual | L2, L5, L6 | Left run reverses right beside reception; final rear-diagonal stance stable but route doubles back. |
| [lobby/occluder-back](../harness-22/lobby/occluder-back-sheet.png) | [21](../harness-21/lobby/occluder-back-sheet.png) | 103 | behavior, facing, path, height, visual | L2, L4, L5, L6 | Right run reverses into leftward return across rug; final bent diagonal stance persists through six stop frames. |
| [lobby/narrow-gap](../harness-22/lobby/narrow-gap-sheet.png) | [21](../harness-21/lobby/narrow-gap-sheet.png) | 237 | behavior, facing, path, height, visual, goal22 behavior | L1, L2, L4, L5, L6 | Rightward detour reverses left before toward approach across rug. Boots intact; final side-back stance stable. |
| [lobby/unreachable](../harness-22/lobby/unreachable-sheet.png) | [21](../harness-21/lobby/unreachable-sheet.png) | 60 | behavior, facing, path, height, visual, goal22 behavior | L1, L2, L4, L5, L6 | Initial side motion reverses, then away approach to stairs and side-back settle; extra heading changes on short approach. |
| [lobby/object](../harness-22/lobby/object-sheet.png) | [21](../harness-21/lobby/object-sheet.png) | 209 | facing, path, height, visual, goal22 behavior | L1, L2, L4, L5, L6 | Toward then left then away route to column; dense heading changes and bent gait transitions, final rear stance partially screen-clipped. |
| [outside/near-left](../harness-22/outside/near-left-sheet.png) | [21](../harness-21/outside/near-left-sheet.png) | 144 | behavior, facing, path, height | L2, L4, L6 | Full leftward traversal with intact feet and straight settled pose; brief terminal turns remain visible and are retained in the numeric facing/path gates. |
| [outside/near-right](../harness-22/outside/near-right-sheet.png) | [21](../harness-21/outside/near-right-sheet.png) | 161 | behavior, facing, path, height | L2, L4, L6 | All images viewed: full rightward traversal with intact boots and stable upright side settle; slight terminal heading changes and boundary clipping retained in numeric gates. |
| [outside/deepest](../harness-22/outside/deepest-sheet.png) | [21](../harness-21/outside/deepest-sheet.png) | 320 | facing, path, height, visual | L2, L4, L5, L6 | All six review images viewed: large left-right-left detour before depth traverse; crossing 104 switches net over leg abruptly; final body occluded by shelter post. |
| [outside/far-left](../harness-22/outside/far-left-sheet.png) | [21](../harness-21/outside/far-left-sheet.png) | 38 | behavior, facing, path, visual, goal22 behavior | L1, L2, L5, L6 | All images viewed: short truncated approach behind bus with most silhouette hidden; final bent-knee diagonal pose. |
| [outside/far-right](../harness-22/outside/far-right-sheet.png) | [21](../harness-21/outside/far-right-sheet.png) | 276 | behavior, facing, path, height, visual | L2, L4, L5, L6 | All five images viewed: toward then right then away detour; abrupt full-body bus occlusion at 257 and mostly hidden final rest. |
| [outside/diagonal-away](../harness-22/outside/diagonal-away-sheet.png) | [21](../harness-21/outside/diagonal-away-sheet.png) | 167 | behavior, facing, path, height, visual | L2, L4, L5, L6 | All four review images viewed: right run then away approach disappears abruptly behind bus at 148 while boots remain below chassis; final silhouette mostly occluded. |
| [outside/diagonal-toward](../harness-22/outside/diagonal-toward-sheet.png) | [21](../harness-21/outside/diagonal-toward-sheet.png) | 280 | behavior, facing, path, height, visual | L2, L4, L5, L6 | All four images viewed: multiple right/toward/right cycle changes before reaching opposite side; boots intact, final upright pose clipped at screen edge. |
| [outside/occluder-behind](../harness-22/outside/occluder-behind-sheet.png) | [21](../harness-21/outside/occluder-behind-sheet.png) | 234 | behavior, facing, path, height, visual, goal22 behavior | L1, L2, L4, L5, L6 | All six images viewed: broad left-right detour to shelter; net overlaps boot at crossing, eventual front stop behind bench hides all feet. |
| [outside/occluder-back](../harness-22/outside/occluder-back-sheet.png) | [21](../harness-21/outside/occluder-back-sheet.png) | 28 | behavior, facing, height, visual, goal22 behavior | L1, L2, L4, L5, L6 | All images viewed: stationary behind seated character and bench, no requested return crossing; feet hidden for entire capture. |
| [outside/narrow-gap](../harness-22/outside/narrow-gap-sheet.png) | [21](../harness-21/outside/narrow-gap-sheet.png) | 95 | behavior, facing, path, height, visual | L2, L4, L5, L6 | All images viewed: constrained shelter traversal changes right/toward/right/left before stopping behind bench; final boots occluded and route reverses laterally. |
| [outside/unreachable](../harness-22/outside/unreachable-sheet.png) | [21](../harness-21/outside/unreachable-sheet.png) | 111 | behavior, facing, path, height, visual | L2, L4, L5, L6 | All four images viewed: multiple direction changes behind shelter, feet obscured for most of approach; final back rest upright, partly hidden by post. |
| [outside/object](../harness-22/outside/object-sheet.png) | [21](../harness-21/outside/object-sheet.png) | 204 | behavior, facing, path, height, lock, visual, goal22 behavior | L1, L2, L4, L5, L6 | All six images viewed: oscillating approach inside shelter; extended invisible feet behind net and bench, final upright side pose still hides lower legs. |
| [outside/exit-depot_doors](../harness-22/outside/exit-depot_doors-sheet.png) | [21](../harness-21/outside/exit-depot_doors-sheet.png) | 331 | behavior, facing, path, height, visual, goal22 behavior | L3, L2, L4, L5, L6 | Long shelter detour and final left/away correction stops outside doors without transition; abrupt post/bus crossings136-149 and289-291. |
| [outside/exit-edge-left](../harness-22/outside/exit-edge-left-sheet.png) | [21](../harness-21/outside/exit-edge-left-sheet.png) | 264 | facing, path, height, visual, goal22 behavior | L3, L2, L4, L5, L6 | Exit transitions to road; destination walk travels through tree occlusion and along raised-looking roots. Final feet hidden by foreground traps; height tracking cannot recover full silhouette. |
| [outside/exit-edge-left-1](../harness-22/outside/exit-edge-left-1-sheet.png) | [21](../harness-21/outside/exit-edge-left-1-sheet.png) | 265 | facing, path, height, visual, goal22 behavior | L3, L2, L4, L5, L6 | Transition reaches road, then destination traversal passes behind tree and root shapes; final feet hidden by traps. Full silhouette is not measurable during occlusion. |
| [outside/exit-edge-right](../harness-22/outside/exit-edge-right-sheet.png) | [21](../harness-21/outside/exit-edge-right-sheet.png) | 349 | behavior, facing, path, height, visual, goal22 behavior | L3, L2, L4, L5, L6 | Long shelter detour before right exit transition; crossing136-149 has abrupt post occlusion, foot overlap on nets. Destination settles in bent diagonal pose. |
| [outside/exit-far](../harness-22/outside/exit-far-sheet.png) | [21](../harness-21/outside/exit-far-sheet.png) | 148 | behavior, facing, path, height, visual, goal22 behavior | L3, L2, L4, L5, L6 | Visible left-right reversal behind shelter before away exit; transitions to road and stands rear-facing. Initial feet heavily occluded by Kat and bench. |
| [pier/near-left](../harness-22/pier/near-left-sheet.png) | [21](../harness-21/pier/near-left-sheet.png) | 148 | behavior, facing, path, height, visual, goal22 behavior | L1, L2, L4, L5, L6 | Repeated toward/away reversals form a long loop; boots overlap the foreground post at entry, head clips the HUD, and final diagonal pose remains bent-kneed. |
| [pier/near-right](../harness-22/pier/near-right-sheet.png) | [21](../harness-21/pier/near-right-sheet.png) | 42 | behavior, facing, path, height, visual, goal22 behavior | L1, L2, L4, L5, L6 | Short toward-camera walk stays by the left edge instead of traversing right; head and left body are clipped by viewport/HUD. |
| [pier/deepest](../harness-22/pier/deepest-sheet.png) | [21](../harness-21/pier/deepest-sheet.png) | 57 | behavior, facing, path, height, visual, goal22 behavior | L1, L2, L4, L5, L6 | Toward/away reversal before a short stop over the planks; upper silhouette clips the HUD and final boots straddle a painted board gap. |
| [pier/far-left](../harness-22/pier/far-left-sheet.png) | [21](../harness-21/pier/far-left-sheet.png) | 28 | behavior, facing, path, visual, goal22 behavior | L1, L2, L5, L6 | No traversal: stationary standing pose at the far-right boundary throughout the clip. |
| [pier/far-right](../harness-22/pier/far-right-sheet.png) | [21](../harness-21/pier/far-right-sheet.png) | 83 | behavior, facing, path, visual, goal22 behavior | L1, L2, L5, L6 | All images viewed: approach remains on left branch, changes toward to away-right before truncation; upright rest but feet over visible board gap. |
| [pier/diagonal-away](../harness-22/pier/diagonal-away-sheet.png) | [21](../harness-21/pier/diagonal-away-sheet.png) | 42 | behavior, facing, path, height, visual, goal22 behavior | L1, L2, L4, L5, L6 | All images viewed: short toward walk at left boundary instead of depth traverse; upright front stop clips under HUD and screen edge. |
| [pier/diagonal-toward](../harness-22/pier/diagonal-toward-sheet.png) | [21](../harness-21/pier/diagonal-toward-sheet.png) | 82 | behavior, facing, path, visual, goal22 behavior | L1, L2, L5, L6 | All images viewed: truncated right-toward-right approach; final bent-knee diagonal rest straddles visible water gap. |
| [pier/occluder-behind](../harness-22/pier/occluder-behind-sheet.png) | [21](../harness-21/pier/occluder-behind-sheet.png) | 35 | behavior, facing, path, height, visual, goal22 behavior | L1, L2, L4, L5, L6 | Short away approach terminates near central post, character enormous relative to shelter and head under HUD. Soles intact. |
| [pier/occluder-back](../harness-22/pier/occluder-back-sheet.png) | [21](../harness-21/pier/occluder-back-sheet.png) | 37 | behavior, facing, path, height, visual | L2, L4, L5, L6 | All images viewed: brief right then toward approach ends before broad return crossing; stable front rest and intact boots, HUD clips hair. |
| [pier/narrow-gap](../harness-22/pier/narrow-gap-sheet.png) | [21](../harness-21/pier/narrow-gap-sheet.png) | 39 | behavior, height, visual | L4, L5, L6 | All images viewed: short left-away-left approach truncates beside net; final upright side pose places boot on board-gap edge and head under HUD. |
| [pier/unreachable](../harness-22/pier/unreachable-sheet.png) | [21](../harness-21/pier/unreachable-sheet.png) | 28 | behavior, facing, path, height, visual, goal22 behavior | L1, L2, L4, L5, L6 | No real departure, only rear-facing settle next to crate; left boot occluded by crate and head reaches HUD. |
| [pier/object](../harness-22/pier/object-sheet.png) | [21](../harness-21/pier/object-sheet.png) | 38 | behavior, path, height, lock, visual, goal22 behavior | L1, L2, L4, L5, L6 | All four images viewed: short toward-left-away-left sequence before upright stop; crossing boots intact but head hidden under HUD and repeated cycle changes persist. |
| [pier/exit-edge-left](../harness-22/pier/exit-edge-left-sheet.png) | [21](../harness-21/pier/exit-edge-left-sheet.png) | 35 | behavior, path, height, visual, goal22 behavior | L3, L2, L4, L5, L6 | All four images viewed: very short toward-left approach stops near shelter instead of exit; soles straddle dark board gap, head under HUD; crossing boots remain intact. |
| [pier/exit-edge-right](../harness-22/pier/exit-edge-right-sheet.png) | [21](../harness-21/pier/exit-edge-right-sheet.png) | 195 | floor, behavior, facing, path, height, visual, goal22 behavior | L3, L2, L4, L5, L6 | All five images viewed: loop/reversal before edge, destination transition then return to pier; final giant back pose clipped under HUD, boots intact. |
| [road/near-left](../harness-22/road/near-left-sheet.png) | [21](../harness-21/road/near-left-sheet.png) | 321 | facing, path, height, visual, goal22 behavior | L1, L2, L4, L5, L6 | Viewed full 321-frame route, crossing 255-257, all three feet sheets and settle 315-320: long leftward traversal behind traps and trees then away-left then toward reversal. Boot fragments at tree/root crossing; final body mostly hidden behind left tree, not clean arrival. |
| [road/near-right](../harness-22/road/near-right-sheet.png) | [21](../harness-21/road/near-right-sheet.png) | 28 | behavior, facing, height, visual, goal22 behavior | L1, L2, L4, L5, L6 | All sheets viewed: 28-frame stationary capture behind left tree; no requested walk, final stance largely occluded. |
| [road/deepest](../harness-22/road/deepest-sheet.png) | [21](../harness-21/road/deepest-sheet.png) | 144 | behavior, facing, path, height, visual | L2, L4, L5, L6 | Viewed whole arc and feet/settle: right then reverses away-left then long away run; boot toe clipped by flat gutter mask at 38-44, tiny final away stand stationary 138-143. |
| [road/far-left](../harness-22/road/far-left-sheet.png) | [21](../harness-21/road/far-left-sheet.png) | 411 | facing, path, height, freeze, visual | L2, L4, L5, L6 | Viewed full 411-frame arc, crossing 48-50, all five feet sheets and settle 405-410: prolonged hidden tree departure, left-away/side toggles across road, final entirely behind left tree except toe. Excessive route, no readable arrival; stop steady. |
| [road/far-right](../harness-22/road/far-right-sheet.png) | [21](../harness-21/road/far-right-sheet.png) | 473 | facing, path, height, freeze, visual | L2, L4, L5, L6 | Viewed whole arc, all feet and stop sheets. Rightward crossing repeatedly changes side/away cycles; 467-472 entirely hidden behind right tree, so final stance cannot be verified. |
| [road/diagonal-away](../harness-22/road/diagonal-away-sheet.png) | [21](../harness-21/road/diagonal-away-sheet.png) | 28 | behavior, facing, height, visual, goal22 behavior | L1, L2, L4, L5, L6 | Viewed full 28-frame sheet, feet and settle: no traversal, character remains mostly hidden behind left tree at starting point throughout; stationary stop 22-27. |
| [road/diagonal-toward](../harness-22/road/diagonal-toward-sheet.png) | [21](../harness-21/road/diagonal-toward-sheet.png) | 424 | behavior, facing, path, height, visual | L2, L4, L5, L6 | Viewed full 424-frame route, all four feet sheets and final 418-423: long hidden departure behind left tree, rightward away-diagonal traversal then away correction then right again, ends almost entirely behind right tree. Excessive detour and poor visible arrival, stop stable. |
| [road/occluder-behind](../harness-22/road/occluder-behind-sheet.png) | [21](../harness-21/road/occluder-behind-sheet.png) | 79 | behavior, facing, path, height, visual, goal22 behavior | L1, L2, L4, L5, L6 | All sheets viewed: right departure then left and away at same trap area; feet hidden throughout, final away stance 73-78 stable but lower body unverifiable. |
| [road/occluder-back](../harness-22/road/occluder-back-sheet.png) | [21](../harness-21/road/occluder-back-sheet.png) | 146 | behavior, facing, path, height, visual | L2, L4, L5, L6 | Whole arc, all feet, crossing and stop viewed. Right departure reverses left then toward. Flat root layer cuts boots into fragments at 71-84; final 140-145 legs hidden behind traps. |
| [road/narrow-gap](../harness-22/road/narrow-gap-sheet.png) | [21](../harness-21/road/narrow-gap-sheet.png) | 191 | behavior, facing, path, height, visual | L2, L4, L5, L6 | Viewed whole arc, crossing, all feet and stop. Leftward departure reverses toward then left around roots; boot fragments at 104-128 and stationary lower leg cut at 185-190. |
| [road/unreachable](../harness-22/road/unreachable-sheet.png) | [21](../harness-21/road/unreachable-sheet.png) | 61 | behavior, facing, height, visual, goal22 behavior | L1, L2, L4, L5, L6 | All sheets viewed: away then left then away, extra correction corner; final 55-60 stable short away rest with apparent ground gap. |
| [road/object](../harness-22/road/object-sheet.png) | [21](../harness-21/road/object-sheet.png) | 144 | behavior, facing, path, height, visual, goal22 behavior | L1, L2, L4, L5, L6 | All sheets viewed: leftward route changes to right at roots then toward rest. Boots disappear behind traps; final 138-143 appears perched on trap edge and is shorter front drawing. |
| [road/exit-edge-left](../harness-22/road/exit-edge-left-sheet.png) | [21](../harness-21/road/exit-edge-left-sheet.png) | 204 | facing, path, height, goal22 behavior | L3, L2, L4, L6 | Viewed entire route/transition, two feet sheets and settle: continuous leftward run behind traps/tree, single destination transition, leftward walk-in then stable side stand 198-203. Occlusion follows foreground silhouettes; numeric floor/size separate. |
| [road/exit-edge-left-1](../harness-22/road/exit-edge-left-1-sheet.png) | [21](../harness-21/road/exit-edge-left-1-sheet.png) | 203 | facing, path, height, goal22 behavior | L3, L2, L4, L6 | Viewed complete route/transition, both feet sheets and stop 197-202: continuous left run behind traps and tree; single transition to bus exterior, left walk-in and stationary side stand. No visible reversal. |
| [road/exit-edge-left-2](../harness-22/road/exit-edge-left-2-sheet.png) | [21](../harness-21/road/exit-edge-left-2-sheet.png) | 203 | facing, path, height, goal22 behavior | L3, L2, L4, L6 | Viewed whole route/transition, both feet sheets and final 197-202: uninterrupted leftward traversal behind foreground traps/tree, one visible bus-exterior transition, left walk-in and steady side stand. No reversal apparent. |
| [road/exit-edge-right](../harness-22/road/exit-edge-right-sheet.png) | [21](../harness-21/road/exit-edge-right-sheet.png) | 280 | facing, path, height, visual, goal22 behavior | L3, L2, L4, L5, L6 | Viewed full route/transition, three feet sheets and settle 274-279: right then away then right behind tree; single transition but destination walk-in toggles right/toward repeatedly before final front stand. Visible unnecessary doglegs. |
| [road/exit-far](../harness-22/road/exit-far-sheet.png) | [21](../harness-21/road/exit-far-sheet.png) | 62 | behavior, facing, height, visual, goal22 behavior | L3, L2, L4, L5, L6 | Viewed full arc and feet/stop: away then right then away, stops deep on road at 56-61 without any scene transition; very small distant sprite, stationary final. |
| [square/near-left](../harness-22/square/near-left-sheet.png) | [21](../harness-21/square/near-left-sheet.png) | 117 | behavior, facing, height, visual | L2, L4, L5, L6 | Viewed whole arc and feet/settle sheets: leftward walk changes away then side then toward-left repeatedly; final body clipped at left screen edge, stationary settle 111-116. |
| [square/near-right](../harness-22/square/near-right-sheet.png) | [21](../harness-21/square/near-right-sheet.png) | 117 | behavior, facing, path, height, visual | L2, L4, L5, L6 | All sheets viewed: crosses right in front of fountain with late away then right switch; final 111-116 clipped by right viewport edge. |
| [square/deepest](../harness-22/square/deepest-sheet.png) | [21](../harness-21/square/deepest-sheet.png) | 117 | behavior, facing, path, height, visual | L2, L4, L5, L6 | Left then away route changes right again; building-colored pixels erase large body sections at lamp crossing93-94. Final stance stable. |
| [square/far-left](../harness-22/square/far-left-sheet.png) | [21](../harness-21/square/far-left-sheet.png) | 144 | behavior, facing, path, height | L2, L4, L6 | Viewed whole route, both feet sheets and settle 138-143: leftward traversal behind fountain, left then away into final stand; fountain and lamp hide limbs consistently, no visible reversal or stop drift. Numeric path and arrival judged separately. |
| [square/far-right](../harness-22/square/far-right-sheet.png) | [21](../harness-21/square/far-right-sheet.png) | 190 | behavior, facing, path, height, visual | L2, L4, L5, L6 | Viewed whole arc, both feet sheets, crossing 37-39 and settle 184-189: rightward approach reverses left around fountain then returns right; repeated cycle changes before stable front settle. Fountain hides legs. |
| [square/diagonal-away](../harness-22/square/diagonal-away-sheet.png) | [21](../harness-21/square/diagonal-away-sheet.png) | 192 | behavior, facing, path, height, visual | L2, L4, L5, L6 | Viewed whole route and all feet/crossing/settle sheets: left then right then away then left then right around fountain; multiple reversals, stationary away settle 186-191. Crossing 59-61 pole occlusion appears continuous. |
| [square/diagonal-toward](../harness-22/square/diagonal-toward-sheet.png) | [21](../harness-21/square/diagonal-toward-sheet.png) | 205 | behavior, facing, path, height, visual | L2, L4, L5, L6 | Viewed whole route, feet and settle: initial leftward motion then long toward-left then reverses right; away cycle appears within rightward leg, final right edge clipping at stable 199-204 settle. |
| [square/occluder-behind](../harness-22/square/occluder-behind-sheet.png) | [21](../harness-21/square/occluder-behind-sheet.png) | 235 | behavior, facing, path, height, visual | L2, L4, L5, L6 | All six sheets viewed. Right-left-away-toward-away-toward-left reversals; fountain clips boot at 92 before front turn 93. Final 229-234 feet fully hidden by fountain. |
| [square/occluder-back](../harness-22/square/occluder-back-sheet.png) | [21](../harness-21/square/occluder-back-sheet.png) | 255 | behavior, facing, path, height, visual, goal22 behavior | L1, L2, L4, L5, L6 | Whole arc, all feet/crossings/stop viewed. Right-left-toward-away-right-toward-left loop around right lamp. Crossing 92/93,124/125,179/180 snaps rendering; final 249-254 stable front rest. |
| [square/narrow-gap](../harness-22/square/narrow-gap-sheet.png) | [21](../harness-21/square/narrow-gap-sheet.png) | 61 | behavior, facing, path, height, visual | L2, L4, L5, L6 | Viewed whole arc and feet/settle: left then reverses right into lamp, feet cross clipped building mask boundary 25-37; final stand partly erased by facade and pole at 55-60. |
| [square/unreachable](../harness-22/square/unreachable-sheet.png) | [21](../harness-21/square/unreachable-sheet.png) | 96 | behavior, facing, path, height, visual | L2, L4, L5, L6 | Walk loops right around lamp then returns behind fountain; abrupt lamp crossing59-61 and fully hidden lower body at settle. |
| [square/object](../harness-22/square/object-sheet.png) | [21](../harness-21/square/object-sheet.png) | 161 | behavior, facing, path, height, visual, goal22 behavior | L1, L2, L4, L5, L6 | Whole arc, feet, crossings and stop viewed. Left-right-left-away-left loop; building mask at 136 cuts head/torso into fragments, releases at 137. Final 155-160 crouched floating stance. |
| [square/exit-edge-left](../harness-22/square/exit-edge-left-sheet.png) | [21](../harness-21/square/exit-edge-left-sheet.png) | 250 | behavior, facing, path, height, visual, goal22 behavior | L3, L2, L4, L5, L6 | Exit transition occurs after left-toward-left approach; destination walk repeats direction changes and settles bent-kneed. |
| [stepped-street/near-left](../harness-22/stepped-street/near-left-sheet.png) | [21](../harness-21/stepped-street/near-left-sheet.png) | 82 | behavior, facing, path, visual, goal22 behavior | L1, L2, L5, L6 | All sheets viewed. Left-toward-left path, steady final76-81 bent stance with visible gap over ground; stairs treated as flat. |
| [stepped-street/near-right](../harness-22/stepped-street/near-right-sheet.png) | [21](../harness-21/stepped-street/near-right-sheet.png) | 28 | behavior, facing, visual, goal22 behavior | L1, L2, L5, L6 | All sheets viewed. Stationary28 frames at left foreground; no requested walk. Stable side rest22-27. |
| [stepped-street/deepest](../harness-22/stepped-street/deepest-sheet.png) | [21](../harness-21/stepped-street/deepest-sheet.png) | 78 | behavior, facing, path, height, visual, goal22 behavior | L1, L2, L4, L5, L6 | All sheets viewed. Right then away native run without reversal; boots traverse risers as flat floor and away rest 72-77 appears floating, canonical shorter drawing. |
| [stepped-street/far-left](../harness-22/stepped-street/far-left-sheet.png) | [21](../harness-21/stepped-street/far-left-sheet.png) | 73 | behavior, facing | L2, L6 | All sheets viewed. Continuous left run across landing, no reversal or fragment observed, stable side rest67-72 by doorway. Numeric floor and path checks remain separate. |
| [stepped-street/far-right](../harness-22/stepped-street/far-right-sheet.png) | [21](../harness-21/stepped-street/far-right-sheet.png) | 168 | behavior, facing, path, height, visual, goal22 behavior | L1, L2, L4, L5, L6 | All sheets viewed. Left then toward down left boundary; boardwalk mask cuts head/hips at92 and pops clear93; final162-167 bent rest at left foreground far from right destination. |
| [stepped-street/diagonal-away](../harness-22/stepped-street/diagonal-away-sheet.png) | [21](../harness-21/stepped-street/diagonal-away-sheet.png) | 28 | behavior, facing, path, height, visual, goal22 behavior | L1, L2, L4, L5, L6 | All sheets viewed. Stationary 28-frame capture, turns right into bent rest; final22-27 boots hover over buoy, no requested walk. |
| [stepped-street/diagonal-toward](../harness-22/stepped-street/diagonal-toward-sheet.png) | [21](../harness-21/stepped-street/diagonal-toward-sheet.png) | 78 | facing, path, height, visual, goal22 behavior | L1, L2, L4, L5, L6 | All sheets viewed. Right across boardwalk then away; horizontal mask strips remove knees throughout, final72-77 detached boot fragments below boardwalk. |
| [stepped-street/occluder-behind](../harness-22/stepped-street/occluder-behind-sheet.png) | [21](../harness-21/stepped-street/occluder-behind-sheet.png) | 106 | behavior, facing, path, height, visual, goal22 behavior | L1, L2, L4, L5, L6 | All sheets viewed. Left-right-toward-away-right route with reversal, final100-105 stable diagonal-back stance; riser contact unconvincing. |
| [stepped-street/occluder-back](../harness-22/stepped-street/occluder-back-sheet.png) | [21](../harness-21/stepped-street/occluder-back-sheet.png) | 82 | behavior, facing, path, visual | L2, L5, L6 | All sheets viewed. Left then right reversal crossing landing; final76-81 bent hovering stance at right house. No convincing contact with step surface. |
| [stepped-street/narrow-gap](../harness-22/stepped-street/narrow-gap-sheet.png) | [21](../harness-21/stepped-street/narrow-gap-sheet.png) | 104 | behavior, facing, path, height, visual | L2, L4, L5, L6 | All sheets viewed. Left-toward-right-toward-right corrections; building slices half torso at48 then releases49. Bent hovering rest98-103 against right wall. |
| [stepped-street/unreachable](../harness-22/stepped-street/unreachable-sheet.png) | [21](../harness-21/stepped-street/unreachable-sheet.png) | 62 | behavior, facing, height, visual | L2, L4, L5, L6 | All sheets viewed. Right-left-away loop rather than direct projection; final56-61 small away rest with gap above riser. |
| [stepped-street/object](../harness-22/stepped-street/object-sheet.png) | [21](../harness-21/stepped-street/object-sheet.png) | 103 | behavior, facing, path, height, visual, goal22 behavior | L1, L2, L4, L5, L6 | All sheets viewed. Right-left-toward-left-away corrective loop. Building releases whole body at60; final97-102 stable diagonal back rest at left doorway. |
| [stepped-street/exit-edge-left](../harness-22/stepped-street/exit-edge-left-sheet.png) | [21](../harness-21/stepped-street/exit-edge-left-sheet.png) | 144 | behavior, facing, path, height, visual, goal22 behavior | L3, L2, L4, L5, L6 | All sheets viewed: right-left-toward-left-away reversals; no exit transition, final138-143 facing away at foreground instead of exit. |
| [stepped-street/exit-edge-right](../harness-22/stepped-street/exit-edge-right-sheet.png) | [21](../harness-21/stepped-street/exit-edge-right-sheet.png) | 193 | behavior, facing, path, height, visual, goal22 behavior | L3, L2, L4, L5, L6 | All sheets viewed. Right then toward approach, one fade/transition to same-art destination; final187-192 at left edge is clipped and away rest appears floating. Stair risers traversed as plane. |
| [stepped-street/exit-far](../harness-22/stepped-street/exit-far-sheet.png) | [21](../harness-21/stepped-street/exit-far-sheet.png) | 57 | behavior, facing, path, height, visual, goal22 behavior | L3, L2, L4, L5, L6 | All sheets viewed. Right then away; stops51-56 midway up steps without exit transition, small floating away rest. |

## Ground-space path lengths

These columns retain both optima in metres. The octilinear value is the canonical norm infimum described in L6, not a certified finite depth-varying stride optimum. A short truncated walk is not an arrival pass.

| Walk | Actual | Octilinear optimum | Euclidean optimum | Actual/octilinear |
|---|---:|---:|---:|---:|
| alley/near-left | 7.8332 | 4.9619 | 4.8848 | 1.5787 |
| alley/near-right | 9.7888 | 4.9050 | 4.8760 | 1.9957 |
| alley/deepest | 9.3911 | 6.5010 | 6.0378 | 1.4446 |
| alley/far-left | 8.0643 | 6.7231 | 6.3249 | 1.1995 |
| alley/far-right | 12.4087 | 6.7509 | 6.3402 | 1.8381 |
| alley/diagonal-away | 8.0621 | 4.8314 | 4.7218 | 1.6687 |
| alley/diagonal-toward | 12.4973 | 6.9333 | 6.5105 | 1.8025 |
| alley/occluder-behind | 0.0000 | 0.0987 | 0.0913 | 0.0000 |
| alley/occluder-back | 0.0000 | 0.0987 | 0.0913 | 0.0000 |
| alley/narrow-gap | 1.3222 | 2.5544 | 2.4986 | 0.5176 |
| alley/unreachable | 3.0456 | 1.1518 | 1.0729 | 2.6441 |
| alley/object | 3.5712 | 4.2496 | 3.9460 | 0.8404 |
| alley/exit-far | 9.5485 | 7.0533 | 6.7623 | 1.3538 |
| alley/exit-near | 10.5505 | 2.0870 | 2.0503 | 5.0553 |
| church/near-left | 0.5321 | 1.0946 | 1.0849 | 0.4861 |
| church/near-right | 1.1964 | 1.1432 | 1.1022 | 1.0466 |
| church/deepest | 0.0000 | 1.5659 | 1.4651 | 0.0000 |
| church/far-left | 0.5020 | 0.9839 | 0.9265 | 0.5102 |
| church/far-right | 0.5034 | 0.9797 | 0.9401 | 0.5138 |
| church/diagonal-away | 2.1446 | 1.3584 | 1.3131 | 1.5788 |
| church/diagonal-toward | 3.0072 | 1.2719 | 1.1882 | 2.3644 |
| church/occluder-behind | 0.0000 | 0.4620 | 0.4321 | 0.0000 |
| church/occluder-back | 1.0014 | 0.2953 | 0.2735 | 3.3911 |
| church/narrow-gap | 3.0307 | 0.6540 | 0.6259 | 4.6341 |
| church/unreachable | 0.0000 | 0.9408 | 0.9399 | 0.0000 |
| church/object | 3.5091 | 1.0911 | 1.0083 | 3.2162 |
| grocery/near-left | 5.7467 | 3.1992 | 3.0167 | 1.7963 |
| grocery/near-right | 3.9714 | 3.1598 | 3.0050 | 1.2569 |
| grocery/deepest | 6.1408 | 8.7152 | 8.4529 | 0.7046 |
| grocery/far-left | 0.0000 | 7.7082 | 7.4891 | 0.0000 |
| grocery/far-right | 10.9669 | 7.9681 | 7.7662 | 1.3763 |
| grocery/diagonal-away | 14.7439 | 8.1392 | 7.9091 | 1.8115 |
| grocery/diagonal-toward | 4.8355 | 3.2480 | 3.0050 | 1.4888 |
| grocery/occluder-behind | 3.7708 | 7.7500 | 7.5286 | 0.4866 |
| grocery/occluder-back | 20.2694 | 7.7500 | 7.5286 | 2.6154 |
| grocery/narrow-gap | 2.1743 | 1.1267 | 1.0543 | 1.9297 |
| grocery/unreachable | 31.2998 | 2.0475 | 1.9623 | 15.2865 |
| grocery/object | 4.9570 | 2.2481 | 2.0888 | 2.2050 |
| inside/near-left | 7.0845 | 6.9691 | 6.9439 | 1.0166 |
| inside/near-right | 7.3394 | 6.9252 | 6.8878 | 1.0598 |
| inside/deepest | 9.3962 | 3.5318 | 3.3017 | 2.6605 |
| inside/far-left | 11.0142 | 8.2785 | 7.8737 | 1.3305 |
| inside/far-right | 8.5149 | 8.3443 | 7.9316 | 1.0204 |
| inside/diagonal-away | 8.1181 | 8.3810 | 7.9682 | 0.9686 |
| inside/diagonal-toward | 7.4770 | 6.8885 | 6.8511 | 1.0854 |
| inside/occluder-behind | 2.5821 | 0.9775 | 0.9153 | 2.6415 |
| inside/occluder-back | 0.0000 | 0.8232 | 0.7688 | 0.0000 |
| inside/narrow-gap | 0.0000 | 1.2982 | 1.2037 | 0.0000 |
| inside/unreachable | 0.8045 | 0.7585 | 0.7405 | 1.0606 |
| inside/object | 4.8103 | 3.6363 | 3.4453 | 1.3229 |
| inside/exit-bus_platform | 3.1801 | 1.9312 | 1.8627 | 1.6466 |
| lobby/near-left | 14.2763 | 9.6207 | 9.3035 | 1.4839 |
| lobby/near-right | 12.2015 | 9.6451 | 9.3254 | 1.2650 |
| lobby/deepest | 1.9470 | 3.5375 | 3.3442 | 0.5504 |
| lobby/far-left | 0.0000 | 14.2599 | 13.9100 | 0.0000 |
| lobby/far-right | 0.0000 | 14.4155 | 14.0612 | 0.0000 |
| lobby/diagonal-away | 23.2081 | 13.1813 | 12.8188 | 1.7607 |
| lobby/diagonal-toward | 0.0000 | 10.8792 | 10.5678 | 0.0000 |
| lobby/occluder-behind | 2.9284 | 0.9688 | 0.8979 | 3.0229 |
| lobby/occluder-back | 4.0733 | 0.8374 | 0.7762 | 4.8642 |
| lobby/narrow-gap | 13.8988 | 2.0930 | 2.0350 | 6.6407 |
| lobby/unreachable | 2.7431 | 1.1975 | 1.1702 | 2.2908 |
| lobby/object | 10.4265 | 6.6913 | 6.3029 | 1.5582 |
| outside/near-left | 7.5075 | 7.0015 | 6.9514 | 1.0723 |
| outside/near-right | 8.0606 | 7.0015 | 6.9514 | 1.1513 |
| outside/deepest | 23.7134 | 7.2135 | 6.9277 | 3.2874 |
| outside/far-left | 0.7571 | 11.8509 | 11.4937 | 0.0639 |
| outside/far-right | 19.5728 | 11.7411 | 11.4677 | 1.6670 |
| outside/diagonal-away | 9.3515 | 8.7852 | 8.4185 | 1.0645 |
| outside/diagonal-toward | 19.0492 | 11.0551 | 10.6921 | 1.7231 |
| outside/occluder-behind | 16.8081 | 6.4017 | 6.1086 | 2.6256 |
| outside/occluder-back | 0.0000 | 6.3659 | 6.0927 | 0.0000 |
| outside/narrow-gap | 7.4575 | 2.7409 | 2.6205 | 2.7208 |
| outside/unreachable | 8.7215 | 4.6212 | 4.3948 | 1.8873 |
| outside/object | 14.1460 | 2.6328 | 2.4423 | 5.3730 |
| outside/exit-depot_doors | 23.1462 | 3.7253 | 3.6074 | 6.2133 |
| outside/exit-edge-left | 12.8604 | 6.8796 | 6.6452 | 1.8694 |
| outside/exit-edge-left-1 | 12.8800 | 6.2287 | 5.9722 | 2.0679 |
| outside/exit-edge-right | 21.9205 | 6.3084 | 6.0310 | 3.4748 |
| outside/exit-far | 10.4690 | 4.6621 | 4.4127 | 2.2456 |
| pier/near-left | 8.7731 | 4.0982 | 3.9004 | 2.1407 |
| pier/near-right | 1.5764 | 4.0982 | 3.9004 | 0.3847 |
| pier/deepest | 1.8532 | 6.1879 | 6.0625 | 0.2995 |
| pier/far-left | 0.0000 | 10.2599 | 9.7963 | 0.0000 |
| pier/far-right | 7.4044 | 9.9360 | 9.4816 | 0.7452 |
| pier/diagonal-away | 1.5764 | 6.1064 | 5.7042 | 0.2582 |
| pier/diagonal-toward | 7.9612 | 7.9278 | 7.6777 | 1.0042 |
| pier/occluder-behind | 1.1504 | 0.8926 | 0.8279 | 1.2888 |
| pier/occluder-back | 0.8321 | 0.4692 | 0.4337 | 1.7734 |
| pier/narrow-gap | 0.5176 | 0.5001 | 0.4626 | 1.0348 |
| pier/unreachable | 0.0000 | 0.7612 | 0.7402 | 0.0000 |
| pier/object | 0.9985 | 6.7337 | 6.5552 | 0.1483 |
| pier/exit-edge-left | 0.7690 | 2.7688 | 2.6040 | 0.2777 |
| pier/exit-edge-right | 10.6955 | 2.8461 | 2.7288 | 3.7579 |
| road/near-left | 24.7962 | 15.6862 | 14.7830 | 1.5808 |
| road/near-right | 0.0000 | 15.6862 | 14.7830 | 0.0000 |
| road/deepest | 12.2227 | 9.9955 | 9.2893 | 1.2228 |
| road/far-left | 42.4662 | 25.5126 | 24.0434 | 1.6645 |
| road/far-right | 50.7403 | 25.5126 | 24.0434 | 1.9888 |
| road/diagonal-away | 0.0000 | 21.3326 | 20.1474 | 0.0000 |
| road/diagonal-toward | 40.3400 | 19.8663 | 18.6790 | 2.0306 |
| road/occluder-behind | 4.8198 | 3.1522 | 2.9690 | 1.5290 |
| road/occluder-back | 10.3615 | 3.1522 | 2.9690 | 3.2871 |
| road/narrow-gap | 14.4075 | 4.6011 | 4.3155 | 3.1313 |
| road/unreachable | 6.7645 | 7.1898 | 7.1677 | 0.9408 |
| road/object | 10.7068 | 9.5310 | 8.8840 | 1.1234 |
| road/exit-edge-left | 12.9793 | 9.3817 | 8.8585 | 1.3835 |
| road/exit-edge-left-1 | 12.9495 | 6.4203 | 6.0568 | 2.0170 |
| road/exit-edge-left-2 | 12.9495 | 5.2708 | 5.1842 | 2.4568 |
| road/exit-edge-right | 34.5796 | 11.4451 | 10.6750 | 3.0213 |
| road/exit-far | 6.4706 | 7.5040 | 7.2134 | 0.8623 |
| square/near-left | 5.1139 | 4.9866 | 4.9664 | 1.0255 |
| square/near-right | 5.3034 | 5.0419 | 5.0217 | 1.0519 |
| square/deepest | 6.7629 | 4.2912 | 3.9908 | 1.5760 |
| square/far-left | 8.0687 | 7.2296 | 7.0116 | 1.1161 |
| square/far-right | 10.9223 | 7.2570 | 7.1221 | 1.5051 |
| square/diagonal-away | 10.8701 | 6.2169 | 5.9642 | 1.7485 |
| square/diagonal-toward | 11.3853 | 6.9756 | 6.6535 | 1.6322 |
| square/occluder-behind | 14.7317 | 3.0395 | 2.9117 | 4.8467 |
| square/occluder-back | 15.0315 | 3.0395 | 2.9117 | 4.9453 |
| square/narrow-gap | 2.3709 | 1.2276 | 1.1979 | 1.9313 |
| square/unreachable | 4.1716 | 1.1861 | 1.1754 | 3.5172 |
| square/object | 9.8311 | 4.0332 | 3.7827 | 2.4376 |
| square/exit-edge-left | 8.8629 | 3.1733 | 3.0174 | 2.7930 |
| stepped-street/near-left | 4.0668 | 2.7283 | 2.5216 | 1.4906 |
| stepped-street/near-right | 0.0000 | 11.6849 | 10.9406 | 0.0000 |
| stepped-street/deepest | 6.9109 | 5.7331 | 5.5266 | 1.2054 |
| stepped-street/far-left | 3.0568 | 3.0340 | 2.9575 | 1.0075 |
| stepped-street/far-right | 30.1936 | 2.4967 | 2.4967 | 12.0933 |
| stepped-street/diagonal-away | 0.0000 | 11.6849 | 10.9406 | 0.0000 |
| stepped-street/diagonal-toward | 15.4946 | 2.4967 | 2.4967 | 6.2060 |
| stepped-street/occluder-behind | 6.0620 | 1.0948 | 1.0173 | 5.5369 |
| stepped-street/occluder-back | 4.1007 | 0.5745 | 0.5617 | 7.1375 |
| stepped-street/narrow-gap | 9.6956 | 2.5208 | 2.3658 | 3.8462 |
| stepped-street/unreachable | 3.7317 | 3.6252 | 3.5639 | 1.0294 |
| stepped-street/object | 8.0269 | 2.2290 | 2.1301 | 3.6012 |
| stepped-street/exit-edge-left | 10.5866 | 3.3968 | 3.2859 | 3.1166 |
| stepped-street/exit-edge-right | 9.8226 | 4.1487 | 3.9246 | 2.3676 |
| stepped-street/exit-far | 4.6876 | 3.6641 | 3.3860 | 1.2793 |

## Exact exit assessment

The unchanged checker tests one trigger and destination arrival. The extra brief-22 check also requires the logged planted anchor at the trigger frame to lie inside the requested source exit polygon, including its boundary.

| Exit walk | Trigger count | Legacy transition pass | Inside requested source region | Combined pass |
|---|---:|---|---|---|
| alley/exit-far | 1 | False | True | False |
| alley/exit-near | 1 | True | False | False |
| inside/exit-bus_platform | 1 | True | False | False |
| outside/exit-depot_doors | 0 | False | False | False |
| outside/exit-edge-left | 1 | True | False | False |
| outside/exit-edge-left-1 | 1 | True | False | False |
| outside/exit-edge-right | 1 | False | False | False |
| outside/exit-far | 1 | False | True | False |
| pier/exit-edge-left | 0 | False | False | False |
| pier/exit-edge-right | 1 | False | False | False |
| road/exit-edge-left | 1 | True | False | False |
| road/exit-edge-left-1 | 1 | True | False | False |
| road/exit-edge-left-2 | 1 | True | False | False |
| road/exit-edge-right | 1 | True | False | False |
| road/exit-far | 0 | False | False | False |
| square/exit-edge-left | 1 | False | False | False |
| stepped-street/exit-edge-left | 0 | False | False | False |
| stepped-street/exit-edge-right | 1 | False | False | False |
| stepped-street/exit-far | 0 | False | False | False |
