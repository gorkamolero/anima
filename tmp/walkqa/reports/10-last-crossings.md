# Brief 10 — last crossings

Status: brief 10 and 10c acceptance checks complete; final evidence is under `proof-10c/`. Branch `open-world-mvp`. Earlier sections below preserve the investigation chronology.

Reviewer decisions accepted: one additional measured dock reconstruction attempt; cadence n/a below three switches; near/far arrival at the corresponding floor extremum.

Budget: 0/20 segmentation calls. No image/video generation. Existing dirty `calls.md`, reviewer `walkstats.py` update and untracked `AgentDebug.test.ts` preserved. No dotenv writes, remote publication or deployment.

## Investigation

The requested direct checker reproduces outside-left 11/12 off-floor and contact samples, and also flags road-left pairs. Exit clips span two different locations but contain only the source location's `area.json`. Investigating samples against their own location geometry before changing a route or claiming these are physical contacts. Prior report used location-split samples without explaining this distinction.

Two frozen frames are recorded at outside-left combined frames 238/239. Timing investigation in progress.

## Confirmed diagnoses

- `verification-10/outside-left-flagged-frames.json` lists all 23 flagged source-clip frames with projected sole coordinates. All are on their actual destination floor, with zero actual object contacts. The source-room mask caused the 11/12 flags. New captures now embed an `areas` map keyed by location; walkstats selects each visible sample's actual room. Thresholds and the reviewer's >=3-switch cadence rule are preserved.
- Original identical decoded images at combined frames 238/239 have advancing source frames 4/5 and advancing positions. `verification-10/freeze-238.png` shows complete tree occlusion. This is not a held animation pose; raw identical-image acceptance remains to be resolved explicitly.
- Initial per-column ground measurements: `verification-10/dock-columns-initial.json`. Net rear band y705–720 is 0.4436 m in camera ground depth, about 0.449–0.470 m along the fixed-screen-column ray. A too-narrow artwork claim is disproved for that strip.
- Physical-clearance defect: screen-circular dilation was using lateral pixels/metre for front-to-back metres as well. Both the object's 0.15 m support strip and the character's 0.15 m clearance radius now project through ground coordinates. Planted contact is also the vertical reference for body-floor clearance, avoiding sprite-padding/bob excluding a legal sole position.
- Near/far spawn selection uses the extremal reachable floor row. Contact-based placement and an initial inward heading ensure the first stance faces away for near entries and toward for far entries. All pairs still require final recapture and visual review.

## Final implementation and recapture boundary

Motion implementation: `313fcc4`, `d381ad2`, `2256164`, `ca5f00a`. Capture/checking: `0c064d3`, `29f3945`. All carry the required Claude co-author trailer.

Final proof is `proof-10/`, recaptured after the cadence and render-synchronous sampling corrections. Prior `diagnostic-10-*` folders are failed/intermediate diagnostics, not acceptance evidence. Waypoints retain full walking motion; excessive idle tails were shortened. The road tree rear target is x150,y812 so the crossing does not inadvertently enter the actual left exit region.

The final clock requests 2.2 steps/s (all five source cycle configurations are also within 1.6–2.2; `verification-10/cycle-rates.json`). Before the change, exactly-three-switch bench and pergola approaches still measured 1.36–1.57, outside the reviewer's short-clip waiver. Final simulation of every crossing leg passes the unchanged >=3-switch estimator. Recorded proof is still being checked.

Capture telemetry now samples synchronously immediately after the rendered subframe, before awaited transition logic can reveal Hermes. A regression test reproduces an asynchronous visibility change and proves that the logged state belongs to the pixels. Destination floor capture also waits for the visible, loaded destination, not just a changed location ID.

Town run 39 passed with 0 uncached calls, before the final clock/capture changes. Run 40 is the final regression in progress. The initial run 38 failed because the API was mistakenly started at its default port; it was stopped and replaced with explicit API 4317 and game 8080, without dotenv edits. All final proof uses the required ports and mute=1.

## 10c — flat depot and sprite Kat

