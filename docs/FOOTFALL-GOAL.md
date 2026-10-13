# Footfall: definition of done

Owner of this goal: Claude. Set 2026-10-11. It doesn't move unless Gorka moves it.

## The claim
Drop any AI-generated adventure background into Anima, and a character walks on it the way a hand-built LucasArts room would let him: planted feet, right size at every depth, facing where he's going, passing behind things, never on walls or sky, leaving by the exits a player would expect. No human calibration.

## Scenes (10)
Existing: depot outside, depot inside (hand-calibrated anchors), road, alley.
New, generated through the real pipeline (`POST /api/places`), chosen to break things:
1. cluttered pier: crates, posts, nets, gaps between boards
2. stepped street rising away from camera (non-planar floor)
3. church interior: rows of pews, central aisle
4. Gilman House lobby: desk, pillars, staircase
5. grocery: parallel aisles, narrow gaps
6. town square: central fountain to walk around and behind

## Walks per scene (≥ 10)
near-left, near-right, deepest reachable point, far-left, far-right, both diagonals, a crossing behind the largest occluder and back, the narrowest passable gap, an unreachable click (wall or sky), one object click, every exit.

## Pass bars (every walk, every frame)
| check | bar | measured by |
|---|---|---|
| planted foot slide | median ≤ 5%, p90 ≤ 15% of body motion; stance drift ≤ 1.5 px | sprite contact points × logged position/scale |
| on floor | 100% of frames inside the walkable mask | per-frame telemetry |
| size | within 3% of the perspective prediction; flat floors within 1% | telemetry + pixel tracking from video |
| facing | cycle matches ground heading ≥ 95% of walking frames; ≤ 1 switch per 300 px | telemetry |
| draw order | correct at 100% of frames where the sprite overlaps an occluder | telemetry vs baseline polylines, plus crossing frames by eye |
| path | ≤ 1.05× the shortest **octilinear** path on the walk area, in ground space; never through walls or narrower-than-body gaps. (Amended 2026-10-13: with 8 drawn stride directions and planted feet, an octilinear path is the shortest achievable one; the Euclidean optimum is still reported.) | navigation check |
| clicks | floor click always walks; object click walks to it, then narrator; unreachable → nearest reachable | scripted clicks |
| exits | each fires exactly once, to the right destination | scripted walks |
| video | frame-perfect, 0 frozen frames while walking | freeze.py |
| regressions | all tests, typecheck, lint, verify:art, town journey with 0 uncached paid calls | CI commands |

## Sign-off
Numbers are necessary, not sufficient. For every walk I look at: the 6 fps contact sheet, the feet close-ups at every flagged frame plus 5 random ones, and the frames before, at and after every baseline crossing. Anything that looks wrong to a player fails, even if every number passes.

A scene that the approach genuinely can't handle (it has been tried and fixed at least twice) is reported as a named limitation with frames showing why. It's never dropped quietly or swapped for an easier scene.

## Deliverables
- `packages/footfall/` (`@anima/footfall`): core (perspective, walk area, navigation, occlusion, exits, heading, root motion), Phaser adapter, derivation client, QA harness. README and tests.
- For every scene: frame-perfect clips, contact sheets, crossing frames, `results.json`.
- `tmp/walkqa/report.md`: a pass/fail table (scene × check), every failure found along the way and how it was fixed, known limitations.

## Not in this goal
8-direction cycles (added only if the facing bar fails on diagonals), other characters, walking up actual stairs with step-by-step foot placement, hidden-floor prediction by a trained model.
