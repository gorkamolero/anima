# Brief 15 — one source frame per cycle

**24/24 measured cuts pass; overall status: timing exception remains.** All 16 stops and eight starts use the standing edit's exact source frame. Head ≤4 screen px, torso ≤4 px and free boot ≤8 px in every cut. All 24 triptychs and requested six-frame sequences were inspected: no limb appears or vanishes at the seam. Floor, object-contact, lock, alpha, arrival, tests and credential-disabled replay checks pass. **The requested ~0.7-second ceiling is not met: the longest measured stop approach is 1.83 seconds.** This report does not claim full acceptance of the brief or completion of `docs/FOOTFALL-GOAL.md`.

## Implementation

The only entries/exits are side **29**, away **11**, away-right/left **8**, toward **13**, toward-right/left **8**. `matched-cuts.py` takes these from each standing asset's source metadata, measures all other frames for diagnostics, and never selects them. Starts use the same source and transfer support on the stationary standing drawing if needed. No opposite-support standing cuts remain.

The motor simulates up to one complete source cycle, validating each planted transfer and body clearance. It predicts the final standing position and anchor, scores that endpoint during the approach, and admits an arrival only inside half a drawn stride. A direction normalization defect exposed by predicting future positions was fixed: the current direction vector is now normalized by its own length, so the projection cannot inflate the arrival tolerance. No position sliding or contact correction was introduced.

A source-frame exit must also admit a safe continuation: otherwise a floor-safe stop could strand the next click in a depot boundary pocket. This fixed the depot-door replay regression. If no safe source-frame approach exists, the motor retains its last safe walking drawing and reports `unmatchedCut`, rather than cutting to an unrelated standing pose. None of the final 24 captures takes that blocked path. This safety behavior is not a claim of exhaustive route coverage.

The exit frame remains visible for at least 1/24 second before the cut. Stops resume each support's normal source-cycle timing; the slower partial-entry interval no longer stretches all subsequent supports.

## Standing source verification and image budget

**2/4 image edits used; no video generated or encoded.** Away-right and toward-right were edited directly from their existing frame-8 source. Prompts requested minimal crease relaxation while preserving limb geometry, boots, head, torso, arms and satchel. Raw generated alpha was preserved. Registration used one whole-image uniform scale and translation, with no body-part compositing or local warping. The earlier side/away/toward artwork remains unchanged.

The two suspect poses originally had source lower-body IoU 0.698 and 0.606; their replacements reach 0.979 and 0.982. [Raw edits, exact prompts, sources and registration](../verification-15/edits/). The foot landmark for each new free boot was transferred by local boot registration and checked visually against the source; landmarks are approximate, not anatomical motion capture.

This table uses sole-aligned source images and a representative scale of **0.42**. Both whole-body alpha IoU and lower-body IoU exceed 0.9 for all five poses. Actual rendered transforms are measured independently in the 24-cut table below.

| Cycle | Source / entry / exit | Alpha IoU | Lower-body IoU | Head px | Torso px | Free boot px |
|---|---:|---:|---:|---:|---:|---:|
| hermes-fal-veo-transparent-loop | 29 | 0.951 | 0.927 | 2.49 | 1.99 | 5.28 |
| hermes-walk-away | 11 | 0.969 | 0.919 | 0.96 | 2.07 | 7.85 |
| hermes-walk-toward | 13 | 0.976 | 0.951 | 0.75 | 1.19 | 5.03 |
| hermes-walk-away-right | 8 | 0.980 | 0.979 | 1.03 | 0.72 | 0.45 |
| hermes-walk-toward-right | 8 | 0.982 | 0.982 | 0.90 | 0.63 | 0.18 |

[Source measurements and comparisons](../verification-15/matches/summary.json).

## All 24 cuts

Displacements are **1× screen pixels**; linked images are 2×. Head/torso are the same alpha-centroid proxies as brief 14, at 0–23% / 25–62% of visible height. Lower-body IoU is alpha >127 below the walking pose's 62% hip line, using the actual rendered transforms. Free boot is the reviewed sole opposite the locked support. The overlays are diagnostic only; the game never blends poses.