In progress. The owner selected `bus-station-flat-v1.png`; the prior composite and data remain archived. Derivation, placement, crossings and final acceptance are pending. The shared 10/10c segmentation/depth budget starts at 0/30; image edits 0/2, no video generation. Pre-existing `calls.md`, accepted `walkstats.py`, and untracked `AgentDebug.test.ts` are preserved.

### 10c implementation progress

- `939a514` enforces a shared 30-call 10/10c limit and two image-edit limit. Actual use so far: 18 segmentation/depth requests, zero image edits. The first new call is numbered 2 because the first reservation counted the legacy `CALL 10` row; matching was corrected before later work. Count the scoped rows, not the last ordinal.
- `dfcdf79` switches the live exterior and API edit base to the flat shot, removes the incompatible vehicle overlay, adds derived floor/perspective/occluders/exits/landmarks, remaps authored hotspots while retaining ids/actions, shows seated Kat with depth ordering and an excluded seat-to-boot footprint.
- `ec6b28f` refines the floor from original SAM masks at 384x216 minus segmented objects/water, avoiding coarse depth/shadow rejection and double clearance erosion. Ships the floor beside the art so the anchor does not depend on an untracked perception cache. Existing generated place images are untouched.
- Initial placement inspected: `verification-10c/kat-initial.png`. Art verification passed both anchors (`verification-10c/art.log`). 399 tests passed; typecheck passed. JSON formatting lint errors corrected; final lint pending.
- First rear-strip reconstruction failed reachability; original cached SAM masks retain visible shadowed ground that the coarse pipeline removed. Second reconstruction reaches rear bench and net positions in simulation. Final capture and measurements pending.
- `proof-10c` captures are in progress. Initial depot crossing capture is diagnostic, not acceptance: its last net legs did not move. A source refresh was initially suspected, but a settled repeat reproduced the failure: the plan targeted y835 inside Kat’s excluded footprint and approached a cramped bench/post pocket. That diagnostic route did not pass. The final plan uses valid rear-floor targets at y747, approached from the left; all its legs move and pass.
- Town replay now has a saved-connection `--replay` mode, retaining the default narrative/edit journey. It walks the existing depot/road/alley/interior with hotspot/mask matching, Kat depth and perspective checks, live art checks and an explicit zero-uncached-call assertion. The first attempt exposed a walk target whose stride could enter the right exit; the floor-walk target margin is being corrected. No substitute town or generated image is created by this replay mode.


### 10c final result

The flat image is the exterior render and new-location edit base, scaled to 1920×1080. Existing generated places retain their stored images. The composite and its data remain in the repository but are no longer live exterior dependencies. The incompatible vehicle overlay is removed. The shipped geometry is derived from segmentation/depth and cached native masks, including small mooring posts, bench, suitcase, nets, pergola, van and house. The final horizon is 475.2 and slope 0.0018361137341307311; the matching `landmarks.json` passes art verification.

Kat is an independent seatedIdle/seatedTalk sprite at x920, y924.479, scale0.375302, depth56.224. Her hips rest on the seat and her boots project onto the boards. Her seat-to-boot footprint is excluded from the walk area. Runtime depth orders her against Hermes and the bench. Placement, front/behind overlaps and baseline transitions were inspected in rendered frames.

Final implementation commits also include `119ffff` (saved-town replay and shipped anchor geometry loading), `7cadcf4` (legacy QA entry points delegate to the shared replay), and `1649f2a` (QA lint). The unrelated concurrent `b717e16` was preserved. Original brief-10 commits stand. Legacy QA entry points now exercise the updated shared checks instead of retaining obsolete composite coordinates; hotspot and scale assertions are present in `playtest-town.mjs`.

### Final acceptance evidence

All paths below are relative to `tmp/walkqa/`. `proof-10c/results.json` contains the aggregate and per-clip measurements.

