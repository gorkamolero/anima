# Brief 12 — measured stop/start cuts

**Status: code and numerical checks pass; visual acceptance FAILS.** The dissolve and its second Hermes sprite are removed. All requested captures are retained: 16 stops (road/depot × eight headings) and eight starts. No ghosts or opacity fades remain. The supplied standing drawings still change body/limb silhouettes visibly at several cuts. This is the explicit artwork limitation requested in §4, not a claim that F17 or the wider FOOTFALL goal has full visual sign-off.

## Implementation

- `70d3b6f`: `packages/sprite-tools/scripts/matched-cuts.py` generates `matchedCut` in the five walk-sheet JSON files. It measures **every frame** against the appropriate standing sheet after translating the standing contact onto that frame's planted sole. Mirrored headings share the same IoU/displacement magnitudes. No source PNG was changed.
- Alpha IoU uses alpha >127. Head and torso measurements are reproducible **region-centroid proxies**, not anatomical keypoints: alpha-weighted centroids over the top 0–23% and 25–62% of each silhouette's own visible height. Score is `100 × (1 − IoU) + headPx + torsoPx`. Coordinates are native sprite pixels, before scene scale.
- Exits include the best frame on each support and each contiguous stance. Additional minimum-score coverage candidates bound the cyclic gap to half a cycle. This constraint sometimes forces a poor candidate; the severe toward-right example below is retained, not hidden.
- Entry frames are a score-ranked list of candidates with at least two remaining support frames. The motor chooses the first candidate on its actual support that passes floor, continuation and route-progress checks. It may need a lower-ranked safe candidate; the free standing sole is only used as an alternate grounded support if the first support cannot start.
- `96e6fc8`: stops simulate contact transfers and body clearance to the next generated exit, render that exit, then cut on the next frame boundary. An output tick cannot consume the exit and standing pose without showing the exit. Starts cut immediately into the selected entry. The outgoing and incoming drawings use the same planted world contact at the seam. No alpha interpolation remains.
- Arrival requests now begin when the goal enters the arrival window, so a support-switch-only check cannot miss the next usable exit. Near-goal planning also considers the standing endpoint. A recovery approach is checked for a real arrival again at its final exit.
- The safety fallback for an explicit stop with **no reachable generated exit within half a cycle** is an immediate opaque cut, tagged `unmatchedCut`; this is a remaining boundary limitation, not a matched-cut success. **No final proof cut or final town floor-walk arrival used it.** The town gate requires `cut.matched`.
- `e244bad`: removes the blend sprite and callback. Automatic edge travel uses the planted contact; a starting cut's sprite-origin shift can no longer spuriously trigger a neighbouring exit.
- `dc3bbdc`: captures the pre-input standing frame and the exact entry frame for starts, adds the renderer alpha audit, and updates the town seam assertion. The original arrival target/half-stride test and both-soles-on-floor test remain; the obsolete “anchor cannot change during the whole approach” assertion is replaced by cut-contact equality and the half-cycle bound.

## Best matches and artwork limitation

The following are the best unconstrained exit on each anatomical support. Even those mostly exceed the requested ~6 sprite-pixel displacement bar. The comparison overlays are **debug images only**, never runtime assets.

| Cycle / headings | Support | Best exit | Alpha IoU | Head px | Torso px | Debug sheet |
|---|---|---:|---:|---:|---:|---|
| left, right | L | 8 | 0.761 | 4.98 | 4.11 | [walk / standing / overlay](../verification-12/matches/hermes-fal-veo-transparent-loop.png) |
| left, right | R | 23 | 0.632 | 22.41 | 16.32 | [walk / standing / overlay](../verification-12/matches/hermes-fal-veo-transparent-loop.png) |
| away | L | 19 | 0.631 | 32.89 | 32.00 | [walk / standing / overlay](../verification-12/matches/hermes-walk-away.png) |
| away | R | 2 | 0.675 | 31.51 | 24.08 | [walk / standing / overlay](../verification-12/matches/hermes-walk-away.png) |
| toward | L | 5 | 0.590 | 51.01 | 42.82 | [walk / standing / overlay](../verification-12/matches/hermes-walk-toward.png) |
| toward | R | 18 | 0.503 | 63.07 | 56.01 | [walk / standing / overlay](../verification-12/matches/hermes-walk-toward.png) |
| away-right, away-left | L | 27 | 0.700 | 18.97 | 5.33 | [walk / standing / overlay](../verification-12/matches/hermes-walk-away-right.png) |
| away-right, away-left | R | 18 | 0.727 | 15.76 | 3.93 | [walk / standing / overlay](../verification-12/matches/hermes-walk-away-right.png) |
| toward-right, toward-left | L | 2 | 0.571 | 19.41 | 3.89 | [walk / standing / overlay](../verification-12/matches/hermes-walk-toward-right.png) |
| toward-right, toward-left | R | 19 | 0.801 | 5.59 | 7.35 | [walk / standing / overlay](../verification-12/matches/hermes-walk-toward-right.png) |

