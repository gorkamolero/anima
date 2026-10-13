# Brief 21: footstep planning

**FAIL — implementation and 139-walk capture/review complete; Footfall acceptance is not met. 0/139 walks pass all checks.**

The motor now plans whole-leg stance sequences before playback. Simple lateral walks improve, but the planner frequently selects an early safe stop or cannot start. Target arrival regresses significantly, and the saved town replay fails its first walk on both attempts. This branch is not ready for sign-off.

## Implementation

- `footstepPlan.ts` chooses ground-space headings relative to the view ray, retaining one heading per leg and retaining the preceding heading at bends below 25°. Neighboring heading candidates are compared before playback, never stance by stance. Whole-stride corner search keeps twelve candidates and checks continuation before selecting a route. Heading changes occur only at explicit corners; corners themselves can still produce visibly abrupt cycle changes.
- CharacterMotor simulates drawn-cycle landings at depth, validates exit/settle frames and final soles, and executes the saved sequence with support locking. Stop selection searches safe whole-stride prefixes for the nearest rest sole. Lateral residual is distributed across stances with a 0.9 px bound and re-simulated. New clicks replace the plan from current support. Route points are cloned so sprite movement cannot mutate the plan.
- Important shortfall: this is safe-prefix endpoint search, not a successful target-constrained inverse solver. It does **not** reliably place the final sole within half a stride. Some diagonal standing assets still look bent-kneed. Those failures remain visible and measured.
- Floor clutter is classified by perspective height (<0.25 m) separately from obstacle status. Floor layers render behind Hermes; scattered debris is decor, nets retain obstacle footprints. Cached-mask fragment refinement measures height from the parent support baseline, preserving elevated pieces. No generative art edits were made.
- Stair regions are excluded conservatively, including regions with scale but no tread placement. Lobby removes 75 derived stair cells; stepped street removes 329. The derived stepped-street region is incomplete: visible risers remain traversable in the final frames.
- The lobby desk's existing alpha mask already covers the kick plate. Its baseline only covered x=213–302 of a 523 px-wide front. The re-derived full-front baseline and continuous footprint strip prevent approaching under that front. Reviewed lobby crops show feet in front of the desk; many routes still fail arrival.
- Exit travel now requires the specifically requested gate, preventing incidental path crossings from triggering a different exit.

No source restructuring. Small implementation commits: `6f5ccc2`, `7420208`, `c177cc9`, `d228fd2`, `15572d0`, `b096deb`, `8198aec`, `eb0b642`. Each includes the requested co-author.

## Real repair attempts and retained limitations

1. **Fixed heading and target arrival:** exterior near-left using the initial view ray produced 174 frames and 164.63 px body error. Midpoint view produced 139 frames and 110.40 px error, zero switches but only 58.24% facing agreement. Both failed: [initial](../harness-21/experiments/initial-view/outside/), [midpoint](../harness-21/experiments/midpoint-view/outside/). Subsequent whole-stride beam search, lateral correction and neighboring whole-leg candidates are installed. The [first 139-walk sweep](../harness-21/attempt-1/) contains intervening repair versions; the final sweep is fixed-source. Safe truncation remains a major limitation, not accepted arrival.
2. **Corner continuation:** greedy selection stranded later support. Beam search increased exterior deepest from a stationary plan to 19 queued stances ([before](../harness-21/probe-deepest.json), [after](../harness-21/probe-deepest-beam.json)). Final captures still show abrupt corner cycle changes and detours. Fixed direction alone does not guarantee the actual drawn trajectory matches the optimal route.
3. **Clutter masks:** whole-object classification did not remove all floor fragments. Fragment attempt 1 incorrectly flattened elevated pew pieces. Attempt 2 used parent baselines and restored those pieces ([attempt-1 JSON](../harness-21/derivation/church-layers-attempt1.json), [final overlay](../harness-21/derivation/church-layer-overlay-2.png)). Remaining defects: alley deepest net apron crosses boots around frames 50–71; church occluder-back has a pant-leg fragment at frame 9; road tree/trap masks expose disconnected body pieces; stepped-street boardwalk fragments cut legs. Two derivation attempts did not fully repair these masks.
4. **Stairs:** conservative exclusion avoids lobby stair entry in reviewed routes, but no per-tread model exists. Final stepped-street deepest, far-left, occluder-back and exit crops still cross visible risers outside the derived region. This is an unresolved segmentation/geometry limitation, not proof that stairs work.
5. **Town regression:** two actual credential-disabled replays fail the first depot left walk. [Run 91](../harness-21/town-91.json): 238.32 px body error. [Run 92](../harness-21/town-92.json): 248.29 px planted-sole error versus a 34.60 px half-stride. Same endpoint; the second measurement uses the physical sole. Neighboring fixed-leg candidates did not repair it. Each run records 2 cached calls and **0 uncached calls**; neither completes the town. Brief 20 completed 25 records with 28 cached calls. This is a regression, not a passing replay.
6. **Residual safety failures:** lock excursions remain on alley/object (32.79 px), lobby/object (25.01 px), outside/object (13.67 px), during standing/interaction transitions. Inside/exit-bus_platform has 12 off-floor destination frames. Pier/exit-edge-right fails upright-net draw order. Numeric draw-order passes elsewhere do not negate the visually observed mask slicing.