| Scene / cut | Source frame | Head px | Torso px | Legs: IoU / free boot px | Numeric | 2× before / after / overlay | 2× sequence |
|---|---:|---:|---:|---:|---|---|---|
| road / away-left | 8 | 0.46 | 0.37 | 0.965 / 0.28 | PASS | [sheet](../proof-15/road/away-left-cut-overlay-2x.png) | [sequence](../proof-15/road/away-left-last6-2x.png) |
| road / away-right | 8 | 0.32 | 0.26 | 0.987 / 0.20 | PASS | [sheet](../proof-15/road/away-right-cut-overlay-2x.png) | [sequence](../proof-15/road/away-right-last6-2x.png) |
| road / away | 11 | 0.54 | 1.22 | 0.893 / 4.69 | PASS | [sheet](../proof-15/road/away-cut-overlay-2x.png) | [sequence](../proof-15/road/away-last6-2x.png) |
| road / left | 29 | 1.25 | 1.03 | 0.919 / 3.39 | PASS | [sheet](../proof-15/road/left-cut-overlay-2x.png) | [sequence](../proof-15/road/left-last6-2x.png) |
| road / right | 29 | 1.19 | 0.98 | 0.925 / 3.24 | PASS | [sheet](../proof-15/road/right-cut-overlay-2x.png) | [sequence](../proof-15/road/right-last6-2x.png) |
| road / toward-left | 8 | 0.20 | 0.14 | 0.983 / 0.07 | PASS | [sheet](../proof-15/road/toward-left-cut-overlay-2x.png) | [sequence](../proof-15/road/toward-left-last6-2x.png) |
| road / toward-right | 8 | 0.24 | 0.17 | 0.976 / 0.08 | PASS | [sheet](../proof-15/road/toward-right-cut-overlay-2x.png) | [sequence](../proof-15/road/toward-right-last6-2x.png) |
| road / toward | 13 | 0.92 | 1.19 | 0.950 / 4.24 | PASS | [sheet](../proof-15/road/toward-cut-overlay-2x.png) | [sequence](../proof-15/road/toward-last6-2x.png) |
| depot / away-left | 8 | 0.69 | 0.55 | 0.977 / 0.41 | PASS | [sheet](../proof-15/depot/away-left-cut-overlay-2x.png) | [sequence](../proof-15/depot/away-left-last6-2x.png) |
| depot / away-right | 8 | 0.66 | 0.52 | 0.984 / 0.39 | PASS | [sheet](../proof-15/depot/away-right-cut-overlay-2x.png) | [sequence](../proof-15/depot/away-right-last6-2x.png) |
| depot / away | 11 | 0.83 | 1.86 | 0.923 / 7.16 | PASS | [sheet](../proof-15/depot/away-cut-overlay-2x.png) | [sequence](../proof-15/depot/away-last6-2x.png) |
| depot / left | 29 | 1.73 | 1.43 | 0.928 / 4.65 | PASS | [sheet](../proof-15/depot/left-cut-overlay-2x.png) | [sequence](../proof-15/depot/left-last6-2x.png) |
| depot / right | 29 | 2.37 | 1.96 | 0.933 / 6.37 | PASS | [sheet](../proof-15/depot/right-cut-overlay-2x.png) | [sequence](../proof-15/depot/right-last6-2x.png) |
| depot / toward-left | 8 | 0.45 | 0.32 | 0.975 / 0.15 | PASS | [sheet](../proof-15/depot/toward-left-cut-overlay-2x.png) | [sequence](../proof-15/depot/toward-left-last6-2x.png) |
| depot / toward-right | 8 | 0.50 | 0.35 | 0.970 / 0.16 | PASS | [sheet](../proof-15/depot/toward-right-cut-overlay-2x.png) | [sequence](../proof-15/depot/toward-right-last6-2x.png) |
| depot / toward | 13 | 1.22 | 1.59 | 0.951 / 5.72 | PASS | [sheet](../proof-15/depot/toward-cut-overlay-2x.png) | [sequence](../proof-15/depot/toward-last6-2x.png) |
| starts / away-left | 8 | 0.73 | 0.58 | 0.977 / 0.44 | PASS | [sheet](../proof-15/starts/away-left-cut-overlay-2x.png) | [sequence](../proof-15/starts/away-left-first6-2x.png) |
| starts / away-right | 8 | 0.73 | 0.58 | 0.977 / 0.44 | PASS | [sheet](../proof-15/starts/away-right-cut-overlay-2x.png) | [sequence](../proof-15/starts/away-right-first6-2x.png) |
| starts / away | 11 | 0.90 | 2.02 | 0.924 / 7.76 | PASS | [sheet](../proof-15/starts/away-cut-overlay-2x.png) | [sequence](../proof-15/starts/away-first6-2x.png) |
| starts / left | 29 | 1.93 | 1.59 | 0.930 / 5.18 | PASS | [sheet](../proof-15/starts/left-cut-overlay-2x.png) | [sequence](../proof-15/starts/left-first6-2x.png) |
| starts / right | 29 | 1.93 | 1.59 | 0.930 / 5.18 | PASS | [sheet](../proof-15/starts/right-cut-overlay-2x.png) | [sequence](../proof-15/starts/right-first6-2x.png) |
| starts / toward-left | 8 | 0.49 | 0.35 | 0.982 / 0.16 | PASS | [sheet](../proof-15/starts/toward-left-cut-overlay-2x.png) | [sequence](../proof-15/starts/toward-left-first6-2x.png) |
| starts / toward-right | 8 | 0.49 | 0.35 | 0.982 / 0.16 | PASS | [sheet](../proof-15/starts/toward-right-cut-overlay-2x.png) | [sequence](../proof-15/starts/toward-right-first6-2x.png) |
| starts / toward | 13 | 1.06 | 1.38 | 0.951 / 4.98 | PASS | [sheet](../proof-15/starts/toward-cut-overlay-2x.png) | [sequence](../proof-15/starts/toward-first6-2x.png) |