Visual review: all 16 stop sheets and eight start sheets were inspected, including the before/after seam pairs in the three review indexes. The side and rear-diagonal cuts retract a raised boot abruptly; the front view changes head/body proportions and arm placement; the front diagonal changes the leg and bag silhouette. These are opaque pose pops, not ghosts.

**Worst retained example: depot toward-right, frames 5→6.** Its source frame 7 is the minimum-score extra exit needed to cover the long gap between the better exits under the half-cycle cap. IoU is **0.232**, head displacement **126.925 sprite px**, torso **120.620 sprite px**. This visibly fails. The best L-support exit (frame 2) is still 19.407 head px / IoU 0.571; the best R-support exit (19) has 7.346 torso px. Simply replacing the coverage candidate with a different number cannot meet all the constraints.

A matching standing-pose edit is still needed: preserve each cycle's head/torso drawing and proportions while bringing its free boot down beside the support. Side R, away, toward and the diagonals need separate attention; the front view is particularly different. A 1–2-frame settle extracted from the walk could soften the limb motion, but cannot by itself remove the final head/torso mismatch. No image edits, generated video, or paid calls were made in this pass. The allowed image-edit budget remains unused.

## Actual stop seams

Displacements below are sprite px; multiply by the logged scale for game-screen px (and by another 2 for the enlarged sheets). All are precomputed exits. `wait` counts source frames from the stop request to its rendered exit; maximum is 12, within each cycle's half-cycle limit.

| Scene / heading | Exit | Wait | IoU | Head / torso px | Scale | Head / torso screen px |
|---|---:|---:|---:|---:|---:|---:|
| road / away-left | 18 | 3 | 0.727 | 15.76 / 3.93 | 0.292 | 4.60 / 1.15 |
| road / away-right | 18 | 3 | 0.727 | 15.76 / 3.93 | 0.241 | 3.79 / 0.95 |
| road / away | 19 | 0 | 0.631 | 32.89 / 32.00 | 0.327 | 10.75 / 10.46 |
| road / left | 23 | 8 | 0.632 | 22.41 / 16.32 | 0.324 | 7.27 / 5.29 |
| road / right | 23 | 4 | 0.632 | 22.41 / 16.32 | 0.324 | 7.27 / 5.29 |
| road / toward-left | 2 | 2 | 0.571 | 19.41 / 3.89 | 0.275 | 5.34 / 1.07 |
| road / toward-right | 19 | 11 | 0.801 | 5.59 / 7.35 | 0.340 | 1.90 / 2.50 |
| road / toward | 18 | 1 | 0.503 | 63.07 / 56.01 | 0.344 | 21.67 / 19.24 |
| depot / away-left | 18 | 0 | 0.727 | 15.76 / 3.93 | 0.437 | 6.90 / 1.72 |
| depot / away-right | 41 | 3 | 0.717 | 22.00 / 8.01 | 0.444 | 9.77 / 3.56 |
| depot / away | 2 | 11 | 0.675 | 31.51 / 24.08 | 0.472 | 14.87 / 11.37 |
| depot / left | 23 | 12 | 0.632 | 22.41 / 16.32 | 0.440 | 9.87 / 7.19 |
| depot / right | 23 | 8 | 0.632 | 22.41 / 16.32 | 0.440 | 9.87 / 7.19 |
| depot / toward-left | 19 | 3 | 0.801 | 5.59 / 7.35 | 0.399 | 2.23 / 2.93 |
| depot / toward-right | 7 | 3 | 0.232 | 126.92 / 120.62 | 0.472 | 59.96 / 56.98 |
| depot / toward | 18 | 5 | 0.503 | 63.07 / 56.01 | 0.465 | 29.32 / 26.04 |