The two main planner and derivation repair sequences are documented above. Not every residual failure class has two isolated repair attempts; the complete repair loop remains open. No limitation is silently waived as a pass.

## Narration and exits

The final harness API inherited only the authorized OpenRouter provider credential; fal and other generation credentials were disabled. All ten explicit object captures contain real narrator `options` events, including previously uncached church/grocery/lobby interactions. No narration was synthesized by the harness. However, **0/10 object walks pass the complete behavior gate**: options can appear after a truncated approach or with no walk. Narration availability is fixed; successful walk-to interaction is not.

Only inside/exit-bus_platform passes exit behavior (1/19). The other final exit cases have zero travel triggers, with no recorded API error, because their approaches do not complete. Uncached destination failures were possible with fal disabled, but they are not the demonstrated cause of those final failures. No destinations were rebound or faked.

## Validation and provenance

- **448 tests / 49 files pass**, including synthetic straight, corner, corridor, near-wall and unreachable planner cases. [Tests](../harness-21/tests-final.log), [typecheck](../harness-21/typecheck-final.log), [lint](../harness-21/lint-final.log).
- `verify:art`: all 16 stored scenes pass; existing oversized vending-machine reference is an excluded-model warning. [Log](../harness-21/art-final.log).
- Eight brief-20 checker self-tests pass, including inverted floor-decal draw order. [Log](../harness-21/checker-selftests.log). Protected reviewer tools were not edited; pre-existing `walkstats.py`, `calls.md`, and untracked `AgentDebug.test.ts` changes were preserved.
- Final sweep: **139/139 captures, 11,164 frames, 139/139 visual reviews, zero timeouts**, all at 1920×1080/24 fps with 6 fps full contact sheets, flagged/random feet crops, crossings and six-frame stops reviewed. Every metric is present. [Results](../harness-21/results.json).
- All 139 capture source hashes agree and match current motor, planner, occluder service and scene source. Original brief-20 plan beats are unchanged. [Provenance](../harness-21/provenance.json).
- **0 segmentation calls / 30 allowed**, 0 generated images, 0 generated videos. Brief-21 ledger: 25 uncached narration-options calls, 1 uncached narration-resolve call; 1,577 cached calls. [Budget](../harness-21/budget.json).
- Own API 4317/game 8080 only; all game URLs muted. QA servers stopped and ports 4317/8080 verified free; owner 4410/8090 still listening and untouched. [Cleanup](../harness-21/cleanup.json). No push, merge, deploy, GitHub settings, key writes or dotenv edits.

## Measurement limits

A shorter or stationary walk can pass path length while failing arrival. Thus 96 path passes are **not** 96 successful routes. Only 3 behavior checks pass. Scale telemetry passes all walks, but pixel silhouette height passes only 41; occlusion and cycle drawing differences remain. Facing compares framewise motion with cycle direction, so a fixed cycle can still fail. Visual reviews are independent of those metrics and retain failures for stationary non-traversals, mask cuts and bent-knee stops.

The inherited narrow-gap candidates are clearance ridges, not independently proven globally narrowest passages. Nearest-reachable projection still uses runtime preview. Those remain coverage gaps. The brief-20 artifact records one visual pass (inside exit), despite the diagnosis describing zero; the table below uses the actual saved results.

## Before / after

Passing walks / applicable walks. Every bar must pass on the same walk.

| Check | Brief 20 | Brief 21 |
|---|---:|---:|
| Lock ≤1 px | 138/139 | 136/139 |
| Floor and object contacts | 138/139 | 138/139 |
| Scale | 139/139 | 139/139 |
| Pixel height | 25/139 | 41/139 |
| Facing and switches | 0/139 | 4/139 |
| Numeric draw order | 139/139 | 138/139 |
| Path and body clearance | 12/139 | 96/139 |
| Arrival / click / exit behavior | 14/139 | 3/139 |
| Zero frozen walking frames | 137/139 | 139/139 |
| Capture integrity | 139/139 | 139/139 |
| Visual review | 1/139 | 22/139 |
| Non-exit click behavior | 4/120 | 2/120 |
| Exit behavior | 10/19 | 1/19 |
| **All checks on the same walk** | **0/139** | **0/139** |

## Final scene × check