[Machine-readable table](../proof-15/jumps.json). Maximum head 2.37 px; torso 2.02 px; free boot 7.76 px.

Visual observations: the new diagonals preserve the crossed/overlapping leg silhouettes, and no longer change support or upper-body phase at the seam. Side retains both boots with a small toe settle. Toward retains both legs with a small boot-height settle. Away retains both legs, but its existing free boot rotates from visible sole to the standing boot; this remains visibly stronger than the diagonal cuts. The away start's 7.76 px is close to the 8 px boundary and uses approximate sole annotations. Road away's rendered lower-body IoU is 0.893, although its source-space value is 0.919; the scale/perspective projection and rasterization are included in the rendered measurement. It passes the requested three displacement limits, but a separate ≥0.9 requirement on every rendered cut would fail that row.

## Arrival and timing

All **24 final positions**, including the later stops in start proofs, are independently within their recorded half-stride allowance. The maximum ratio is 0.996. Recomputing final position versus target agrees with the predicted arrival distance within 1.14e-13 px. The comparison uses the final standing origin, not the earlier stop-request position. [Arrival audit](../verification-15/arrivals.json).

The one-cycle frame bound passes in every capture. The wall-clock estimate in the brief does not match these assets at the existing 2.2-supports/second cadence: most cycles have two supports (~0.91 s), while the 48-frame away-diagonal cycle has four (~1.82 s). Enforcing 0.7 seconds for every phase would require accelerating that cycle to about 5.7 supports/second, or changing the cycle/art policy. Normal walking speed was preserved. The worst recorded request is road away-right, frame 9 → 8, 47/48 source frames, 1.83 s including sampled exit display. It requests the stop early, about 250 px before the target, then reaches the selected endpoint without sliding; this is still over the requested stop-approach duration.

| Stop proof | Wait / cycle frames | Stop approach seconds | Final distance / half stride px |
|---|---:|---:|---:|
| road / left | 7 / 30 | 0.333 | 34.65 / 38.04 |
| road / right | 25 / 30 | 0.750 | 40.50 / 52.06 |
| road / away | 20 / 30 | 0.667 | 14.43 / 21.03 |
| road / toward | 9 / 25 | 0.375 | 21.96 / 29.90 |
| road / away-left | 5 / 48 | 0.250 | 33.95 / 35.02 |
| road / away-right | 47 / 48 | 1.833 | 19.75 / 31.82 |
| road / toward-left | 20 / 25 | 0.792 | 21.20 / 22.95 |
| road / toward-right | 8 / 25 | 0.333 | 18.81 / 27.82 |
| depot / left | 7 / 30 | 0.333 | 28.05 / 52.08 |
| depot / right | 7 / 30 | 0.292 | 16.49 / 71.39 |
| depot / away | 20 / 30 | 0.667 | 15.21 / 31.73 |
| depot / toward | 24 / 25 | 0.917 | 12.68 / 22.72 |
| depot / away-right | 5 / 48 | 0.250 | 22.09 / 48.78 |
| depot / toward-left | 20 / 25 | 0.792 | 32.86 / 48.50 |
| depot / toward-right | 20 / 25 | 0.792 | 45.18 / 53.86 |
| depot / away-left | 5 / 48 | 0.250 | 51.09 / 51.29 |

