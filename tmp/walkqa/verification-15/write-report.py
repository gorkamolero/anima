import json
from pathlib import Path
V=Path('tmp/walkqa/verification-15');P=Path('tmp/walkqa/proof-15');rows=json.loads((P/'jumps.json').read_text());arr=json.loads((V/'arrivals.json').read_text());a=json.loads((V/'acceptance.json').read_text());matches=json.loads((V/'matches/summary.json').read_text())
text='''# Brief 15 — one source frame per cycle

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
'''
for m in matches:
 r=m['exits'][0];text+=f"| {m['cycle']} | {r['frame']} | {r['alphaIoU']:.3f} | {r['lowerBodyIoU']:.3f} | {r['headPx']*.42:.2f} | {r['torsoPx']*.42:.2f} | {r['freeFootPx']*.42:.2f} |\n"
text+='''
[Source measurements and comparisons](../verification-15/matches/summary.json).

## All 24 cuts

Displacements are **1× screen pixels**; linked images are 2×. Head/torso are the same alpha-centroid proxies as brief 14, at 0–23% / 25–62% of visible height. Lower-body IoU is alpha >127 below the walking pose's 62% hip line, using the actual rendered transforms. Free boot is the reviewed sole opposite the locked support. The overlays are diagnostic only; the game never blends poses.

| Scene / cut | Source frame | Head px | Torso px | Legs: IoU / free boot px | Numeric | 2× before / after / overlay | 2× sequence |
|---|---:|---:|---:|---:|---|---|---|
'''
for r in rows:
 scene,d=r['scene'],r['heading'];prefix=f'../proof-15/{scene}/{d}';seq='first6' if scene=='starts' else 'last6'
 text+=f"| {scene} / {d} | {r['walkFrame']} | {r['headScreenPx']:.2f} | {r['torsoScreenPx']:.2f} | {r['lowerBodyIoU']:.3f} / {r['freeFootScreenPx']:.2f} | {'PASS' if r['withinTargets'] else 'FAIL'} | [sheet]({prefix}-cut-overlay-2x.png) | [sequence]({prefix}-{seq}-2x.png) |\n"
text+='''
[Machine-readable table](../proof-15/jumps.json). Maximum head 2.37 px; torso 2.02 px; free boot 7.76 px.

Visual observations: the new diagonals preserve the crossed/overlapping leg silhouettes, and no longer change support or upper-body phase at the seam. Side retains both boots with a small toe settle. Toward retains both legs with a small boot-height settle. Away retains both legs, but its existing free boot rotates from visible sole to the standing boot; this remains visibly stronger than the diagonal cuts. The away start's 7.76 px is close to the 8 px boundary and uses approximate sole annotations. Road away's rendered lower-body IoU is 0.893, although its source-space value is 0.919; the scale/perspective projection and rasterization are included in the rendered measurement. It passes the requested three displacement limits, but a separate ≥0.9 requirement on every rendered cut would fail that row.

## Arrival and timing

All **24 final positions**, including the later stops in start proofs, are independently within their recorded half-stride allowance. The maximum ratio is 0.996. Recomputing final position versus target agrees with the predicted arrival distance within 1.14e-13 px. The comparison uses the final standing origin, not the earlier stop-request position. [Arrival audit](../verification-15/arrivals.json).

The one-cycle frame bound passes in every capture. The wall-clock estimate in the brief does not match these assets at the existing 2.2-supports/second cadence: most cycles have two supports (~0.91 s), while the 48-frame away-diagonal cycle has four (~1.82 s). Enforcing 0.7 seconds for every phase would require accelerating that cycle to about 5.7 supports/second, or changing the cycle/art policy. Normal walking speed was preserved. The worst recorded request is road away-right, frame 9 → 8, 47/48 source frames, 1.83 s including sampled exit display. It requests the stop early, about 250 px before the target, then reaches the selected endpoint without sliding; this is still over the requested stop-approach duration.

| Stop proof | Wait / cycle frames | Stop approach seconds | Final distance / half stride px |
|---|---:|---:|---:|
'''
for r in arr:
 if r['scene']=='starts':continue
 text+=f"| {r['scene']} / {r['heading']} | {r['waitFrames']} / {r['cycleFrames']} | {r['settlingSeconds']:.3f} | {r['actualDistance']:.2f} / {r['halfStride']:.2f} |\n"
text+=f'''
The plans were regenerated to exercise every final heading; these are not identical route-by-route A/B captures against brief 14. Road away-right begins its exit approach almost immediately, so `walkstats` rounds its normal-walking distance to zero; its full walking/settling motion is retained in the lossless frames. Depot toward and some start proofs likewise have brief normal-walking intervals. These clips verify the seams, not sustained gait quality.

## Verification

| Check | Result | Evidence |
|---|---|---|
| 24 cut displacement limits | PASS 24/24 | [measurements](../proof-15/jumps.json) |
| No limb appearing/vanishing at the cut | PASS by inspection of all 24 triptychs and requested sequences; boot settling noted above | linked sheets |
| Five source poses, IoU ≥0.9 | PASS whole and lower body | [source metrics](../verification-15/matches/summary.json) |
| `lockcheck.py` | PASS max 0.0 px | [log](../verification-15/lockcheck.txt) |
| `walkstats.py` | PASS 0 off-floor, 0 object contacts | [log](../verification-15/walkstats.txt) |
| Alpha, {a['frames']} captured frames | PASS alpha 1, no blend, all 256-bin rendered histograms equal normal controls | [acceptance](../verification-15/acceptance.json), [histograms](../proof-15/alpha-histograms.json) |
| Anchor reconstruction | PASS max {a['maxAnchorError']:.3g} px | [acceptance](../verification-15/acceptance.json) |
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

Run [provider-free-server.mjs](../verification-15/provider-free-server.mjs), then game Vite on 8080 with `VITE_API_BASE_URL=http://localhost:4317/api`. Use [render-stills.mjs](../verification-15/render-stills.mjs) with `--plan=tmp/walkqa/verification-15/{{road,depot,starts}}-plan.json --out=tmp/walkqa/proof-15/{{road,depot,starts}} --alpha-audit --keep-frames --retain-failures`, once per matching scene. It is the existing renderer with only the two video-encoding commands omitted; reviewer tools were not modified. Rebuild sheets with [measure-jumps.py](../verification-15/measure-jumps.py) and [review-cuts.py](../verification-15/review-cuts.py), using `tmp/walkqa/venv/bin/python`. Run [audit-arrivals.py](../verification-15/audit-arrivals.py) to check final endpoint placement.

All requested sheets, telemetry, plans, source edits and verification records are retained. Full lossless game PNG sequences remain local under ignored `proof-15/*/*-frames`; there are no brief-15 MP4s. QA servers and task browser sessions were stopped; see [cleanup](../verification-15/cleanup.json).
'''
Path('tmp/walkqa/reports/15-single-exit.md').write_text(text)
