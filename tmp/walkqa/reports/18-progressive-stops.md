# Brief 18 — away diagonals fixed; side still fails

**PARTIAL, not accepted as a complete brief.** Away-right and its away-left mirror now settle through the requested drawn arm and leg edits and start in reverse. **Side/left/right remains the brief-15 drawing:** both permitted side step-B attempts redraw/move the planted boot, and translating them back exceeds the head/torso seam limit. Rejected art was not installed. F20 remains open for side. This does not complete `docs/FOOTFALL-GOAL.md`.

All **16 stops and eight starts were freshly rendered**, retaining full lossless PNG sequences locally. **12/16 stops end in the reviewer-approved rest poses; four side stops fail rest.** All 32 installed head/torso seams pass ≤4 screen px; the six altered captures have maximum head **0.412 px**, torso **0.592 px**. The complete set reaches head **2.374 px**, torso **2.018 px**. Every arrival is within half a stride; lockcheck, floor/object checks, rendered alpha, tests, typecheck, lint, art verification and the final credential-disabled town replay pass.

## Drawings and bounded attempts

**5/8 image edits; no video generation or encoding.** All used `fal-ai/nano-banana-2/edit`, one image per call. Step A used the exact requested arm prompt; step B used the exact requested leg prompt on A's output. Side B was retried once with the planted rear/right boot explicitly identified and all other regions locked. The three unused allowances belong to other steps; they were not reassigned to a third side B attempt.

| Heading | Arms | Legs | Decision |
|---|---|---|---|
| side | [A1 source/prompt/raw/registration](../verification-18/side/A-1/) | [B1](../verification-18/side/B-1/), [B2 retry](../verification-18/side/B-2/) | Reject both leg edits; retain brief-15 playback |
| away-right | [A1](../verification-18/away-right/A-1/) | [B1](../verification-18/away-right/B-1/) | Install with mirrored away-left |

[Submission runner](../verification-18/edit.py) records attempted calls before submission, retains request IDs/results, and refuses duplicate submissions or more than two attempts per named step. Only environment credentials are read; none are written or printed. The call ledger commit includes only this brief's five entries; pre-existing ledger edits remain uncommitted.

