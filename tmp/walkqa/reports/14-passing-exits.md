# Brief 14 — passing exits, legs included

**Status: NOT ACCEPTED.** The passing-frame policy, five replacement standing edits, 16 stop proofs and eight start proofs are implemented. **11/24 cuts meet the numeric head/torso/free-boot limits; 13/24 fail.** Several opposite-support cuts visibly change the leg silhouette and upper-body pose. The no-limb-pop requirement is not satisfied globally. This is an unfinished visual correction, not completion of `docs/FOOTFALL-GOAL.md`.

The specific side failure from F19 is improved: the captured side stops now cut at frame 29 instead of wide-stride frame 24. Both legs remain visible; free-boot motion is 2.79–5.09 screen px in the four stops and 5.18 px in both starts. Toward frame 13 also passes. Rear/opposite-support failures remain substantial and some upper-body jumps are worse than brief 13. All eight permitted image edits have been used; no further calls were made.

## Changes

`matched-cuts.py` restricts exits and entries to visually reviewed passing candidates. It ranks the lower body first with `100*(1-lowerBodyIoU) + freeBootPx + 0.25*bootSpreadPx`, then head-plus-torso as a secondary sort key. It chooses the best passing exit for each anatomical foot and each contiguous support interval. Entry candidates need at least two remaining support frames. Side frame 24 is excluded. No poor wide-stride frame is inserted merely to fill coverage gaps.

The raw tracker sometimes follows a shin or duplicates the planted contact for the swing foot. Passing candidates therefore have separately reviewed boot-sole landmarks (`reviewedFreeBootSoles`), with boot-grid evidence retained. Existing walking contact tracks and root motion were not changed. Ranking values for ineligible frames still use the old tracker and are diagnostic only.

Five new `hermes-passing-stand-*` sheets replace runtime use of `hermes-matched-stand-*`. All superseded sheets remain in the repository. Sources are side 29, away 11, away-right 8, toward 13 and toward-right 8. Each was an image edit of that exact source, requesting only legs/feet changes and preservation of head, torso, satchel and arms. Generated results do not perfectly obey that request: residual upper-body and knee changes are visible. Registration preserves generated alpha and applies one whole-image uniform scale plus translation, without part-specific warping or painting source body parts over the edit. Scales were 1.02 (side/away/toward/toward-right) and 1.025 (away-right); every trial is recorded in [normalization.json](../verification-14/edits/normalization.json).

A motor timing defect also surfaced: accumulated walk time could enter and cut past the selected exit between captured frames. The motor now resets elapsed time when it reaches a selected matched exit and holds that frame for at least 1/24 second. A regression test covers two 60 Hz updates before the cut.

## Three-region measurements and every cut sheet

All displacements below are **screen pixels at 1×**, although the sheets are 2×. Head and torso use alpha-weighted silhouette centroids in the visible-height bands 0–23% and 25–62%. These are reproducible silhouette proxies, not face/joint trackers. Lower-body IoU uses alpha >127 below the walking pose's 62% hip line, projected using each actual rendered transform. The free boot is the anatomical foot opposite the locked support foot; displacement uses the reviewed sole points and actual before/after transforms. Sole annotations are approximate image landmarks, with a few source pixels of uncertainty; borderline values such as 7.76 px should not be treated as high-confidence visual approval.

`PASS` means head ≤4, torso ≤4, and free boot ≤8. No arbitrary IoU cutoff was invented: IoU is reported for inspection. A numeric pass does not establish limb continuity or a natural knee settle. The overlays are diagnostic composites only; the game never blends the poses. Starts measure standing → first walking frame, not their later stop.