| Scene | Walks | Lock | Floor | Scale | Height | Facing | Draw order | Path | Non-exit clicks | Exits | Freeze | Visual |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| alley | 14 | 13/14 | 14/14 | 14/14 | 6/14 | 0/14 | 14/14 | 10/14 | 0/12 | 0/2 | 14/14 | 2/14 |
| church | 12 | 12/12 | 12/12 | 12/12 | 8/12 | 0/12 | 12/12 | 9/12 | 0/12 | N/A | 12/12 | 2/12 |
| grocery | 12 | 12/12 | 12/12 | 12/12 | 3/12 | 0/12 | 12/12 | 10/12 | 0/12 | N/A | 12/12 | 2/12 |
| inside | 13 | 13/13 | 12/13 | 13/13 | 6/13 | 1/13 | 13/13 | 6/13 | 0/12 | 1/1 | 13/13 | 7/13 |
| lobby | 12 | 11/12 | 12/12 | 12/12 | 2/12 | 0/12 | 12/12 | 7/12 | 0/12 | N/A | 12/12 | 1/12 |
| outside | 17 | 16/17 | 17/17 | 17/17 | 4/17 | 0/17 | 17/17 | 10/17 | 0/12 | 0/5 | 17/17 | 2/17 |
| pier | 14 | 14/14 | 14/14 | 14/14 | 5/14 | 3/14 | 13/14 | 13/14 | 0/12 | 0/2 | 14/14 | 0/14 |
| road | 17 | 17/17 | 17/17 | 17/17 | 0/17 | 0/17 | 17/17 | 13/17 | 1/12 | 0/5 | 17/17 | 3/17 |
| square | 13 | 13/13 | 13/13 | 13/13 | 2/13 | 0/13 | 13/13 | 8/13 | 1/12 | 0/1 | 13/13 | 2/13 |
| stepped-street | 15 | 15/15 | 15/15 | 15/15 | 5/15 | 0/15 | 15/15 | 10/15 | 0/12 | 0/3 | 15/15 | 1/15 |

## Walk evidence index

Each sheet has adjacent `.mp4`, walk `.json`, `-events.json`, `-check-*.json`, and `-crops/manifest.json`. Review manifests include hashes of every inspected sheet/crop. All capture media remain local. Failed checks below are not waived by named limitations.