| Check | Final result |
| --- | --- |
| Final clips | 29: 9 depot legs, 4 road crossing legs, 16 exit legs |
| Planted-foot lockcheck | Maximum 0.00 px at checker precision; limit 1 px |
| Off-floor / object contacts | 0 / 0 across all clips |
| Frozen walking frames | 0 across all clips |
| Measurable cadence | 1.67–2.09 steps/s; fewer than 3 switches remains n/a under the accepted rule |
| Exit transitions | All 16 legs have one location change and walking arrival frames |
| Tests | 399 passed, 42 files |
| Typecheck / lint / verify:art | Pass / pass / both anchors pass |
| Saved-town replay 44 | Pass; 23 cached calls, 0 uncached |
| Shared 10 + 10c budget | 18/30 segmentation/depth requests; 0/2 image edits; 0 generated video |

Logs: `verification-10c/{tests-final,typecheck-final,lint-final,art-final,town44}.log`, `lockcheck.txt`, `freeze.txt`, `crossings-walkstats.txt`, `exits-walkstats.txt`. Art verification retains the pre-existing interior vending-machine exclusion warning. Town replay command is `node adventures/shadow-over-innsmouth/scripts/playtest-town.mjs --replay`; it traverses saved depot/road/alley/interior connections with floor, scale, arrival, hotspot/mask and Kat checks. The default narrative/image-edit journey remains available and was not rerun in 10c.

### Rear-strip measurements and visual proof

`verification-10c/rear-strip-measurements.json` measures each 5px column in perspective ground metres against the 0.3–0.4m diameter. Bench: 61/61 columns accommodate 0.4m, widths0.462–2.074m. Nets: 51/55 accommodate 0.4m, widths0.369–1.639m; the passing route uses the connected adequate portion. Dock: 107/107 accommodate 0.4m, widths1.064–2.775m. The strip is not classified as an artwork limitation. Annotated 2× measurements are `verification-10c/{bench,net,dock}-measured-strips-2x.png`.

- Required inspected geometry overlay: `derivation/outside-flat-overlay.png`. Green is reconstructed floor, cyan is body walk area, red is object/Kat footprints, orange baselines, purple exits, yellow horizon. Reconstructed floor behind occluders intentionally differs from visible floor.
- Full depot motion: `proof-10c/roundtrips/depot/roundtrip.mp4`; individual legs and 6fps sheets in `proof-10c/crossings/depot/`. Final plan: `verification-10c/plans/depot-left-roundtrip.json`.
- Kat front/behind alpha-overlap and 2× crops: `proof-10c/review/kat-front-*`, `kat-behind-*`, and `kat-baseline-*`. In particular `kat-behind-maximum-0444-2x.png` shows the rear overlap. Initial seated placement: `verification-10c/kat-initial.png`.
- Bench, nets and pergola entry/maximum/exit and baseline frames: `proof-10c/review/{bench,nets-2,pergola}-*`. Alpha scan records: `verification-10c/crossing-review.json`. Inspected baseline-neighbour triples and overlap maxima show the correct front/behind draw order.
- Road tree/trap recaptures: `proof-10c/crossings/road/`, with alpha scans in `verification-10c/road-crossing-review.json` and review crops beside their clips.
- Depot left exit: `proof-10c/exits/outside-left/{out,back}.mp4`, `review-sheet.png`, `{out,back}-arrival-2x.png`; both directions have 0 off-floor and 0 contacts.
- Remaining exit/arrival proofs: `proof-10c/exits/{outside-right,depot-door,road-left,road-left-1,road-left-2,road-far,alley-far}/`. The far/near review sheets and arrival crops were inspected for position, scale and inward heading. Arrival records: `verification-10c/proof-exits-review.json`.
- Five deterministic random visible walking foot frames per clip were inspected in `proof-10c/review/feet-random-{1,2,3,4,5,6}.png`; selection records are `verification-10c/random-feet.json`.

`diagnostic-10c-initial/` and `diagnostic-10c-second/` remain failed diagnostic evidence, not acceptance. The final proof demonstrates the required connected crossings; it does not claim that the earlier invalid-footprint waypoint or every arbitrary approach through the bench/post pocket succeeds.

## Reviewer decisions needed

None for the requested proof set. Review the flat-shot overlay and Kat/bench frames above. No artwork-width waiver or new generation is requested.

Cleanup: API4317 and game8080 are stopped (no listening processes). No push, merge, deploy, keys or dotenv writes. The pre-existing calls ledger, accepted walkstats edit and untracked AgentDebug test remain in place.