Every source is the **612×1059 walk canvas on RGB 128 grey**, from brief-15 cycle exit **side 29 / away-right 8**. Fal returned 784×1357 rasters (side retry: 784×1360). Its [API schema](https://fal.ai/models/fal-ai/nano-banana-2/edit/api) exposes resolution presets and aspect ratios, rather than exact pixel dimensions. The raw raster was resampled once to the source canvas dimensions before integer translation registration. This canvas conversion is disclosed separately: **no fitted scale, rotation, local warp, limb compositing, interpolation, or crossfade** was used. The stricter interpretation “no resampling whatsoever” is not satisfied by these provider rasters.

Both away edits register at **(0,0)** after that fixed canvas conversion. Independent masked boot tracking measures exit→A **(-0.409,-0.373)** and A→B **(-0.292,-0.322)** source px, cumulative magnitude **0.987 source px**. The integer-pixel support position is unchanged, but the generated boot RGB is not bit-identical. [Independent tracker results](../verification-18/away-right/independent-boot-track.json). Contacts retain the exact source support `(285.0422,1024.5085)`; source and A's free sole is `(297,972)`, B's reviewed free sole is `(368,1034)`. These are physical boot annotations, not motion-capture truth. Their positions are visible on the sheets below.

Side B1 needs translation **(-12,-12)** and B2 **(+13,-7)**. At representative scale 0.42, their head/torso centroid diagnostics are respectively **4.51/4.93 px** and **5.91/6.65 px**. Both redraw/rotate the planted boot; neither is a valid positional lock. The retained side sheet uses B2 only to show the failed attempt. Its draft contact metadata is explicitly unvalidated and was never passed off as a successful lockcheck.

## Stop sheets and comparison

| Heading | Source-size RGBA sheet | Annotated drawing review |
|---|---|---|
| side, facing left — **REJECTED** | [sheet](../verification-18/side/stop-sheet.png) | [exit → A → B](../verification-18/side/review.png) |
| side, facing right — **REJECTED** | [mirror sheet](../verification-18/side/stop-sheet-mirrored.png) | [mirrored review](../verification-18/side/review-mirrored.png) |
| away-right | [sheet](../verification-18/away-right/stop-sheet.png) | [exit → A → B](../verification-18/away-right/review.png) |
| away-left | [mirror sheet](../verification-18/away-right/stop-sheet-mirrored.png) | [mirrored review](../verification-18/away-right/review-mirrored.png) |

[Before/after against stands15.png](../verification-18/before-after.png). The side “after” is explicitly labelled rejected. [Original reviewer image](../logs/stands15.png).

Away B has both boots down, close together, straightened knees and relaxed arms. Both legs remain present through the discrete cut; there are no doubled limbs or dissolving silhouettes. It is a visible leg reposition, not an invisible free-foot cut: **the moving free boot travels 17.65–39.14 screen px at A↔B**. The ≤4 test here follows step 4's explicit **head and torso** bar. If “every seam ≤4” also means the edited free foot, the away settle fails that additional bar. Exact per-seam free-foot displacement is retained in [jumps.json](../proof-18/jumps.json).

## Installed playback

`hermes-passing-stand-away-right` now stores **B, A, exit** as frames **0,1,2**, with `settleFrames: [2,1,0]`. Keeping rest at frame zero preserves existing standing callers. Stored exit frame 2 is pixel-for-pixel identical to the original walk frame 8. The cycle still has its single brief-15 entry/exit; no cut selection policy changed.

Stops render walk frame 8 for two 24-fps ticks, A for two ticks, then B indefinitely. Starts hold B, then A, then the identical exit drawing for two ticks each, before continuing the source cycle. The motor applies each drawing around the same support anchor without blending. Large update calls cannot skip a drawing. A stop during reverse playback returns to rest; teleport cancels queued drawings. Tests exercise forward/reverse timing, promise completion, contact lock and these interruption paths.

Away, toward and toward-right (including its mirror) are **byte-for-byte unchanged**. Side is also unchanged because its proposed edit failed. [Asset preservation audit](../verification-18/unchanged-poses.json). Only the away-diagonal standing sheet/metadata and generic optional drawn-pose playback were installed.

## All 24 captures

All numerical columns are **1× screen px**; linked sequences are **2×**. For multi-step captures the table gives the maximum across their seams. New away sequences and mirrored starts were inspected through every displayed settle pose; all final stops and initial stands were reviewed in the [road](../proof-18/road-rests.png), [depot](../proof-18/depot-rests.png), and [start](../proof-18/starts-rests.png) overview sheets. The unchanged approved toward-diagonal poses retain their existing bent-leg appearance, per the reviewer's scope.

| Scene / heading | Seams | Head max | Torso max | Free boot max | Rest pose | Sequence |
|---|---:|---:|---:|---:|---|---|
| road / left | 1 | 1.247 | 1.029 | 3.39 | FAIL: original side | [2×](../proof-18/road/left-sequence-2x.png) |
| road / right | 1 | 1.192 | 0.983 | 3.24 | FAIL: original side | [2×](../proof-18/road/right-sequence-2x.png) |
| road / away | 1 | 0.541 | 1.218 | 4.69 | PASS | [2×](../proof-18/road/away-sequence-2x.png) |
| road / toward | 1 | 0.920 | 1.185 | 4.24 | PASS | [2×](../proof-18/road/toward-sequence-2x.png) |
| road / away-left | 2 | 0.267 | 0.384 | 25.39 | PASS | [2×](../proof-18/road/away-left-sequence-2x.png) |
| road / away-right | 2 | 0.186 | 0.267 | 17.65 | PASS | [2×](../proof-18/road/away-right-sequence-2x.png) |
| road / toward-left | 1 | 0.203 | 0.144 | 0.07 | PASS | [2×](../proof-18/road/toward-left-sequence-2x.png) |
| road / toward-right | 1 | 0.238 | 0.169 | 0.08 | PASS | [2×](../proof-18/road/toward-right-sequence-2x.png) |
| depot / left | 1 | 1.732 | 1.426 | 4.65 | FAIL: original side | [2×](../proof-18/depot/left-sequence-2x.png) |
| depot / right | 1 | 2.374 | 1.955 | 6.37 | FAIL: original side | [2×](../proof-18/depot/right-sequence-2x.png) |
| depot / away | 1 | 0.829 | 1.862 | 7.16 | PASS | [2×](../proof-18/depot/away-sequence-2x.png) |
| depot / toward | 1 | 1.222 | 1.589 | 5.72 | PASS | [2×](../proof-18/depot/toward-sequence-2x.png) |
| depot / away-left | 2 | 0.391 | 0.563 | 37.23 | PASS | [2×](../proof-18/depot/away-left-sequence-2x.png) |
| depot / away-right | 2 | 0.372 | 0.535 | 35.37 | PASS | [2×](../proof-18/depot/away-right-sequence-2x.png) |
| depot / toward-left | 1 | 0.446 | 0.317 | 0.15 | PASS | [2×](../proof-18/depot/toward-left-sequence-2x.png) |
| depot / toward-right | 1 | 0.496 | 0.353 | 0.16 | PASS | [2×](../proof-18/depot/toward-right-sequence-2x.png) |
| starts / left | 1 | 1.933 | 1.592 | 5.18 | FAIL: original side | [2×](../proof-18/starts/left-sequence-2x.png) |
| starts / right | 1 | 1.933 | 1.592 | 5.18 | FAIL: original side | [2×](../proof-18/starts/right-sequence-2x.png) |
| starts / away | 1 | 0.898 | 2.018 | 7.76 | PASS | [2×](../proof-18/starts/away-sequence-2x.png) |
| starts / toward | 1 | 1.064 | 1.383 | 4.98 | PASS | [2×](../proof-18/starts/toward-sequence-2x.png) |
| starts / away-left | 3 | 0.412 | 0.592 | 39.14 | PASS | [2×](../proof-18/starts/away-left-sequence-2x.png) |
| starts / away-right | 3 | 0.412 | 0.592 | 39.14 | PASS | [2×](../proof-18/starts/away-right-sequence-2x.png) |
| starts / toward-left | 1 | 0.486 | 0.346 | 0.16 | PASS | [2×](../proof-18/starts/toward-left-sequence-2x.png) |
| starts / toward-right | 1 | 0.486 | 0.346 | 0.16 | PASS | [2×](../proof-18/starts/toward-right-sequence-2x.png) |

[Full seam table](../proof-18/jumps.json), [clip summary](../proof-18/clips.json). Each capture also has individual `*-seam-N-2x.png` before/after/diagnostic-overlay triptychs. Overlay images are diagnostics only, never game playback.

## Acceptance and cleanup

| Gate | Result | Evidence |
|---|---|---|
| All 16 stops at rest | **FAIL: 12/16**; four side stops retain F20 | overview sheets above |
| Two corrected headings and mirrors | **PARTIAL**: away pair installed; side pair rejected | source reviews above |
| 16 stops + 8 starts rendered | PASS, 1,108 frames | [clips](../proof-18/clips.json) |
| Head/torso seams ≤4 screen px | PASS 32/32; max 2.374 / 2.018 | [seams](../proof-18/jumps.json) |
| No appearing/vanishing limb in new settles | PASS by inspection; large discrete free-leg reposition remains | six affected sequences above |
| Reviewer lockcheck ≤1 px | PASS max **0.00 px** | [lockcheck](../verification-18/lockcheck.txt) |
| Walkstats floor / object contacts | PASS **0 off-floor, 0 object contacts** | [walkstats](../verification-18/walkstats.txt) |
| Rendered alpha | PASS all 1,108 frames: alpha 1, no blend, histogram identical to normal control | [acceptance](../verification-18/acceptance.json) |
| Generated A/B body interiors opaque | PASS: zero nonopaque interior pixels | [asset alpha audit](../verification-18/asset-alpha.json) |
| Actual final arrival ≤half stride | PASS 24/24; max distance/allowance 0.995 | [arrivals](../verification-18/arrivals.json) |
| `verify:art --generated` | PASS all **16 scenes**, existing inside vending-machine warning remains | [art log](../verification-18/art.log) |
| Tests | PASS **431 tests / 46 files** | [tests](../verification-18/tests.log) |
| Typecheck / lint | PASS | [typecheck](../verification-18/typecheck.log), [lint](../verification-18/lint.log) |
| Final credential-disabled town replay | PASS **run 84: 25 records, 20 cached calls, 0 uncached** | [JSON](../verification-18/town84.json), [log](../verification-18/town84.log), [actual listener credential flags](../verification-18/provider-credentials-disabled.json) |
| Reviewer tools untouched | PASS relative to task entry, including pre-existing dirty walkstats | [hash comparison](../verification-18/reviewer-tools-unchanged.json) |

The asset alpha audit separately shows inherited near-opaque interior pixels in the **unchanged source exit** (side 2,683; away 1,665). Those original pixels were preserved to keep the exit exact. Generated A/B interiors are fully opaque. The rendered alpha test checks sprite opacity and agreement with the normal source rendering; it does not claim every original source alpha byte equals 255.

Initial run 82 accidentally invoked the default creation journey instead of `--replay`, and hit an existing `Exit already connected` conflict. It is retained as a failure, not a passing replay: [record](../verification-18/town82.json), [log](../verification-18/town82.log). Saved-town runs 83 and 84 passed with zero uncached calls; 84 ran against the final interruption fix. No graph overwrite was used to make the replay pass.

Only API **4317** and game **8080** were started. Both task server trees and task browser sessions are stopped: [cleanup](../verification-18/cleanup.json). Owner ports **4410/8090 were untouched**. Every browser navigation used `?mute=1`. No keys/dotenv files written, no videos, no push/merge/deploy/settings changes. Pre-existing `calls.md`, `walkstats.py`, and untracked `AgentDebug.test.ts` changes remain outside the brief's commits.

Reproduce assets with [build.py](../verification-18/build.py), which reuses the existing local grey key; registration is in [register.py](../verification-18/register.py). Retained raw inputs/results require no repeat paid calls. Use the brief-15 [credential-free launcher](../verification-15/provider-free-server.mjs) and [lossless renderer](../verification-15/render-stills.mjs), with this brief's [road](../verification-18/road-plan.json), [depot](../verification-18/depot-plan.json), and [starts](../verification-18/starts-plan.json) plans, `--alpha-audit --keep-frames --retain-failures`, and the matching `proof-18` destination. [audit.py](../verification-18/audit.py) measures every drawn seam using the previous projection helpers. Full PNG sequences remain local under ignored `proof-18/*/*-frames`; compact QA sheets, telemetry, prompts, raw edits and logs are committed by path.