## Actual start seams

Each first-six sheet includes standing frame 0 and the immediate walk entry at frame 1, before advancing the motor clock. These are the selected floor-safe entries, including the safe lower-ranked away entry.

| Heading | Entry frame | Support | IoU | Head / torso sprite px |
|---|---:|---|---:|---:|
| left | 8 | L | 0.761 | 4.98 / 4.11 |
| right | 8 | L | 0.761 | 4.98 / 4.11 |
| away | 16 | L | 0.620 | 40.63 / 41.62 |
| away-left | 27 | L | 0.700 | 18.97 / 5.33 |
| away-right | 27 | L | 0.700 | 18.97 / 5.33 |
| toward | 5 | L | 0.590 | 51.01 / 42.82 |
| toward-left | 2 | L | 0.571 | 19.41 / 3.89 |
| toward-right | 2 | L | 0.571 | 19.41 / 3.89 |

## Verification

| Check | Result |
|---|---|
| Restored reviewer `lockcheck.py` | **24 clips, maximum 0.00 px**, including standing frames |
| Reviewer `walkstats.py` | **0 off-floor frames, 0 object contacts** across all 552 samples |
| Projected actual support, including texture seam | Maximum floating-point error <1e-9 px |
| Actual cut selection | All 24 final cuts use generated exit candidates; final town floor walks also require matched cuts |
| Renderer alpha | **552/552 frames exact histogram equality** to an opaque normal-pose control; 192 transition-frame comparisons indexed separately |
| Tests | **412 tests / 43 files passed** |
| Typecheck / lint | Passed |
| `verify:art` | Passed, existing oversized vending-machine warning retained |
| Town replay 67 | Passed: **20 cached calls, 0 uncached calls** |
| Ghosting / dissolve | None: one sprite, alpha 1, no blend sprite |
| No visible jump | **FAIL — artwork limitations above** |

Alpha was measured through Phaser's actual renderer: draw Hermes alone into a transparent 1920×1080 RenderTexture, snapshot it, and count all 256 per-pixel alpha bins. Draw a normal sprite using the same source frame, position, origin, flip and scale at alpha 1 as the control. Histograms match exactly, including normal edge antialiasing. On walk transition frames the control is that same normal walk frame; on standing frames it is the normal standing frame. Different poses naturally have different opaque areas, so comparing unrelated source-frame histograms would be invalid. The comparison covers every capture, not only the opacity property. Full per-frame bins are in each clip JSON; [transition histograms](../proof-12/alpha-histograms.json) retain both distributions.

F16 respected: **no reviewer tool was edited.** `walkstats.py` already had the owner's short-clip cadence change when this task started; it remains uncommitted and untouched. `calls.md` and `packages/engine/src/debug/AgentDebug.test.ts` also remain as found. [Reviewer tool hashes](../verification-12/reviewer-tool-sha256.txt) identify the tools used. No anchor-based stance grouping was introduced. The independent checker is the lock acceptance result; motor cut telemetry is supplementary.

Intermediate replay failures are retained in verification logs: 58–63 exposed missed arrival windows/arrival recording during a boundary approach; 64–65 exposed a sprite-origin jump incorrectly firing edge travel on restart. Replay 66 passed after physical-contact travel; 67 additionally enforced the generated-exit gate. The first local capture/art attempt used the game's default API URL and failed to load the world; final runs used API4317/game8080 with `?mute=1` and `VITE_MUTE=1`.

## Proof index

[Road visual index](../proof-12/road-review.png) · [Depot visual index](../proof-12/depot-review.png) · [Starts visual index](../proof-12/starts-review.png)