| Walk | Frames | Failed checks | Visual observation |
|---|---:|---|---|
| [alley/near-left](../harness-21/alley/near-left-sheet.png) | 103 | behavior, facing, visual | Boots stay above flat debris, but final pose is bent-kneed; visible abrupt changes between planned cycle legs. |
| [alley/near-right](../harness-21/alley/near-right-sheet.png) | 174 | behavior, facing, path, height, visual | Boots stay above flat debris, but final pose is bent-kneed; visible abrupt changes between planned cycle legs. |
| [alley/deepest](../harness-21/alley/deepest-sheet.png) | 72 | behavior, facing, path, height, visual | Flat net apron slices boots at crossing 50 through final frame 71. |
| [alley/far-left](../harness-21/alley/far-left-sheet.png) | 104 | behavior, facing, visual | Abrupt lateral-to-away cycle change; straight standing final pose. |
| [alley/far-right](../harness-21/alley/far-right-sheet.png) | 57 | behavior, facing, height, visual | Abrupt lateral-to-away cycle change; straight standing final pose. |
| [alley/diagonal-away](../harness-21/alley/diagonal-away-sheet.png) | 117 | behavior, facing, height, visual | Rightward cycle switches to diagonal and back before straight rest. |
| [alley/diagonal-toward](../harness-21/alley/diagonal-toward-sheet.png) | 61 | behavior, facing, visual | Abrupt right-to-away-right cycle change before standing settle. |
| [alley/occluder-behind](../harness-21/alley/occluder-behind-sheet.png) | 28 | behavior, facing, height, visual | No meaningful walk: stationary or immediate entry-to-rest. Soles remain visible above floor clutter, but requested route is not executed. |
| [alley/occluder-back](../harness-21/alley/occluder-back-sheet.png) | 28 | behavior, facing, height, visual | No meaningful walk: stationary or immediate entry-to-rest. Soles remain visible above floor clutter, but requested route is not executed. |
| [alley/narrow-gap](../harness-21/alley/narrow-gap-sheet.png) | 108 | behavior, facing, path, height, visual | Abrupt toward-to-left change followed by bent-knee final pose. |
| [alley/unreachable](../harness-21/alley/unreachable-sheet.png) | 28 | behavior, facing, visual | No meaningful walk: stationary or immediate entry-to-rest. Soles remain visible above floor clutter, but requested route is not executed. |
| [alley/object](../harness-21/alley/object-sheet.png) | 55 | behavior, facing, lock, visual | Abrupt left-to-away-left change at final approach. |
| [alley/exit-far](../harness-21/alley/exit-far-sheet.png) | 52 | behavior, facing | Single consistent heading, intact boots and straight standing settle. |
| [alley/exit-near](../harness-21/alley/exit-near-sheet.png) | 107 | behavior, facing, path, height | Single consistent heading, intact boots and straight standing settle. |
| [church/near-left](../harness-21/church/near-left-sheet.png) | 28 | behavior, facing, visual | Immediate entry-to-rest with no meaningful traversal; boots visible, but requested walk is not executed. |
| [church/near-right](../harness-21/church/near-right-sheet.png) | 28 | behavior, facing, visual | Immediate entry-to-rest with no meaningful traversal; boots visible, but requested walk is not executed. |
| [church/deepest](../harness-21/church/deepest-sheet.png) | 40 | behavior, facing, height | Short consistent away walk, no reversals, straight-legged settled pose and intact boots. |
| [church/far-left](../harness-21/church/far-left-sheet.png) | 28 | behavior, facing, visual | Immediate entry-to-rest, requested route is not traversed. |
| [church/far-right](../harness-21/church/far-right-sheet.png) | 28 | behavior, facing, visual | Immediate entry-to-rest, requested route is not traversed. |
| [church/diagonal-away](../harness-21/church/diagonal-away-sheet.png) | 28 | behavior, facing, visual | Immediate entry-to-rest with no meaningful traversal; boots visible, but requested walk is not executed. |
| [church/diagonal-toward](../harness-21/church/diagonal-toward-sheet.png) | 28 | behavior, facing, visual | Immediate entry-to-rest, requested route is not traversed. |
| [church/occluder-behind](../harness-21/church/occluder-behind-sheet.png) | 28 | behavior, facing, visual | Stationary or immediate settle; requested traversal not demonstrated. |
| [church/occluder-back](../harness-21/church/occluder-back-sheet.png) | 42 | behavior, facing, path, height, visual | Crossing frame 9 shows pew-mask fragments slicing the trouser leg; short forward motion otherwise stable. |
| [church/narrow-gap](../harness-21/church/narrow-gap-sheet.png) | 42 | behavior, facing, path, height | Short straight toward-camera cycle, intact boots and straight standing settle. |
| [church/unreachable](../harness-21/church/unreachable-sheet.png) | 28 | behavior, facing, height, visual | Stationary or immediate settle; requested traversal not demonstrated. |
| [church/object](../harness-21/church/object-sheet.png) | 90 | behavior, facing, path, visual | Approach changes from toward to left then away-left abruptly; standing settle is clean but turns are not. |
| [grocery/near-left](../harness-21/grocery/near-left-sheet.png) | 82 | behavior, facing, visual | Bent-knee final pose at counter after abrupt diagonal cycle switch. |
| [grocery/near-right](../harness-21/grocery/near-right-sheet.png) | 59 | behavior, facing, height, visual | Abrupt right-to-toward cycle change before settle. |
| [grocery/deepest](../harness-21/grocery/deepest-sheet.png) | 28 | behavior, facing, height, visual | Stationary at start; no traversal. |
| [grocery/far-left](../harness-21/grocery/far-left-sheet.png) | 56 | behavior, facing, height, visual | Abrupt toward-to-left cycle change before standing settle. |
| [grocery/far-right](../harness-21/grocery/far-right-sheet.png) | 73 | behavior, facing | Consistent rightward walk and straight standing settle; boots remain intact. |
| [grocery/diagonal-away](../harness-21/grocery/diagonal-away-sheet.png) | 78 | behavior, facing, height, visual | Abrupt right-to-away change at frame 38 before standing settle. |
| [grocery/diagonal-toward](../harness-21/grocery/diagonal-toward-sheet.png) | 73 | behavior, facing | Consistent rightward motion and straight standing stop. |
| [grocery/occluder-behind](../harness-21/grocery/occluder-behind-sheet.png) | 57 | behavior, facing, path, height, visual | Abrupt cycle change at aisle corner; standing final pose and intact feet. |
| [grocery/occluder-back](../harness-21/grocery/occluder-back-sheet.png) | 122 | behavior, facing, path, height, visual | Abrupt cycle change at aisle corner; standing final pose and intact feet. |
| [grocery/narrow-gap](../harness-21/grocery/narrow-gap-sheet.png) | 28 | behavior, facing, height, visual | Stationary at start; no meaningful traversal. |
| [grocery/unreachable](../harness-21/grocery/unreachable-sheet.png) | 28 | behavior, facing, height, visual | Stationary at start; no meaningful traversal. |
| [grocery/object](../harness-21/grocery/object-sheet.png) | 57 | behavior, facing, height, visual | Repeated cycle changes and visibly bent-knee final pose. |
| [inside/near-left](../harness-21/inside/near-left-sheet.png) | 144 | behavior, facing, height | Continuous leftward traverse, clean visible feet and straight-legged rest; final turn to rest is visible without repeated correction. |
| [inside/near-right](../harness-21/inside/near-right-sheet.png) | 139 | behavior, facing, height | Continuous rightward traverse, no reversal or cycle thrashing, intact boots and straight-legged rest. |
| [inside/deepest](../harness-21/inside/deepest-sheet.png) | 73 | behavior, facing, path | Clean fixed rightward motion, intact feet, settled straight-legged pose without corrective reversals. |
| [inside/far-left](../harness-21/inside/far-left-sheet.png) | 52 | behavior, facing | Short leftward sequence and clean standing settle; endpoint failure is recorded separately. |
| [inside/far-right](../harness-21/inside/far-right-sheet.png) | 187 | behavior, facing, path, height, visual | Abrupt right-to-away cycle/body transition around frame 115; final rest is straight-legged but turn remains visibly discontinuous. |
| [inside/diagonal-away](../harness-21/inside/diagonal-away-sheet.png) | 139 | behavior, facing, height | Clean fixed rightward motion and safe standing settle; requested diagonal is not achieved numerically. |
| [inside/diagonal-toward](../harness-21/inside/diagonal-toward-sheet.png) | 139 | behavior, facing, height | Stable rightward cycle, intact soles and standing settle; numerical diagonal endpoint is separate. |
| [inside/occluder-behind](../harness-21/inside/occluder-behind-sheet.png) | 28 | behavior, facing, path, visual | No meaningful traversal: entry settles almost immediately at the start, so occlusion walk is not demonstrated. |
| [inside/occluder-back](../harness-21/inside/occluder-back-sheet.png) | 28 | behavior, facing, path, visual | Stationary throughout; required occlusion traverse does not execute. |
| [inside/narrow-gap](../harness-21/inside/narrow-gap-sheet.png) | 28 | behavior, facing, path, visual | Stationary throughout; no traversal of the narrow gap. |
| [inside/unreachable](../harness-21/inside/unreachable-sheet.png) | 35 | behavior, path, height, visual | Abrupt left-to-away switch after the short entry; clean final stance but turn remains discontinuous. |
| [inside/object](../harness-21/inside/object-sheet.png) | 28 | behavior, facing, visual | Immediate entry-to-rest, no meaningful walk-to traversal demonstrated. |
| [inside/exit-bus_platform](../harness-21/inside/exit-bus_platform-sheet.png) | 57 | floor, facing, path, height | Consistent rightward approach, authorized scene transition, standing rest at destination; no oscillation visible. |
| [lobby/near-left](../harness-21/lobby/near-left-sheet.png) | 28 | behavior, facing, height, visual | Stationary at edge of room; no requested traversal. |
| [lobby/near-right](../harness-21/lobby/near-right-sheet.png) | 197 | behavior, facing, height, visual | Long traverse with abrupt toward-right-away transitions; final standing pose clean, boots remain in front of desk footprint. |
| [lobby/deepest](../harness-21/lobby/deepest-sheet.png) | 55 | behavior, facing, path, visual | Short motion followed by abrupt facing change into rest; soles remain outside stair risers. |
| [lobby/far-left](../harness-21/lobby/far-left-sheet.png) | 28 | behavior, facing, height, visual | Stationary at edge of room; no requested traversal. |
| [lobby/far-right](../harness-21/lobby/far-right-sheet.png) | 28 | behavior, facing, path, height, visual | Stationary at edge of room; no requested traversal. |
| [lobby/diagonal-away](../harness-21/lobby/diagonal-away-sheet.png) | 198 | behavior, facing, height, visual | Long traverse with abrupt toward-right-away transitions; final standing pose clean, boots remain in front of desk footprint. |
| [lobby/diagonal-toward](../harness-21/lobby/diagonal-toward-sheet.png) | 28 | behavior, facing, path, height, visual | No traversal; clean standing pose in front of desk or stair boundary does not establish successful arrival. |
| [lobby/occluder-behind](../harness-21/lobby/occluder-behind-sheet.png) | 28 | behavior, facing, height, visual | No traversal; clean standing pose in front of desk or stair boundary does not establish successful arrival. |
| [lobby/occluder-back](../harness-21/lobby/occluder-back-sheet.png) | 64 | behavior, facing, path, height | Straight forward walk away from desk; full front stays behind character, intact feet, straight standing settle. |
| [lobby/narrow-gap](../harness-21/lobby/narrow-gap-sheet.png) | 37 | behavior, facing, path, height, visual | Short motion followed by abrupt facing change into rest; soles remain outside stair risers. |
| [lobby/unreachable](../harness-21/lobby/unreachable-sheet.png) | 28 | behavior, facing, height, visual | No traversal; clean standing pose in front of desk or stair boundary does not establish successful arrival. |
| [lobby/object](../harness-21/lobby/object-sheet.png) | 28 | behavior, facing, lock, visual | Immediate settle beside stairs, no walk-to completion demonstrated. |
| [outside/near-left](../harness-21/outside/near-left-sheet.png) | 139 | behavior, facing | Continuous left-facing traverse with no reversals; boots remain intact in the reviewed flagged/random crops and the last six frames show a straight-kneed rest. Endpoint accuracy still fails the numerical check. |
| [outside/near-right](../harness-21/outside/near-right-sheet.png) | 139 | behavior, facing | One uninterrupted right-facing traverse; no zigzags or clipped boot pixels in the flagged/random crops, followed by a stable straight-legged rest. |
| [outside/deepest](../harness-21/outside/deepest-sheet.png) | 248 | behavior, facing, path, height, visual | Left-away-right route now moves, but the switches around frames 49 and 114 visibly change the body and apparent height abruptly. Final standing pose is stable but heavily hidden by the pergola/bench. |
| [outside/far-left](../harness-21/outside/far-left-sheet.png) | 28 | behavior, facing, visual | No traversal; Hermes remains behind the bus with soles visibly protruding below its body. |
| [outside/far-right](../harness-21/outside/far-right-sheet.png) | 105 | behavior, facing, height, visual | Straight initial traverse but abrupt right-to-away change around 76; final stance straight. |
| [outside/diagonal-away](../harness-21/outside/diagonal-away-sheet.png) | 144 | behavior, facing, height, visual | Long clean right leg followed by abrupt away cycle change at 119; request still stops short. |
| [outside/diagonal-toward](../harness-21/outside/diagonal-toward-sheet.png) | 87 | behavior, facing, visual | Final toward-right rest has visibly bent knees and raised-looking heel; unacceptable held pose. |
| [outside/occluder-behind](../harness-21/outside/occluder-behind-sheet.png) | 191 | behavior, facing, path, height, visual | Abrupt left-away-right cycle transitions and bent-knee final pose behind pergola. |
| [outside/occluder-back](../harness-21/outside/occluder-back-sheet.png) | 150 | behavior, facing, height, visual | Large hidden detour and abrupt direction/cycle changes; crossing 124-126 exposes sudden silhouette change. |
| [outside/narrow-gap](../harness-21/outside/narrow-gap-sheet.png) | 28 | behavior, facing, height, visual | Stationary hidden behind post, no narrow-gap traversal. |
| [outside/unreachable](../harness-21/outside/unreachable-sheet.png) | 111 | behavior, facing, path, height, visual | Abrupt reversals across hidden bench/net route and away final turn; not a clean approach. |
| [outside/object](../harness-21/outside/object-sheet.png) | 160 | behavior, facing, path, height, lock, visual | Repeated heading changes while mostly hidden; discontinuous emergence at 136-138. |
| [outside/exit-depot_doors](../harness-21/outside/exit-depot_doors-sheet.png) | 172 | behavior, facing, path, height, visual | Long hidden detour, abrupt cycle changes and silhouette popping at crossings 136-138 and 147-149. |
| [outside/exit-edge-left](../harness-21/outside/exit-edge-left-sheet.png) | 150 | behavior, facing, height, visual | Abrupt away-to-left change after hidden start; straight standing final pose. |
| [outside/exit-edge-left-1](../harness-21/outside/exit-edge-left-1-sheet.png) | 150 | behavior, facing, height, visual | Abrupt away-to-left turn after hidden start; straight final pose. |
| [outside/exit-edge-right](../harness-21/outside/exit-edge-right-sheet.png) | 172 | behavior, facing, path, height, visual | Long hidden detour, repeated cycle changes and silhouette pops at crossings 136-138 and 147-149. |
| [outside/exit-far](../harness-21/outside/exit-far-sheet.png) | 200 | behavior, facing, path, height, visual | Abrupt right-to-away turn and long occluded pause before travel; destination settles standing. |
| [pier/near-left](../harness-21/pier/near-left-sheet.png) | 49 | behavior, facing, height, visual | Abrupt diagonal change and bent-knee final pose; oversized relative to hut. |
| [pier/near-right](../harness-21/pier/near-right-sheet.png) | 42 | behavior, height, visual | Walks toward camera instead of across pier; oversized sprite clipped by screen. |
| [pier/deepest](../harness-21/pier/deepest-sheet.png) | 35 | behavior, height, visual | Abrupt left-to-away change and oversized sprite. |
| [pier/far-left](../harness-21/pier/far-left-sheet.png) | 28 | behavior, facing, path, visual | Stationary at start; no traversal. |
| [pier/far-right](../harness-21/pier/far-right-sheet.png) | 28 | behavior, facing, visual | Stationary bent-knee pose at start. |
| [pier/diagonal-away](../harness-21/pier/diagonal-away-sheet.png) | 42 | behavior, height, visual | Toward-camera motion instead of across pier and oversized clipped sprite. |
| [pier/diagonal-toward](../harness-21/pier/diagonal-toward-sheet.png) | 28 | behavior, facing, visual | Stationary bent-knee pose. |
| [pier/occluder-behind](../harness-21/pier/occluder-behind-sheet.png) | 28 | behavior, facing, visual | No meaningful traversal; oversized sprite at start. |
| [pier/occluder-back](../harness-21/pier/occluder-back-sheet.png) | 28 | behavior, facing, height, visual | No meaningful traversal; oversized sprite at start. |
| [pier/narrow-gap](../harness-21/pier/narrow-gap-sheet.png) | 28 | behavior, facing, height, visual | Immediate settle or stationary at start; no meaningful traversal. |
| [pier/unreachable](../harness-21/pier/unreachable-sheet.png) | 28 | behavior, facing, height, visual | Immediate settle or stationary at start; no meaningful traversal. |
| [pier/object](../harness-21/pier/object-sheet.png) | 28 | behavior, facing, height, visual | Immediate settle or stationary at start; no meaningful traversal. |
| [pier/exit-edge-left](../harness-21/pier/exit-edge-left-sheet.png) | 28 | behavior, facing, height, visual | Stationary at start; no exit traversal. |
| [pier/exit-edge-right](../harness-21/pier/exit-edge-right-sheet.png) | 28 | behavior, facing, draworder, visual | Stationary at start; no exit traversal. |
| [road/near-left](../harness-21/road/near-left-sheet.png) | 321 | behavior, facing, height, visual | Long lateral detour and boot slicing at tree crossing 288-290 through stop. |
| [road/near-right](../harness-21/road/near-right-sheet.png) | 28 | behavior, facing, height, visual | Stationary behind tree at start. |
| [road/deepest](../harness-21/road/deepest-sheet.png) | 105 | behavior, facing, height | Consistent away heading and straight standing settle. |
| [road/far-left](../harness-21/road/far-left-sheet.png) | 350 | behavior, facing, path, height, visual | Repeated changes including toward frame 152 then left 170; long detour and hidden final pose. |
| [road/far-right](../harness-21/road/far-right-sheet.png) | 144 | behavior, facing, height, visual | Severe fragmented occlusion across torso and feet while behind trees and traps; abrupt turns. |
| [road/diagonal-away](../harness-21/road/diagonal-away-sheet.png) | 28 | behavior, facing, height, visual | Stationary hidden by tree. |
| [road/diagonal-toward](../harness-21/road/diagonal-toward-sheet.png) | 139 | behavior, facing, height, visual | Fragmented occlusion leaves disconnected hands and boots through final pose. |
| [road/occluder-behind](../harness-21/road/occluder-behind-sheet.png) | 61 | behavior, facing, path, height, visual | Feet remain fully hidden by traps for entire walk and settle; clean planting cannot be verified. |
| [road/occluder-back](../harness-21/road/occluder-back-sheet.png) | 107 | behavior, facing, path, height, visual | Abrupt draw-order pop at crossing 86-88; feet remain hidden through settle. |
| [road/narrow-gap](../harness-21/road/narrow-gap-sheet.png) | 42 | behavior, facing, height, visual | Only tiny motion behind tree; soles and stop are obscured. |
| [road/unreachable](../harness-21/road/unreachable-sheet.png) | 61 | behavior, facing, path, height | Clean fixed away heading and straight standing stop. |
| [road/object](../harness-21/road/object-sheet.png) | 135 | facing, height, visual | Abrupt left to diagonal to toward cycle changes around frames 63 and 104; final feet hidden by traps. |
| [road/exit-edge-left](../harness-21/road/exit-edge-left-sheet.png) | 139 | behavior, facing, height, visual | Long left route ends behind tree with sliced boot and hand protruding; final planted sole cannot be verified. |
| [road/exit-edge-left-1](../harness-21/road/exit-edge-left-1-sheet.png) | 139 | behavior, facing, height, visual | Long left route ends behind tree with sliced boot and hand protruding; final planted sole cannot be verified. |
| [road/exit-edge-left-2](../harness-21/road/exit-edge-left-2-sheet.png) | 139 | behavior, facing, height, visual | Long left route ends behind tree with sliced boot and hand protruding; final planted sole cannot be verified. |
| [road/exit-edge-right](../harness-21/road/exit-edge-right-sheet.png) | 162 | behavior, facing, height, visual | Abrupt diagonal cycle change around frame 60; final standing pose entirely hidden by tree and cannot verify planted soles. |
| [road/exit-far](../harness-21/road/exit-far-sheet.png) | 61 | behavior, facing, height | Consistent away heading and straight progression; upright settle with visible intact soles. Arrival and exit success measured separately. |
| [square/near-left](../harness-21/square/near-left-sheet.png) | 95 | behavior, facing | Single lateral heading, straight walk and upright rest with intact soles; no visible corrective reversal. |
| [square/near-right](../harness-21/square/near-right-sheet.png) | 95 | behavior, facing, height | Single lateral heading, straight walk and upright rest with intact soles; no visible corrective reversal. |
| [square/deepest](../harness-21/square/deepest-sheet.png) | 117 | behavior, facing, path, height, visual | Abrupt left to away at frame 38 then right at 86; oscillating approach around fountain. |
| [square/far-left](../harness-21/square/far-left-sheet.png) | 144 | behavior, facing, path, height, visual | Multiple abrupt heading changes including away around frame 119 after long hidden fountain crossing. |
| [square/far-right](../harness-21/square/far-right-sheet.png) | 81 | behavior, facing, height, visual | Abrupt right to toward change frame 38 at lamp; stops short after approach. |
| [square/diagonal-away](../harness-21/square/diagonal-away-sheet.png) | 125 | behavior, facing, height, visual | Abrupt lateral to diagonal change and bent-knee final pose frames 119-124. |
| [square/diagonal-toward](../harness-21/square/diagonal-toward-sheet.png) | 125 | behavior, facing, height, visual | Final feet hidden behind fountain; diagonal bent-knee pose remains at stop. |
| [square/occluder-behind](../harness-21/square/occluder-behind-sheet.png) | 139 | facing, path, height, visual | Right to away frame 38 then left frame 70; abrupt corner cycle changes and fully hidden final soles. |
| [square/occluder-back](../harness-21/square/occluder-back-sheet.png) | 60 | behavior, facing, height, visual | Bent-knee final pose after coming out from behind fountain. |
| [square/narrow-gap](../harness-21/square/narrow-gap-sheet.png) | 52 | behavior, facing, path, visual | Awning mask cuts across torso at stop while head and feet remain visible. |
| [square/unreachable](../harness-21/square/unreachable-sheet.png) | 28 | behavior, facing, height, visual | Immediate rest with no meaningful walk; feet hidden behind fountain throughout. |
| [square/object](../harness-21/square/object-sheet.png) | 60 | behavior, facing, height, visual | Abrupt lateral to away switch after emerging from fountain; mask fragment crosses neck at frame 38. |
| [square/exit-edge-left](../harness-21/square/exit-edge-left-sheet.png) | 103 | behavior, facing, path, height, visual | Abrupt left to toward change frame 60; long hidden start and incomplete exit approach. |
| [stepped-street/near-left](../harness-21/stepped-street/near-left-sheet.png) | 52 | behavior, facing | Single lateral heading across lowest landing, intact soles and upright stop; no visible stair ascent. |
| [stepped-street/near-right](../harness-21/stepped-street/near-right-sheet.png) | 28 | behavior, facing, visual | No walk; remains stationary at start for entire capture. |
| [stepped-street/deepest](../harness-21/stepped-street/deepest-sheet.png) | 40 | behavior, facing, height, visual | Away stride overlaps visible stair risers despite conservative stair mask; no tread-aware ascent. |
| [stepped-street/far-left](../harness-21/stepped-street/far-left-sheet.png) | 73 | behavior, facing, visual | Lateral walk crosses multiple visible step levels without stepping up or down; upright stop alone does not validate tread support. |
| [stepped-street/far-right](../harness-21/stepped-street/far-right-sheet.png) | 129 | behavior, facing, path, height, visual | Fragmented boardwalk mask slices legs through frame 75; bent-knee final pose. |
| [stepped-street/diagonal-away](../harness-21/stepped-street/diagonal-away-sheet.png) | 28 | behavior, facing, path, height, visual | Immediate bent-knee rest with no meaningful walk. |
| [stepped-street/diagonal-toward](../harness-21/stepped-street/diagonal-toward-sheet.png) | 52 | behavior, facing, visual | Boardwalk fragment slices through both legs throughout walk and stop. |
| [stepped-street/occluder-behind](../harness-21/stepped-street/occluder-behind-sheet.png) | 28 | behavior, facing, height, visual | Immediate stationary rest; no walk. |
| [stepped-street/occluder-back](../harness-21/stepped-street/occluder-back-sheet.png) | 42 | behavior, facing, path, height, visual | Toward stride crosses visible risers without elevation handling, despite safe numeric floor mask. |
| [stepped-street/narrow-gap](../harness-21/stepped-street/narrow-gap-sheet.png) | 28 | behavior, facing, height, visual | Stationary start with building mask removing torso but boots remain visible. |
| [stepped-street/unreachable](../harness-21/stepped-street/unreachable-sheet.png) | 28 | behavior, facing, height, visual | No meaningful walk, stationary above visible step and building fragment cuts left leg. |
| [stepped-street/object](../harness-21/stepped-street/object-sheet.png) | 103 | behavior, facing, path, height, visual | Toward then away reversal around frame 75 with footfalls crossing visible risers. |
| [stepped-street/exit-edge-left](../harness-21/stepped-street/exit-edge-left-sheet.png) | 125 | behavior, facing, path, height, visual | Unmodeled stair descent followed by abrupt toward to diagonal change and bent-knee final pose. |
| [stepped-street/exit-edge-right](../harness-21/stepped-street/exit-edge-right-sheet.png) | 52 | behavior, facing, visual | Feet cross visible stepped surface without tread placement; first leg partly sliced by building fragment. |
| [stepped-street/exit-far](../harness-21/stepped-street/exit-far-sheet.png) | 52 | behavior, facing, height, visual | Abrupt right to away at stop, feet overlap visible stepped surface without tread support. |
