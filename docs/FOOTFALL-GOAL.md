# Footfall: believable walking in the actual scenes

Owner: Gorka. Set 2026-10-11; revised at Gorka’s explicit direction on 2026-10-16.

## The claim
Drop any AI-generated adventure background into Anima, and a character walks on it the way a hand-built LucasArts room would let him: planted feet, right size at every depth, facing where he's going, passing behind things, never on walls or sky, leaving by the exits a player would expect. No human calibration.

## Immediate priority: believable scale before further animation polishing

The outcome is believable walking in the actual scene. Numeric gates support that judgment; they do not establish visual correctness by themselves.

The next milestone is a visibly credible character at near, middle and far positions across all 13 scenes. Fix the shared scale and perspective model where scene evidence contradicts it. Show actual before/after stills for oversized or undersized characters, and label unresolved scenes plainly. Do not spend this milestone polishing unrelated animation details or treating a green floor mask as evidence that character scale is correct.

1. Correct the general scale calibration so a background reference cannot produce an implausibly oversized foreground character. Diagnose the pier first; preserve the verified turn fix and cellar correction.
2. Evaluate all 13 scenes at near, middle and far reachable positions. Show the actual character against the scene in still-image comparisons, including the foreground and depth extremes. No videos or recordings.
3. Validate scale against independent scene evidence: visible objects with defensible dimensions, their ground-contact positions, and the depicted perspective. Agreement with the same formula that produced the scale is only an implementation check, never proof of correct size. Record uncertain references as uncertain; do not silently count them as passing.
4. Add regression coverage that catches the oversized pier character and excessive foreground growth using independently reviewed expectations. Do not derive expected results from the calibration under test or fix individual scenes with hand-tuned size overrides.
5. Present the comparisons to Gorka before declaring scale complete. Obvious giant/tiny characters or implausible growth fail even when the existing gates pass. Further animation polishing waits until scale is credible across the scene set.

Preserve SAM + MoGe floor combination and existing movement safeguards. No unrelated rewrite. The path, exits, occlusion and other requirements below remain open until independently verified; this priority change does not mark them complete.

## Scenes (13)
Existing: depot outside, depot inside (hand-calibrated anchors), road, alley.
New, generated through the real pipeline (`POST /api/places`), chosen to break things:
1. cluttered pier: crates, posts, nets, gaps between boards
2. stepped street rising away from camera (non-planar floor)
3. church interior: rows of pews, central aisle
4. Gilman House lobby: desk, pillars, staircase
5. grocery: parallel aisles, narrow gaps
6. town square: central fountain to walk around and behind
Additional pipeline scenes: beach, graveyard and cellar. All 13 are required; none may be silently dropped.

## Walks per scene (≥ 10)
near-left, near-right, deepest reachable point, far-left, far-right, both diagonals, a crossing behind the largest occluder and back, the narrowest passable gap, an unreachable click (wall or sky), one object click, every exit.

## Pass bars (every walk, every frame)
| check | bar | measured by |
|---|---|---|
| planted foot slide | median ≤ 5%, p90 ≤ 15% of body motion; stance drift ≤ 1.5 px | sprite contact points × logged position/scale |
| on floor | 100% of frames inside the walkable mask | per-frame telemetry |
| size | believable adult size at near, middle and far positions in all 13 scenes, supported by independent scene evidence; no implausible foreground growth. Formula agreement within 3% (flat floors within 1%) remains a secondary consistency check only | rendered still comparisons, independently reviewed scale expectations, and telemetry |
| facing | cycle matches ground heading ≥ 95% of walking frames; ≤ 1 switch per 300 px | telemetry |
| draw order | correct at 100% of frames where the sprite overlaps an occluder | telemetry vs baseline polylines, plus crossing frames by eye |
| path | ≤ 1.05× the shortest **octilinear** path on the walk area, in ground space; never through walls or narrower-than-body gaps. (Amended 2026-10-13: with 8 drawn stride directions and planted feet, an octilinear path is the shortest achievable one; the Euclidean optimum is still reported.) | navigation check |
| clicks | floor click always walks; object click walks to it, then narrator; unreachable → nearest reachable | scripted clicks |
| exits | each fires exactly once, to the right destination | scripted walks |
| animation continuity | 0 unintended frozen frames while walking | deterministic frame-state checks and still-frame pixel comparisons; no videos or recordings |
| regressions | all tests, typecheck, lint, verify:art, town journey with 0 uncached paid calls | CI commands |

## Sign-off
Numbers are necessary, not sufficient. For every walk I look at: the 6 fps contact sheet, the feet close-ups at every flagged frame plus 5 random ones, and the frames before, at and after every baseline crossing. Anything that looks wrong to a player fails, even if every number passes.

A scene that the approach genuinely can't handle (it has been tried and fixed at least twice) is reported as a named limitation with frames showing why. It's never dropped quietly or swapped for an easier scene.

## Deliverables
- `packages/footfall/` (`@anima/footfall`): core (perspective, walk area, navigation, occlusion, exits, heading, root motion), Phaser adapter, derivation client, QA harness. README and tests.
- For every scene: near/middle/far scale comparisons, contact sheets, crossing frames, `results.json`, and independent scale evidence with uncertainty recorded. No clips or recordings.
- `tmp/walkqa/report.md`: a pass/fail table (scene × check), every failure found along the way and how it was fixed, known limitations.

## Not in this goal
8-direction cycles (added only if the facing bar fails on diagonals), other characters, walking up actual stairs with step-by-step foot placement, hidden-floor prediction by a trained model.