| Heading | Road stop | Depot stop | Start |
|---|---|---|---|
| left | [last six 2×](../proof-12/road/left-last6-2x.png) · [clip](../proof-12/road/left.mp4) | [last six 2×](../proof-12/depot/left-last6-2x.png) · [clip](../proof-12/depot/left.mp4) | [first six 2×](../proof-12/starts/left-first6-2x.png) · [clip](../proof-12/starts/left.mp4) |
| right | [last six 2×](../proof-12/road/right-last6-2x.png) · [clip](../proof-12/road/right.mp4) | [last six 2×](../proof-12/depot/right-last6-2x.png) · [clip](../proof-12/depot/right.mp4) | [first six 2×](../proof-12/starts/right-first6-2x.png) · [clip](../proof-12/starts/right.mp4) |
| away | [last six 2×](../proof-12/road/away-last6-2x.png) · [clip](../proof-12/road/away.mp4) | [last six 2×](../proof-12/depot/away-last6-2x.png) · [clip](../proof-12/depot/away.mp4) | [first six 2×](../proof-12/starts/away-first6-2x.png) · [clip](../proof-12/starts/away.mp4) |
| away-left | [last six 2×](../proof-12/road/away-left-last6-2x.png) · [clip](../proof-12/road/away-left.mp4) | [last six 2×](../proof-12/depot/away-left-last6-2x.png) · [clip](../proof-12/depot/away-left.mp4) | [first six 2×](../proof-12/starts/away-left-first6-2x.png) · [clip](../proof-12/starts/away-left.mp4) |
| away-right | [last six 2×](../proof-12/road/away-right-last6-2x.png) · [clip](../proof-12/road/away-right.mp4) | [last six 2×](../proof-12/depot/away-right-last6-2x.png) · [clip](../proof-12/depot/away-right.mp4) | [first six 2×](../proof-12/starts/away-right-first6-2x.png) · [clip](../proof-12/starts/away-right.mp4) |
| toward | [last six 2×](../proof-12/road/toward-last6-2x.png) · [clip](../proof-12/road/toward.mp4) | [last six 2×](../proof-12/depot/toward-last6-2x.png) · [clip](../proof-12/depot/toward.mp4) | [first six 2×](../proof-12/starts/toward-first6-2x.png) · [clip](../proof-12/starts/toward.mp4) |
| toward-left | [last six 2×](../proof-12/road/toward-left-last6-2x.png) · [clip](../proof-12/road/toward-left.mp4) | [last six 2×](../proof-12/depot/toward-left-last6-2x.png) · [clip](../proof-12/depot/toward-left.mp4) | [first six 2×](../proof-12/starts/toward-left-first6-2x.png) · [clip](../proof-12/starts/toward-left.mp4) |
| toward-right | [last six 2×](../proof-12/road/toward-right-last6-2x.png) · [clip](../proof-12/road/toward-right.mp4) | [last six 2×](../proof-12/depot/toward-right-last6-2x.png) · [clip](../proof-12/depot/toward-right.mp4) | [first six 2×](../proof-12/starts/toward-right-first6-2x.png) · [clip](../proof-12/starts/toward-right.mp4) |

[Per-cut measurements](../proof-12/results.json) · [all-frame acceptance assertions](../verification-12/acceptance.json) · [lockcheck](../verification-12/lockcheck.txt) · [walkstats](../verification-12/walkstats.txt) · [town67](../verification-12/town67.log) · [tests](../verification-12/tests.log) · [typecheck](../verification-12/typecheck.log) · [lint](../verification-12/lint.log) · [art](../verification-12/art.log).

## Reproduce and handoff

Run the generator using Python with Pillow, NumPy and SciPy. It also invokes the repo's Biome formatter. The five JSON files and debug sheets are deterministic. The generator uses no services.

With the task servers at API4317/game8080 and `VITE_API_BASE_URL=http://localhost:4317/api VITE_MUTE=1`, run `adventures/shadow-over-innsmouth/scripts/render-walk.mjs` with each retained `verification-12/{road,depot,starts}-plan.json`, `--out=tmp/walkqa/proof-12/<name> --session=walkqa12 --keep-frames --alpha-audit`. Then run `verification-12/review-cuts.py` and `verification-12/seam-grids.py`, followed by the unchanged reviewer checkers. Source captures are exact 24fps game-frame PNG sequences, encoded locally to the retained clips; there was no generated video. The first two start samples explicitly show standing-before-input and the immediate entry cut.

All task-created raw-frame staging directories are removed after the lossless 2× sheets, clips, telemetry, alpha distributions and verification records are retained. Task servers4317/8080 are stopped. Owner ports4410/8090 were not touched. No push, merge, deploy, GitHub settings change, key write or dotenv edit. All task commits carry the requested co-author trailer.