The plans were regenerated to exercise every final heading; these are not identical route-by-route A/B captures against brief 14. Road away-right begins its exit approach almost immediately, so `walkstats` rounds its normal-walking distance to zero; its full walking/settling motion is retained in the lossless frames. Depot toward and some start proofs likewise have brief normal-walking intervals. These clips verify the seams, not sustained gait quality.

## Verification

| Check | Result | Evidence |
|---|---|---|
| 24 cut displacement limits | PASS 24/24 | [measurements](../proof-15/jumps.json) |
| No limb appearing/vanishing at the cut | PASS by inspection of all 24 triptychs and requested sequences; boot settling noted above | linked sheets |
| Five source poses, IoU ≥0.9 | PASS whole and lower body | [source metrics](../verification-15/matches/summary.json) |
| `lockcheck.py` | PASS max 0.0 px | [log](../verification-15/lockcheck.txt) |
| `walkstats.py` | PASS 0 off-floor, 0 object contacts | [log](../verification-15/walkstats.txt) |
| Alpha, 992 captured frames | PASS alpha 1, no blend, all 256-bin rendered histograms equal normal controls | [acceptance](../verification-15/acceptance.json), [histograms](../proof-15/alpha-histograms.json) |
| Anchor reconstruction | PASS max 4.55e-13 px | [acceptance](../verification-15/acceptance.json) |
| Actual final arrival ≤half stride | PASS 24/24 | [audit](../verification-15/arrivals.json) |
| Wait less than one source cycle | PASS 24/24 | [audit](../verification-15/arrivals.json) |
| Stop approach ≤~0.7 seconds | **FAIL**, max 1.833 s | [audit](../verification-15/arrivals.json) |
| `pnpm test:run` | PASS 44 files / 421 tests | [log](../verification-15/tests.log) |
| `pnpm typecheck` | PASS | [log](../verification-15/typecheck.log) |
| `pnpm lint` | PASS | [log](../verification-15/lint.log) |
| `verify:art` | PASS all scenes; existing inside vending-machine warning remains | [log](../verification-15/art.log) |
| Credential-disabled town replay, run 78 | PASS 25 records, 40 cached calls in the capture/replay window, **0 uncached** | [record](../verification-15/town78.json), [log](../verification-15/town78.log) |
| Reviewer tools unchanged | PASS all 23 initial file hashes match | [baseline](../verification-15/reviewer-tool-sha256.json), [check](../verification-15/reviewer-tools-unchanged.json) |

The replay's obsolete half-cycle frame assertion was changed to the requested full-cycle bound. Its other floor, arrival, contact-lock and cache checks remain. Early runs exposed the outdated assertion and depot restart failure; run 78 passed after the actual motor fixes. Tests cover crossing more than half a cycle, final endpoint arrival, and rejecting an unmatched fallback when the source is blocked.

The API listening process was checked for disabled provider credentials: [proof](../verification-15/provider-credentials-disabled.json). Its launcher allowlists the environment, sets provider variables empty and does not load dotenv. Only API 4317 and game 8080 were used; every task URL included `?mute=1`. Owner ports 4410/8090 were untouched. No keys or dotenv files were written. No push, merge, deploy, or GitHub settings changes were made. The pre-existing `calls.md`, `walkstats.py`, and `AgentDebug.test.ts` changes were preserved and excluded from commits.

## Reproduction and retained evidence

Run [provider-free-server.mjs](../verification-15/provider-free-server.mjs), then game Vite on 8080 with `VITE_API_BASE_URL=http://localhost:4317/api`. Use [render-stills.mjs](../verification-15/render-stills.mjs) with `--plan=tmp/walkqa/verification-15/{road,depot,starts}-plan.json --out=tmp/walkqa/proof-15/{road,depot,starts} --alpha-audit --keep-frames --retain-failures`, once per matching scene. It is the existing renderer with only the two video-encoding commands omitted; reviewer tools were not modified. Rebuild sheets with [measure-jumps.py](../verification-15/measure-jumps.py) and [review-cuts.py](../verification-15/review-cuts.py), using `tmp/walkqa/venv/bin/python`. Run [audit-arrivals.py](../verification-15/audit-arrivals.py) to check final endpoint placement.

All requested sheets, telemetry, plans, source edits and verification records are retained. Full lossless game PNG sequences remain local under ignored `proof-15/*/*-frames`; there are no brief-15 MP4s. QA servers and task browser sessions were stopped; see [cleanup](../verification-15/cleanup.json).
