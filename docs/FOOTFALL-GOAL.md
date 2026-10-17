# Footfall: fix grocery character size

Scope narrowed by Gorka on 2026-10-16. This replaces the previous broad goal. The previous requirements are preserved in FOOTFALL-BACKLOG.md as deferred work, not current completion requirements.

## Outcome

The character has a believable adult size at near, middle and far reachable positions in the grocery. Use a shared scale correction, not a scene-ID override or hand-tuned grocery multiplier. Preserve the currently credible pier and lobby calibration.

## Definition of done

1. Integrate the correction in the scale derivation used by the game. A standalone preview does not count.
2. Show actual before/after grocery stills at near, middle and far positions using the integrated result. Judge against visible scene proportions; distinguish estimates from physical measurements.
3. Verify pier and lobby scale do not regress, using existing baseline evidence and targeted comparisons. Preserve SAM + MoGe floor combination and movement safeguards.
4. Add focused regression coverage for the correction; relevant tests, typecheck and lint pass. Commit only the task's source/document paths when green. No push or deploy.
5. Report what changed and any remaining uncertainty, then stop. Do not resume the deferred project automatically.

## Constraints

No videos, recordings, paid provider calls, new generated images, manual saved-floor edits, or modifications to tmp/walkqa/tools. Do not touch ports 4410, 8090 or 3000. Preserve unrelated work. Run one simulation or test suite at a time; reuse unchanged evidence.

## Deferred

Alley scale, square uncertainty, exits, route optimization, remaining walk reviews and full 13-scene certification. These do not block this focused goal and are not claimed complete.

## Verification

Implemented and verified with cached production derivation and shared-motor replay (run 380). Grocery near/middle/far stills reviewed; pier/lobby scale and 26 walk sequences unchanged. 150 API tests, typecheck and lint pass. Evidence: `tmp/walkqa/reports/380-focused-completion.md`. Scale remains a model estimate, not a physical measurement. Saved scene floors and deployment remain untouched.