| Scene / cut | Walk frame | Head px | Torso px | Legs: IoU / free boot px | Numeric | 2× before / after / overlay | 2× six-frame sequence |
|---|---:|---:|---:|---:|---|---|---|
| road / away-left | 21 | 20.85 | 21.92 | 0.378 / 47.86 | FAIL | [sheet](../proof-14/road/away-left-cut-overlay-2x.png) | [sequence](../proof-14/road/away-left-last6-2x.png) |
| road / away-right | 44 | 18.41 | 21.42 | 0.415 / 56.39 | FAIL | [sheet](../proof-14/road/away-right-cut-overlay-2x.png) | [sequence](../proof-14/road/away-right-last6-2x.png) |
| road / away | 0 | 10.20 | 14.10 | 0.522 / 16.46 | FAIL | [sheet](../proof-14/road/away-cut-overlay-2x.png) | [sequence](../proof-14/road/away-last6-2x.png) |
| road / left | 29 | 1.25 | 1.03 | 0.919 / 3.41 | PASS | [sheet](../proof-14/road/left-cut-overlay-2x.png) | [sequence](../proof-14/road/left-last6-2x.png) |
| road / right | 29 | 1.03 | 0.85 | 0.937 / 2.79 | PASS | [sheet](../proof-14/road/right-cut-overlay-2x.png) | [sequence](../proof-14/road/right-last6-2x.png) |
| road / toward-left | 7 | 3.74 | 2.98 | 0.763 / 1.92 | PASS | [sheet](../proof-14/road/toward-left-cut-overlay-2x.png) | [sequence](../proof-14/road/toward-left-last6-2x.png) |
| road / toward-right | 7 | 4.13 | 3.29 | 0.760 / 2.12 | FAIL | [sheet](../proof-14/road/toward-right-cut-overlay-2x.png) | [sequence](../proof-14/road/toward-right-last6-2x.png) |
| road / toward | 13 | 0.92 | 1.19 | 0.950 / 4.24 | PASS | [sheet](../proof-14/road/toward-cut-overlay-2x.png) | [sequence](../proof-14/road/toward-last6-2x.png) |
| depot / away-left | 44 | 27.45 | 32.03 | 0.416 / 84.10 | FAIL | [sheet](../proof-14/depot/away-left-cut-overlay-2x.png) | [sequence](../proof-14/depot/away-left-last6-2x.png) |
| depot / away-right | 44 | 25.22 | 29.43 | 0.414 / 77.27 | FAIL | [sheet](../proof-14/depot/away-right-cut-overlay-2x.png) | [sequence](../proof-14/depot/away-right-last6-2x.png) |
| depot / away | 11 | 0.74 | 1.67 | 0.925 / 6.41 | PASS | [sheet](../proof-14/depot/away-cut-overlay-2x.png) | [sequence](../proof-14/depot/away-last6-2x.png) |
| depot / left | 29 | 1.90 | 1.56 | 0.929 / 5.09 | PASS | [sheet](../proof-14/depot/left-cut-overlay-2x.png) | [sequence](../proof-14/depot/left-last6-2x.png) |
| depot / right | 29 | 1.90 | 1.56 | 0.929 / 5.09 | PASS | [sheet](../proof-14/depot/right-cut-overlay-2x.png) | [sequence](../proof-14/depot/right-last6-2x.png) |
| depot / toward-left | 19 | 14.85 | 17.83 | 0.363 / 29.73 | FAIL | [sheet](../proof-14/depot/toward-left-cut-overlay-2x.png) | [sequence](../proof-14/depot/toward-left-last6-2x.png) |
| depot / toward-right | 19 | 16.50 | 19.81 | 0.363 / 33.02 | FAIL | [sheet](../proof-14/depot/toward-right-cut-overlay-2x.png) | [sequence](../proof-14/depot/toward-right-last6-2x.png) |
| depot / toward | 0 | 10.43 | 10.34 | 0.808 / 1.58 | FAIL | [sheet](../proof-14/depot/toward-cut-overlay-2x.png) | [sequence](../proof-14/depot/toward-last6-2x.png) |
| starts / away-left | 30 | 5.66 | 6.36 | 0.767 / 21.77 | FAIL | [sheet](../proof-14/starts/away-left-cut-overlay-2x.png) | [sequence](../proof-14/starts/away-left-first6-2x.png) |
| starts / away-right | 30 | 5.66 | 6.36 | 0.767 / 21.77 | FAIL | [sheet](../proof-14/starts/away-right-cut-overlay-2x.png) | [sequence](../proof-14/starts/away-right-first6-2x.png) |
| starts / away | 11 | 0.90 | 2.02 | 0.924 / 7.76 | PASS | [sheet](../proof-14/starts/away-cut-overlay-2x.png) | [sequence](../proof-14/starts/away-first6-2x.png) |
| starts / left | 29 | 1.93 | 1.59 | 0.930 / 5.18 | PASS | [sheet](../proof-14/starts/left-cut-overlay-2x.png) | [sequence](../proof-14/starts/left-first6-2x.png) |
| starts / right | 29 | 1.93 | 1.59 | 0.930 / 5.18 | PASS | [sheet](../proof-14/starts/right-cut-overlay-2x.png) | [sequence](../proof-14/starts/right-first6-2x.png) |
| starts / toward-left | 7 | 5.52 | 4.43 | 0.763 / 2.84 | FAIL | [sheet](../proof-14/starts/toward-left-cut-overlay-2x.png) | [sequence](../proof-14/starts/toward-left-first6-2x.png) |
| starts / toward-right | 7 | 5.52 | 4.43 | 0.763 / 2.84 | FAIL | [sheet](../proof-14/starts/toward-right-cut-overlay-2x.png) | [sequence](../proof-14/starts/toward-right-first6-2x.png) |
| starts / toward | 13 | 1.06 | 1.38 | 0.951 / 4.98 | PASS | [sheet](../proof-14/starts/toward-cut-overlay-2x.png) | [sequence](../proof-14/starts/toward-first6-2x.png) |

Machine-readable table: [jumps.json](../proof-14/jumps.json). All 24 triptychs, all 16 stop six-frame sheets and all eight start six-frame sheets were visually inspected.

## Visible exceptions

- **Away diagonals, stops:** road frames 21/44 and depot frame 44 use a different support/arm phase from the frame-8 edit. Sole locking is exact, but the standing body moves and the free leg changes position. Worst case: depot away-left, head 27.45 px, torso 32.03 px, free boot 84.10 px, IoU 0.416. The corresponding linked overlays show this clearly. These are regressions, not tolerable settles.
- **Away diagonals, starts:** the legs-first ranking chooses frame 30. The edit still contains the frame-8 upper body and a different knee arrangement. Both starts fail at 21.77 px free-boot displacement, with head/torso also over target.
- **Away, road stop:** frame 0 is the opposite-support passing pose. It fails all displacement limits; depot frame 11 and the frame-11 entry are closer to the source edit and pass numerically. The heel/sole rotation remains visible in the latter sequences.
- **Toward diagonals:** source-near frame 7 preserves the boot position fairly well but straightening the knee changes the silhouette (IoU around 0.76). Road toward-left is a numeric pass, not an unqualified visual pass. Road toward-right misses head by 0.13 px; both starts miss head and torso. Depot frame 19 is the opposite-support pose and fails conspicuously (free boot 29.73/33.02 px, IoU 0.363).
- **Toward, depot stop:** frame 0 has close boot positions (free boot 1.58 px), but head and torso each move about 10 px and the arms/satchel change phase. The frame-13 road stop and start pass.
- **Side:** all six measured cuts pass and retain both legs. The free leg still straightens at the cut; the sequence and IoU make that visible rather than hiding it behind a torso-only score.

One standing edit per cycle is insufficient for several opposite-support passing poses. Distinct support-specific standing art, preserving each selected exit's own upper body, is the remaining art/runtime task. The current replacements remain wired on this development branch for review, despite the failures. They should not be regarded as accepted production artwork.

## Frame coverage

The half-cycle stop cap and floor-safe fallback are retained. These 24 captures used matched cuts with no fallback. Exhaustive phase coverage is **not** solved: side and away have gaps under the cap. The passing filter does not silently admit a wide-stride frame to conceal those gaps.

| Cycle | Exits | Entries, ranked | Half-cycle cap | Longest next-exit wait | Uncovered starting phases |
|---|---|---|---:|---:|---|
| hermes-walk-away | 11, 0 | 11, 12, 0, 1 | 15 | 18 | 12, 13, 14 |
| hermes-walk-away-right | 30, 21, 8, 44 | 30, 8, 29, 9, 21, 44 | 24 | 13 | none |
| hermes-fal-veo-transparent-loop | 11, 29 | 29, 28, 11 | 15 | 17 | 12, 13 |
| hermes-walk-toward-right | 7, 19 | 7, 8, 19 | 12 | 12 | none |
| hermes-walk-toward | 13, 0 | 13, 0, 12, 24 | 12 | 12 | none |

Plans were regenerated for the new frame lists; these are not identical route-by-route A/B captures against brief 13. Depot away-right starts settling almost immediately (one normal walking sample), then advances through the final support interval to frame 44; its cut is real but its `walkstats` normal-walking distance rounds to zero. This limits that clip's value as a sustained-walking proof.

## Verification

| Check | Result | Evidence |
|---|---|---|
| `lockcheck.py`, 24 clips | PASS, maximum reported excursion 0.0 px | [log](../verification-14/lockcheck.txt) |
| `walkstats.py`, 24 clips | PASS, 0 off-floor samples, 0 object contacts | [log](../verification-14/walkstats.txt) |
| Alpha, all 708 captured frames | PASS, alpha 1, no blend; every rendered 256-bin alpha histogram equals the normal control | [acceptance](../verification-14/acceptance.json), [selected-frame histograms](../proof-14/alpha-histograms.json) |
| Runtime planted-anchor reconstruction | PASS, max 4.55e-13 px | [acceptance](../verification-14/acceptance.json) |
| Head/torso/free-foot targets | **FAIL, 11/24 numeric passes** | table above |
| No limb appearing/vanishing or popping | **FAIL globally** | all linked cut sheets |
| `pnpm test` | PASS, 44 files / 418 tests | [log](../verification-14/tests.log) |
| `pnpm typecheck` | PASS | [log](../verification-14/typecheck.log) |
| `pnpm lint` | PASS | [log](../verification-14/lint.log) |
| `pnpm verify:art` | PASS all scenes; existing inside vending-machine scale warning remains | [log](../verification-14/art.log) |
| Final saved town replay, run 73 | PASS, 25 records, 17 cached calls, **0 uncached calls**, no error | [record](../verification-14/town73.json), [log](../verification-14/town73.log) |
| Reviewer tools unchanged by this brief | PASS, 23 file hashes match the starting working tree | [baseline](../verification-14/reviewer-tool-sha256.json), [check](../verification-14/reviewer-tools-unchanged.json) |

The pre-existing uncommitted `walkstats.py`, `calls.md`, and `AgentDebug.test.ts` changes were preserved and excluded from this brief's commits. The test total includes that existing test file.

The API was launched on 4317 with an allowlisted environment and explicit empty provider variables, without dotenv loading. The actual listening process was checked for nonempty provider credentials before replay: [credential-disabled proof](../verification-14/provider-credentials-disabled.json), [launcher](../verification-14/provider-free-server.mjs). Runs 72 and 73 both used this disabled process; run 73 verifies the final assets/metadata. Game used 8080 and `?mute=1`. No keys or dotenv files were written. Owner ports 4410/8090 were untouched. QA servers and task browser sessions were stopped: [cleanup](../verification-14/cleanup.json).

## Budget and retained evidence

**8/8 image edits, zero generated video.** Side 2 attempts, away 1, away-right 2, toward 2, toward-right 1. Selected attempts: side 2, away 1, away-right 2, toward 2, toward-right 1. All calls used the built-in image editor with the extracted source frame. Exact prompts, raw outputs (including superseded attempts), sources and registered comparisons are retained in [edits](../verification-14/edits/). No replay made a paid generation call. No additional retry was made after reaching eight.

The 24 MP4s are locally encoded game proof clips, not generated animation; the walking videos/sheets were not regenerated. All requested 2× cut and sequence sheets, telemetry, plans, measurements and check logs are committed. Full original capture PNG sequences remain locally in ignored `proof-14/*/*-frames` directories as verification records; the committed six-frame sheets use those lossless captures, while MP4s are compressed playback copies.

Reproduction uses `verification-14/provider-free-server.mjs`, then the game on port 8080, followed by `render-walk.mjs --plan=tmp/walkqa/verification-14/{road,depot,starts}-plan.json --out=tmp/walkqa/proof-14/{road,depot,starts} --alpha-audit --keep-frames --retain-failures` (one matching scene per invocation). Run `verification-14/measure-jumps.py` and `review-cuts.py` with `tmp/walkqa/venv/bin/python`. Town replay: `node adventures/shadow-over-innsmouth/scripts/playtest-town.mjs 'http://localhost:8080/?mute=1' --run=73 --replay`, only against the credential-disabled API. Stop both QA servers afterward.

No push, merge, deployment or GitHub settings changes were made.
