# Brief 06 — closed-loop steering, speed and real walks

**Status: NOT ACCEPTED against the complete brief/Footfall goal.** The explicit locking, raw-floor, aggregate median-speed, cadence and walking-duration checks pass across all 63 clips. The stronger speed-at-every-depth requirement still fails; tree-front has two identical walking frames; the alley far exit reaches its approach but its provider-disabled narration request fails. A real foreground-tree crossing remains unsupported by the current floor geometry.

The complete goal, reviewer findings, Brief 05 report and `git log -15` were read before implementation. The retired `footcheck.py` was never used as a gate. This report records both the successful checks and the remaining failures; it is not a sign-off on the broader ten-scene Footfall goal.

## Delivered behavior

At each support switch, the motor replans from the actual body/contact position, evaluates all eight headings through the current perspective, and predicts the complete stance plus incoming foot landing. Boots use the raw floor mask; the body uses the eroded mask. Unsafe candidates are rejected. Bounded continuation search handles routes requiring an intermediate sideways step; it selects only the next stance and replans again at the next switch. If no safe continuation exists, the motor stops on its current foot. Continuous anchor correction is **zero**, within the permitted one-pixel allowance. Arrival uses half the projected stride toward the remaining target.

New away/toward Kling cycles have longer strides. FPS: side 33, away 25, toward 25.5, away diagonal 25, toward diagonal 26.5. Unequal source support lengths receive equal support durations at the nominal cycle cadence. Matching-foot partial entries allow boundary turns; one-frame entries are prohibited after a rendered regression exposed a hidden double handoff. Short partial entries can still hold a pose too long, as recorded below.

Object clicks with no floor in front now approach the nearest reachable floor. Explicit exit clicks take priority over object pixels. Exit approach points provide final-stance clearance while physical gate regions remain separate; half-stride arrival can fire only the requested gate at its configured approach. Walking away from a gate no longer retriggers it.

## Final measurements

- **63 clips**, 1920×1080, exactly 24 fps; every decoded frame count equals its JSON row count. Files: `tmp/walkqa/final-06/`. Raw masks: each `area.json`; eroded/body geometry: each `navigation.json`.
- **Lockcheck: max 0.00 px**, all 63 clips. **0 off-floor planted-contact frames** and **0 off-floor body walking frames**.
- All measured per-clip cadences are 1.6–2.2 steps/s. Every clip walks at least one second; shortest is 1.125s. No arrival-only exemptions were used.
- Every non-exit approach has a recorded half-stride arrival; physical exit crossings may transition before such an arrival. Five source-to-destination transitions are preserved in `tmp/walkqa/transitions-06/`. Their source-scene prefixes are tested against the source mask, with no source walking frames discarded. Alley far exit remains incomplete.
- Engineering: **375 tests / 35 files pass**; engine, game and API typecheck and lint pass; three contact-registration Python tests pass; anchor `verify:art` passes with the existing art warnings.
- Town run **15: PASS**, full journey through `inside`, `inside-option`, and `finish`; **69 cached calls, 0 uncached calls**. This uses the isolated committed API/cache fixture described under provenance.

### F7 — before / after speeds

| Cycle | Brief 05 median m/s | Brief 06 median m/s | Ratio to side | Brief 06 min–max m/s |
|---|---:|---:|---:|---:|
| side | 1.14 | 1.47 | 1.000 | 1.24–2.01 |
| walk-away | 0.54 | 1.46 | 0.993 | 0.40–2.23 |
| walk-toward | 0.59 | 1.74 | 1.184 | 1.12–3.01 |
| walk-away-right | 1.35 | 1.40 | 0.952 | 1.07–2.01 |
| walk-toward-right | 1.40 | 1.27 | 0.864 | 1.02–2.09 |

These aggregate medians all meet ±20% of side. They do **not** establish the same speed at every depth. The supplemental audit groups actual adjacent same-cycle walking samples into 40-pixel body-depth bins, requiring at least 24 pairs for both the cycle and side. On road at y=760–800, toward averages **3.073 m/s versus side 1.924 (1.597×)**; at y=800–840 it averages **2.889 versus 1.648 (1.753×)**. At y=840–880, away averages **0.873 versus 1.540 (0.567×)**. This diagnostic is a mean within a depth band, not the reviewer's per-clip median, and the walks differ in horizontal path and support phase. It exposes remaining depth dependence; no universal speed claim is made. Raw samples and frame references: `verification-06/depth-speed.json` and `.txt`.

The playback-only baseline estimate could not bring old away/toward cycles to the target within the cadence ceiling. The two permitted new videos and subsequent playback/support-duration tuning improved aggregate speed and cadence, but did not solve the depth dependence. No further paid video was generated.

### F9 — floor containment

Reviewer Brief 05 counts using its older mask export: alley/side-far **87/111**, alley/diagonal-toward-right **134/201**, depot-outside/post-behind **26/26**. Rechecking the old clips with their original sprite metadata against the raw mask gives **50/111**, **103/201**, **26/26** respectively, **254 off-floor frames total**. Brief 06 has **zero** in every clip. Both mask semantics are stated to avoid presenting an eroded/raw comparison as an identical baseline. Preserved baseline: `verification-06/baseline-raw-floor.json`, `baseline-sprite-metadata.json`, `walkstats-before.txt`.

### F8 — walks and destinations

- `road/tree-front`: before 0 walking frames; after **326 walking frames (13.58s)**. Arrival distance 27.42px / allowed half stride 28.46px.
- `road/far-exit`: before 14 px displacement; after **135 walking frames (5.62s)**. Exit completed: **True**. Arrival distance 3.09px / allowed half stride 17.06px.

The tree-front click hits the left fishing net and now walks to reachable floor through the object fallback. It is **not a foreground-tree crossing**: the current mask has no such route. The retained name records the original request instead of quietly replacing it. Depot floors are shallow; “far” labels alone do not prove a distinct distant depth after snapping. Road/tree-behind reaches a physical edge exit, and its complete transition is retained separately.

## Open failures with frames

1. **Depth-dependent speed (F7)** remains outside ±20% in the supplemental matched-depth samples above. Witnesses: `verification-06/failure-frames/road-toward-far-f0023.png`, `road-toward-far-f0056.png`, `road-trap-front-f0105.png`; corresponding full MP4/JSON logs remain under `final-06/road/`. A single still is a locator, not speed evidence; use the adjacent logged frames.
2. **Two frozen walking frames in road/tree-front**, indices **300 and 301** (zero based), out of 325 walking pairs. The motor holds away-diagonal source frame 13 around this partial support turn; this is a real motion limitation, not dismissed as a checker error. Frames 295, 299, 300, 301, 302 and 304 are retained in `verification-06/failure-frames/road-tree-front-f*.png`. All other 62 clips report zero identical walking frames. Earlier fixes addressed hidden one-frame pivots and uneven cadence; the remaining short-phase pose hold is unresolved.
3. **Alley far exit does not transition.** It walks 97 frames and reaches (579.26,645.73), 3.69px from approach (582.5,647.5), within the 35.97px half stride. `POST /api/narrate` returns **502** in the credential-disabled isolated runtime after the travel trigger. A fresh valid world session fixed the road far exit cache replay but still leaves this alley request without a usable cached response. Evidence: `final-06/alley/exit.mp4`, `.json`, `verification-06/capture-alley-fresh-exit.log`, `api-fresh-exits.log`, `failure-frames/alley-exit-f0096.png`. No fabricated cached response, destination substitution, or paid narrative retry was used.
4. **Foreground-tree crossing is unsupported by the current floor**, as described above. `road-tree-front-f0300.png` shows the actual nearest-floor approach. The broader goal's all-crossing visual sign-off, ten-scene coverage, facing/path bounds and automatic derivation are not claimed by this four-scene brief.

The failed 6.89px intermediate trap-front pivot remains in `verification-06/before-visible-pivot/`; the final clip passes after disallowing one-frame support entries. Historical town failures and iteration measurements remain in `verification-06/implementation-progress.md` and the named logs. They are superseded by run 15 where applicable, not erased.

## Visual and source review

The new away/toward source contact sheets and full-body loop sheets were inspected frame by frame. Toward's initial heel seed was rejected in favor of the toe seed; away uses a wider registration search for its coarse source pose increments. The final five stancecam sheets were opened and inspected: side (`road/side-near`), away (`road/away-far`), toward (`road/toward-near`), away diagonal (`road/diagonal-away-right`), toward diagonal (`alley/toward-far`). The actual final stance on each sheet has the stated cycle; filenames alone are not treated as proof of cycle coverage. The planted boots stay on their fixed crosshairs; toe roll and swing-foot motion remain visible. The away source is visibly coarser than toward. This visual foot review does not override the speed, freeze or exit failures.

## Raw acceptance outputs

### `python3 tmp/walkqa/tools/lockcheck.py <every final-06 mp4 path>`

```text
{"clip": "tmp/walkqa/final-06/alley/away-far.mp4", "stances": 8, "maxExcursion_px": 0.0, "median": 0.0, "worst": [[0.0, 80, 90, "eo-transparent-loop"], [0.0, 66, 79, "away"], [0.0, 54, 65, "away-right"]]}
{"clip": "tmp/walkqa/final-06/alley/away-near.mp4", "stances": 6, "maxExcursion_px": 0.0, "median": 0.0, "worst": [[0.0, 54, 64, "eo-transparent-loop"], [0.0, 43, 53, "away-right"], [0.0, 31, 42, "away-right"]]}
{"clip": "tmp/walkqa/final-06/alley/crate-behind.mp4", "stances": 4, "maxExcursion_px": 0.0, "median": 0.0, "worst": [[0.0, 31, 41, "eo-transparent-loop"], [0.0, 21, 30, "eo-transparent-loop"], [0.0, 10, 20, "eo-transparent-loop"]]}
{"clip": "tmp/walkqa/final-06/alley/crate-front.mp4", "stances": 4, "maxExcursion_px": 0.0, "median": 0.0, "worst": [[0.0, 31, 41, "eo-transparent-loop"], [0.0, 21, 30, "eo-transparent-loop"], [0.0, 10, 20, "eo-transparent-loop"]]}
{"clip": "tmp/walkqa/final-06/alley/diagonal-away-left.mp4", "stances": 8, "maxExcursion_px": 0.0, "median": 0.0, "worst": [[0.0, 78, 88, "eo-transparent-loop"], [0.0, 67, 77, "away-right"], [0.0, 55, 66, "away-right"]]}
{"clip": "tmp/walkqa/final-06/alley/diagonal-away-right.mp4", "stances": 6, "maxExcursion_px": 0.0, "median": 0.0, "worst": [[0.0, 55, 66, "away-right"], [0.0, 41, 54, "away"], [0.0, 30, 40, "eo-transparent-loop"]]}
{"clip": "tmp/walkqa/final-06/alley/diagonal-toward-left.mp4", "stances": 5, "maxExcursion_px": 0.0, "median": 0.0, "worst": [[0.0, 44, 55, "toward"], [0.0, 32, 43, "toward"], [0.0, 21, 31, "toward"]]}
{"clip": "tmp/walkqa/final-06/alley/diagonal-toward-right.mp4", "stances": 10, "maxExcursion_px": 0.0, "median": 0.0, "worst": [[0.0, 101, 111, "eo-transparent-loop"], [0.0, 90, 100, "toward"], [0.0, 78, 89, "toward"]]}
{"clip": "tmp/walkqa/final-06/alley/diagonal.mp4", "stances": 6, "maxExcursion_px": 0.0, "median": 0.0, "worst": [[0.0, 55, 66, "away-right"], [0.0, 41, 54, "away"], [0.0, 30, 40, "eo-transparent-loop"]]}
{"clip": "tmp/walkqa/final-06/alley/exit.mp4", "stances": 8, "maxExcursion_px": 0.0, "median": 0.0, "worst": [[0.0, 86, 96, "eo-transparent-loop"], [0.0, 71, 85, "away"], [0.0, 57, 70, "away"]]}
{"clip": "tmp/walkqa/final-06/alley/object-click.mp4", "stances": 6, "maxExcursion_px": 0.0, "median": 0.0, "worst": [[0.0, 57, 67, "away-right"], [0.0, 42, 56, "away"], [0.0, 31, 41, "eo-transparent-loop"]]}
{"clip": "tmp/walkqa/final-06/alley/side-far.mp4", "stances": 3, "maxExcursion_px": 0.0, "median": 0.0, "worst": [[0.0, 18, 28, "toward-right"], [0.0, 7, 17, "eo-transparent-loop"], [0.0, 0, 6, "eo-transparent-loop"]]}
{"clip": "tmp/walkqa/final-06/alley/side-near.mp4", "stances": 3, "maxExcursion_px": 0.0, "median": 0.0, "worst": [[0.0, 18, 28, "eo-transparent-loop"], [0.0, 7, 17, "eo-transparent-loop"], [0.0, 0, 6, "eo-transparent-loop"]]}
{"clip": "tmp/walkqa/final-06/alley/toward-far.mp4", "stances": 7, "maxExcursion_px": 0.0, "median": 0.0, "worst": [[0.0, 66, 76, "toward-right"], [0.0, 54, 65, "toward"], [0.0, 42, 53, "toward"]]}
{"clip": "tmp/walkqa/final-06/alley/toward-near.mp4", "stances": 5, "maxExcursion_px": 0.0, "median": 0.0, "worst": [[0.0, 42, 53, "toward"], [0.0, 30, 41, "toward"], [0.0, 19, 29, "toward"]]}
{"clip": "tmp/walkqa/final-06/depot-inside/away-far.mp4", "stances": 3, "maxExcursion_px": 0.0, "median": 0.0, "worst": [[0.0, 16, 26, "away-right"], [0.0, 4, 15, "away-right"], [0.0, 0, 3, "away"]]}
{"clip": "tmp/walkqa/final-06/depot-inside/away-near.mp4", "stances": 3, "maxExcursion_px": 0.0, "median": 0.0, "worst": [[0.0, 16, 26, "away-right"], [0.0, 4, 15, "away-right"], [0.0, 0, 3, "away"]]}
{"clip": "tmp/walkqa/final-06/depot-inside/bench-behind.mp4", "stances": 9, "maxExcursion_px": 0.0, "median": 0.0, "worst": [[0.0, 87, 97, "eo-transparent-loop"], [0.0, 73, 86, "away"], [0.0, 61, 72, "away-right"]]}
{"clip": "tmp/walkqa/final-06/depot-inside/bench-front.mp4", "stances": 6, "maxExcursion_px": 0.0, "median": 0.0, "worst": [[0.0, 50, 60, "eo-transparent-loop"], [0.0, 39, 49, "eo-transparent-loop"], [0.0, 29, 38, "eo-transparent-loop"]]}
{"clip": "tmp/walkqa/final-06/depot-inside/diagonal-away-left.mp4", "stances": 6, "maxExcursion_px": 0.0, "median": 0.0, "worst": [[0.0, 57, 68, "away-right"], [0.0, 43, 56, "away"], [0.0, 31, 42, "away-right"]]}
{"clip": "tmp/walkqa/final-06/depot-inside/diagonal-away-right.mp4", "stances": 8, "maxExcursion_px": 0.0, "median": 0.0, "worst": [[0.0, 77, 87, "away-right"], [0.0, 63, 76, "away"], [0.0, 52, 62, "eo-transparent-loop"]]}
{"clip": "tmp/walkqa/final-06/depot-inside/diagonal-toward-left.mp4", "stances": 6, "maxExcursion_px": 0.0, "median": 0.0, "worst": [[0.0, 54, 65, "toward"], [0.0, 42, 53, "toward"], [0.0, 31, 41, "eo-transparent-loop"]]}
{"clip": "tmp/walkqa/final-06/depot-inside/diagonal-toward-right.mp4", "stances": 9, "maxExcursion_px": 0.0, "median": 0.0, "worst": [[0.0, 89, 100, "toward"], [0.0, 77, 88, "toward"], [0.0, 65, 76, "toward"]]}
{"clip": "tmp/walkqa/final-06/depot-inside/diagonal.mp4", "stances": 8, "maxExcursion_px": 0.0, "median": 0.0, "worst": [[0.0, 77, 87, "away-right"], [0.0, 63, 76, "away"], [0.0, 52, 62, "eo-transparent-loop"]]}
{"clip": "tmp/walkqa/final-06/depot-inside/exit.mp4", "stances": 5, "maxExcursion_px": 0.0, "median": 0.0, "worst": [[0.0, 39, 50, "toward-right"], [0.0, 29, 38, "eo-transparent-loop"], [0.0, 18, 28, "eo-transparent-loop"]]}
{"clip": "tmp/walkqa/final-06/depot-inside/object-click.mp4", "stances": 4, "maxExcursion_px": 0.0, "median": 0.0, "worst": [[0.0, 31, 42, "away-right"], [0.0, 21, 30, "eo-transparent-loop"], [0.0, 10, 20, "eo-transparent-loop"]]}
{"clip": "tmp/walkqa/final-06/depot-inside/side-far.mp4", "stances": 6, "maxExcursion_px": 0.0, "median": 0.0, "worst": [[0.0, 50, 60, "eo-transparent-loop"], [0.0, 39, 49, "eo-transparent-loop"], [0.0, 29, 38, "eo-transparent-loop"]]}
{"clip": "tmp/walkqa/final-06/depot-inside/side-near.mp4", "stances": 6, "maxExcursion_px": 0.0, "median": 0.0, "worst": [[0.0, 51, 61, "eo-transparent-loop"], [0.0, 40, 50, "eo-transparent-loop"], [0.0, 29, 39, "eo-transparent-loop"]]}
{"clip": "tmp/walkqa/final-06/depot-inside/toward-far.mp4", "stances": 5, "maxExcursion_px": 0.0, "median": 0.0, "worst": [[0.0, 45, 55, "toward-right"], [0.0, 33, 44, "toward"], [0.0, 22, 32, "toward"]]}
{"clip": "tmp/walkqa/final-06/depot-inside/toward-near.mp4", "stances": 5, "maxExcursion_px": 0.0, "median": 0.0, "worst": [[0.0, 45, 55, "toward-right"], [0.0, 33, 44, "toward"], [0.0, 22, 32, "toward"]]}
{"clip": "tmp/walkqa/final-06/depot-outside/away-far.mp4", "stances": 3, "maxExcursion_px": 0.0, "median": 0.0, "worst": [[0.0, 16, 26, "away-right"], [0.0, 4, 15, "away-right"], [0.0, 0, 3, "away"]]}
{"clip": "tmp/walkqa/final-06/depot-outside/away-near.mp4", "stances": 3, "maxExcursion_px": 0.0, "median": 0.0, "worst": [[0.0, 16, 26, "away-right"], [0.0, 4, 15, "away-right"], [0.0, 0, 3, "away"]]}
{"clip": "tmp/walkqa/final-06/depot-outside/diagonal-away-left.mp4", "stances": 6, "maxExcursion_px": 0.0, "median": 0.0, "worst": [[0.0, 58, 69, "away-right"], [0.0, 44, 57, "away"], [0.0, 32, 43, "toward"]]}
{"clip": "tmp/walkqa/final-06/depot-outside/diagonal-away-right.mp4", "stances": 5, "maxExcursion_px": 0.0, "median": 0.0, "worst": [[0.0, 41, 51, "away-right"], [0.0, 29, 40, "away-right"], [0.0, 18, 28, "away-right"]]}
{"clip": "tmp/walkqa/final-06/depot-outside/diagonal-toward-left.mp4", "stances": 5, "maxExcursion_px": 0.0, "median": 0.0, "worst": [[0.0, 43, 54, "toward"], [0.0, 31, 42, "toward"], [0.0, 21, 30, "eo-transparent-loop"]]}
{"clip": "tmp/walkqa/final-06/depot-outside/diagonal-toward-right.mp4", "stances": 8, "maxExcursion_px": 0.0, "median": 0.0, "worst": [[0.0, 78, 89, "toward"], [0.0, 67, 77, "toward"], [0.0, 55, 66, "toward"]]}
{"clip": "tmp/walkqa/final-06/depot-outside/diagonal.mp4", "stances": 5, "maxExcursion_px": 0.0, "median": 0.0, "worst": [[0.0, 41, 51, "away-right"], [0.0, 29, 40, "away-right"], [0.0, 18, 28, "away-right"]]}
{"clip": "tmp/walkqa/final-06/depot-outside/exit.mp4", "stances": 3, "maxExcursion_px": 0.0, "median": 0.0, "worst": [[0.0, 19, 29, "toward"], [0.0, 7, 18, "toward"], [0.0, 0, 6, "eo-transparent-loop"]]}
{"clip": "tmp/walkqa/final-06/depot-outside/object-click.mp4", "stances": 7, "maxExcursion_px": 0.0, "median": 0.0, "worst": [[0.0, 67, 78, "toward"], [0.0, 55, 66, "toward"], [0.0, 44, 54, "toward"]]}
{"clip": "tmp/walkqa/final-06/depot-outside/post-behind.mp4", "stances": 4, "maxExcursion_px": 0.0, "median": 0.0, "worst": [[0.0, 29, 40, "away-right"], [0.0, 18, 28, "away-right"], [0.0, 7, 17, "eo-transparent-loop"]]}
{"clip": "tmp/walkqa/final-06/depot-outside/post-front.mp4", "stances": 3, "maxExcursion_px": 0.0, "median": 0.0, "worst": [[0.0, 18, 28, "eo-transparent-loop"], [0.0, 7, 17, "eo-transparent-loop"], [0.0, 0, 6, "eo-transparent-loop"]]}
{"clip": "tmp/walkqa/final-06/depot-outside/side-far.mp4", "stances": 3, "maxExcursion_px": 0.0, "median": 0.0, "worst": [[0.0, 18, 28, "eo-transparent-loop"], [0.0, 7, 17, "eo-transparent-loop"], [0.0, 0, 6, "eo-transparent-loop"]]}
{"clip": "tmp/walkqa/final-06/depot-outside/side-near.mp4", "stances": 3, "maxExcursion_px": 0.0, "median": 0.0, "worst": [[0.0, 18, 28, "away-right"], [0.0, 7, 17, "eo-transparent-loop"], [0.0, 0, 6, "eo-transparent-loop"]]}
{"clip": "tmp/walkqa/final-06/depot-outside/toward-far.mp4", "stances": 7, "maxExcursion_px": 0.0, "median": 0.0, "worst": [[0.0, 68, 78, "toward"], [0.0, 57, 67, "eo-transparent-loop"], [0.0, 45, 56, "away-right"]]}
{"clip": "tmp/walkqa/final-06/depot-outside/toward-near.mp4", "stances": 7, "maxExcursion_px": 0.0, "median": 0.0, "worst": [[0.0, 68, 78, "toward"], [0.0, 57, 67, "eo-transparent-loop"], [0.0, 45, 56, "away-right"]]}
{"clip": "tmp/walkqa/final-06/road/away-far.mp4", "stances": 10, "maxExcursion_px": 0.0, "median": 0.0, "worst": [[0.0, 100, 114, "away"], [0.0, 86, 99, "away"], [0.0, 74, 85, "away-right"]]}
{"clip": "tmp/walkqa/final-06/road/away-near.mp4", "stances": 6, "maxExcursion_px": 0.0, "median": 0.0, "worst": [[0.0, 50, 60, "eo-transparent-loop"], [0.0, 39, 49, "away-right"], [0.0, 27, 38, "away-right"]]}
{"clip": "tmp/walkqa/final-06/road/diagonal-away-left.mp4", "stances": 10, "maxExcursion_px": 0.0, "median": 0.0, "worst": [[0.0, 103, 114, "away-right"], [0.0, 89, 102, "away"], [0.0, 78, 88, "eo-transparent-loop"]]}
{"clip": "tmp/walkqa/final-06/road/diagonal-away-right.mp4", "stances": 8, "maxExcursion_px": 0.0, "median": 0.0, "worst": [[0.0, 79, 89, "away-right"], [0.0, 64, 78, "away"], [0.0, 53, 63, "away-right"]]}
{"clip": "tmp/walkqa/final-06/road/diagonal-toward-left.mp4", "stances": 11, "maxExcursion_px": 0.0, "median": 0.0, "worst": [[0.0, 112, 123, "toward"], [0.0, 100, 111, "toward"], [0.0, 89, 99, "toward-right"]]}
{"clip": "tmp/walkqa/final-06/road/diagonal-toward-right.mp4", "stances": 8, "maxExcursion_px": 0.0, "median": 0.0, "worst": [[0.0, 76, 86, "eo-transparent-loop"], [0.0, 64, 75, "toward"], [0.0, 52, 63, "toward"]]}
{"clip": "tmp/walkqa/final-06/road/diagonal.mp4", "stances": 8, "maxExcursion_px": 0.0, "median": 0.0, "worst": [[0.0, 79, 89, "away-right"], [0.0, 64, 78, "away"], [0.0, 53, 63, "away-right"]]}
{"clip": "tmp/walkqa/final-06/road/exit.mp4", "stances": 8, "maxExcursion_px": 0.0, "median": 0.0, "worst": [[0.0, 75, 86, "away-right"], [0.0, 64, 74, "eo-transparent-loop"], [0.0, 53, 63, "eo-transparent-loop"]]}
{"clip": "tmp/walkqa/final-06/road/far-exit.mp4", "stances": 12, "maxExcursion_px": 0.0, "median": 0.0, "worst": [[0.0, 123, 134, "toward-right"], [0.0, 109, 122, "away"], [0.0, 97, 108, "away-right"]]}
{"clip": "tmp/walkqa/final-06/road/object-click.mp4", "stances": 7, "maxExcursion_px": 0.0, "median": 0.0, "worst": [[0.0, 63, 74, "toward"], [0.0, 51, 62, "toward"], [0.0, 39, 50, "toward"]]}
{"clip": "tmp/walkqa/final-06/road/side-far.mp4", "stances": 6, "maxExcursion_px": 0.0, "median": 0.0, "worst": [[0.0, 50, 60, "eo-transparent-loop"], [0.0, 39, 49, "eo-transparent-loop"], [0.0, 29, 38, "eo-transparent-loop"]]}
{"clip": "tmp/walkqa/final-06/road/side-near.mp4", "stances": 3, "maxExcursion_px": 0.0, "median": 0.0, "worst": [[0.0, 18, 28, "eo-transparent-loop"], [0.0, 7, 17, "eo-transparent-loop"], [0.0, 0, 6, "eo-transparent-loop"]]}
{"clip": "tmp/walkqa/final-06/road/toward-far.mp4", "stances": 8, "maxExcursion_px": 0.0, "median": 0.0, "worst": [[0.0, 80, 91, "toward"], [0.0, 69, 79, "toward"], [0.0, 57, 68, "toward"]]}
{"clip": "tmp/walkqa/final-06/road/toward-near.mp4", "stances": 8, "maxExcursion_px": 0.0, "median": 0.0, "worst": [[0.0, 80, 91, "toward"], [0.0, 69, 79, "toward"], [0.0, 57, 68, "toward"]]}
{"clip": "tmp/walkqa/final-06/road/trap-behind.mp4", "stances": 14, "maxExcursion_px": 0.0, "median": 0.0, "worst": [[0.0, 143, 153, "eo-transparent-loop"], [0.0, 132, 142, "toward-right"], [0.0, 121, 131, "eo-transparent-loop"]]}
{"clip": "tmp/walkqa/final-06/road/trap-front.mp4", "stances": 12, "maxExcursion_px": 0.0, "median": 0.0, "worst": [[0.0, 128, 138, "eo-transparent-loop"], [0.0, 117, 127, "toward-right"], [0.0, 103, 116, "away"]]}
{"clip": "tmp/walkqa/final-06/road/tree-behind.mp4", "stances": 14, "maxExcursion_px": 0.0, "median": 0.0, "worst": [[0.0, 142, 153, "away-right"], [0.0, 131, 141, "away-right"], [0.0, 119, 130, "away-right"]]}
{"clip": "tmp/walkqa/final-06/road/tree-front.mp4", "stances": 29, "maxExcursion_px": 0.0, "median": 0.0, "worst": [[0.0, 316, 325, "eo-transparent-loop"], [0.0, 304, 315, "toward-right"], [0.0, 293, 303, "away-right"]]}
```

### `python3 tmp/walkqa/tools/walkstats.py tmp/walkqa/final-06`

```text
clip                                         walk s  dist px off-floor steps/s
alley/away-far.json                             3.8     153    0/91    1.85
alley/away-near.json                            2.7     137    0/65    1.85
alley/crate-behind.json                         1.8     555    0/42    1.71
alley/crate-front.json                          1.8     555    0/42    1.71
alley/diagonal-away-left.json                   3.7     269    0/89    1.89
alley/diagonal-away-right.json                  2.8     242    0/67    1.79
alley/diagonal-toward-left.json                 2.3     287    0/56    1.71
alley/diagonal-toward-right.json                4.7     404    0/112   1.93
alley/diagonal.json                             2.8     242    0/67    1.79
alley/exit.json                                 4.0     174    0/97    1.73
alley/object-click.json                         2.8     644    0/68    1.76
alley/side-far.json                             1.2     275    0/29    1.66
alley/side-near.json                            1.2     393    0/29    1.66
alley/toward-far.json                           3.2     133    0/77    1.87
alley/toward-near.json                          2.2     191    0/54    1.78
depot-inside/away-far.json                      1.1      80    0/27    1.78
depot-inside/away-near.json                     1.1      80    0/27    1.78
depot-inside/bench-behind.json                  4.1     740    0/98    1.96
depot-inside/bench-front.json                   2.5     707    0/61    1.97
depot-inside/diagonal-away-left.json            2.9     509    0/69    1.74
depot-inside/diagonal-away-right.json           3.7     487    0/88    1.91
depot-inside/diagonal-toward-left.json          2.8     485    0/66    1.82
depot-inside/diagonal-toward-right.json         4.2     496    0/101   1.90
depot-inside/diagonal.json                      3.7     487    0/88    1.91
depot-inside/exit.json                          2.1     539    0/51    1.88
depot-inside/object-click.json                  1.8     430    0/43    1.67
depot-inside/side-far.json                      2.5     639    0/61    1.97
depot-inside/side-near.json                     2.6     676    0/62    1.94
depot-inside/toward-far.json                    2.3     117    0/56    1.71
depot-inside/toward-near.json                   2.3     117    0/56    1.71
depot-outside/away-far.json                     1.1      87    0/27    1.78
depot-outside/away-near.json                    1.1      90    0/27    1.78
depot-outside/diagonal-away-left.json           2.9     391    0/70    1.71
depot-outside/diagonal-away-right.json          2.2     329    0/52    1.85
depot-outside/diagonal-toward-left.json         2.3     385    0/55    1.75
depot-outside/diagonal-toward-right.json        3.8     354    0/90    1.87
depot-outside/diagonal.json                     2.2     329    0/52    1.85
depot-outside/exit.json                         1.2     154    0/30    1.60
depot-outside/object-click.json                 3.3     349    0/79    1.82
depot-outside/post-behind.json                  1.7     300    0/41    1.76
depot-outside/post-front.json                   1.2     356    0/29    1.66
depot-outside/side-far.json                     1.2     319    0/29    1.66
depot-outside/side-near.json                    1.2     325    0/29    1.66
depot-outside/toward-far.json                   3.3     126    0/79    1.82
depot-outside/toward-near.json                  3.3     126    0/79    1.82
road/away-far.json                              4.8     121    0/115   1.88
road/away-near.json                             2.5     114    0/61    1.97
road/diagonal-away-left.json                    4.8     254    0/115   1.88
road/diagonal-away-right.json                   3.8     253    0/90    1.87
road/diagonal-toward-left.json                  5.2     267    0/124   1.94
road/diagonal-toward-right.json                 3.6     245    0/87    1.93
road/diagonal.json                              3.8     253    0/90    1.87
road/exit.json                                  3.6     511    0/87    1.93
road/far-exit.json                              5.6     157    0/135   1.96
road/object-click.json                          3.1     347    0/75    1.92
road/side-far.json                              2.5     378    0/61    1.97
road/side-near.json                             1.2     258    0/29    1.66
road/toward-far.json                            3.8     117    0/92    1.83
road/toward-near.json                           3.8     146    0/92    1.83
road/trap-behind.json                           6.4     499    0/154   2.03
road/trap-front.json                            5.8     424    0/139   1.90
road/tree-behind.json                           6.4     543    0/154   2.03
road/tree-front.json                           13.6     692    0/326   2.06

side                 ground m/s min/median/max 1.24 1.47 2.01 (n=42)
walk-away            ground m/s min/median/max 0.4 1.46 2.23 (n=22)
walk-away-right      ground m/s min/median/max 1.07 1.4 2.01 (n=32)
walk-toward          ground m/s min/median/max 1.12 1.74 3.01 (n=19)
walk-toward-right    ground m/s min/median/max 1.02 1.27 2.09 (n=6)
```

### `Additional eroded-body/frame-count audit`

```text
63 clips: 1920x1080, 24 fps, frame/log counts verified; 5 transitions preserved separately; body off-floor: 0
```

### Stancecam

Each command uses `tmp/walkqa/tools/venv/bin/python tmp/walkqa/tools/stancecam.py <clip> <out.png> 2`. All five output images were inspected.

`tmp/walkqa/tools/venv/bin/python tmp/walkqa/tools/stancecam.py tmp/walkqa/final-06/road/side-near.mp4 tmp/walkqa/verification-06/stancecams/side.png 2`

```text
tmp/walkqa/verification-06/stancecams/side.png 3 stances; 2 shown
```

`tmp/walkqa/tools/venv/bin/python tmp/walkqa/tools/stancecam.py tmp/walkqa/final-06/road/away-far.mp4 tmp/walkqa/verification-06/stancecams/away.png 2`

```text
tmp/walkqa/verification-06/stancecams/away.png 9 stances; 2 shown
```

`tmp/walkqa/tools/venv/bin/python tmp/walkqa/tools/stancecam.py tmp/walkqa/final-06/road/toward-near.mp4 tmp/walkqa/verification-06/stancecams/toward.png 2`

```text
tmp/walkqa/verification-06/stancecams/toward.png 8 stances; 2 shown
```

`tmp/walkqa/tools/venv/bin/python tmp/walkqa/tools/stancecam.py tmp/walkqa/final-06/road/diagonal-away-right.mp4 tmp/walkqa/verification-06/stancecams/away-right.png 2`

```text
tmp/walkqa/verification-06/stancecams/away-right.png 8 stances; 2 shown
```

`tmp/walkqa/tools/venv/bin/python tmp/walkqa/tools/stancecam.py tmp/walkqa/final-06/alley/toward-far.mp4 tmp/walkqa/verification-06/stancecams/toward-right.png 2`

```text
tmp/walkqa/verification-06/stancecams/toward-right.png 7 stances; 2 shown
```

### freeze.py — all 63 clips

```text
tmp/walkqa/final-06/alley/away-far.mp4: frames 96, walking pairs 90, frozen while walking 0 (0%); legacy threshold flags 29
tmp/walkqa/final-06/alley/away-near.mp4: frames 72, walking pairs 64, frozen while walking 0 (0%); legacy threshold flags 10
tmp/walkqa/final-06/alley/crate-behind.mp4: frames 144, walking pairs 41, frozen while walking 0 (0%); legacy threshold flags 6
tmp/walkqa/final-06/alley/crate-front.mp4: frames 144, walking pairs 41, frozen while walking 0 (0%); legacy threshold flags 6
tmp/walkqa/final-06/alley/diagonal-away-left.mp4: frames 96, walking pairs 88, frozen while walking 0 (0%); legacy threshold flags 9
tmp/walkqa/final-06/alley/diagonal-away-right.mp4: frames 72, walking pairs 66, frozen while walking 0 (0%); legacy threshold flags 16
tmp/walkqa/final-06/alley/diagonal-toward-left.mp4: frames 72, walking pairs 55, frozen while walking 0 (0%); legacy threshold flags 6
tmp/walkqa/final-06/alley/diagonal-toward-right.mp4: frames 116, walking pairs 111, frozen while walking 0 (0%); legacy threshold flags 28
tmp/walkqa/final-06/alley/diagonal.mp4: frames 72, walking pairs 66, frozen while walking 0 (0%); legacy threshold flags 16
tmp/walkqa/final-06/alley/exit.mp4: frames 148, walking pairs 96, frozen while walking 0 (0%); legacy threshold flags 48
tmp/walkqa/final-06/alley/object-click.mp4: frames 144, walking pairs 67, frozen while walking 0 (0%); legacy threshold flags 20
tmp/walkqa/final-06/alley/side-far.mp4: frames 72, walking pairs 28, frozen while walking 0 (0%); legacy threshold flags 6
tmp/walkqa/final-06/alley/side-near.mp4: frames 72, walking pairs 28, frozen while walking 0 (0%); legacy threshold flags 6
tmp/walkqa/final-06/alley/toward-far.mp4: frames 84, walking pairs 76, frozen while walking 0 (0%); legacy threshold flags 27
tmp/walkqa/final-06/alley/toward-near.mp4: frames 72, walking pairs 53, frozen while walking 0 (0%); legacy threshold flags 6
tmp/walkqa/final-06/depot-inside/away-far.mp4: frames 72, walking pairs 26, frozen while walking 0 (0%); legacy threshold flags 10
tmp/walkqa/final-06/depot-inside/away-near.mp4: frames 72, walking pairs 26, frozen while walking 0 (0%); legacy threshold flags 10
tmp/walkqa/final-06/depot-inside/bench-behind.mp4: frames 180, walking pairs 97, frozen while walking 0 (0%); legacy threshold flags 14
tmp/walkqa/final-06/depot-inside/bench-front.mp4: frames 144, walking pairs 60, frozen while walking 0 (0%); legacy threshold flags 6
tmp/walkqa/final-06/depot-inside/diagonal-away-left.mp4: frames 76, walking pairs 68, frozen while walking 0 (0%); legacy threshold flags 18
tmp/walkqa/final-06/depot-inside/diagonal-away-right.mp4: frames 92, walking pairs 87, frozen while walking 0 (0%); legacy threshold flags 14
tmp/walkqa/final-06/depot-inside/diagonal-toward-left.mp4: frames 72, walking pairs 65, frozen while walking 0 (0%); legacy threshold flags 5
tmp/walkqa/final-06/depot-inside/diagonal-toward-right.mp4: frames 108, walking pairs 100, frozen while walking 0 (0%); legacy threshold flags 14
tmp/walkqa/final-06/depot-inside/diagonal.mp4: frames 92, walking pairs 87, frozen while walking 0 (0%); legacy threshold flags 14
tmp/walkqa/final-06/depot-inside/exit.mp4: frames 51, walking pairs 50, frozen while walking 0 (0%); legacy threshold flags 0
tmp/walkqa/final-06/depot-inside/object-click.mp4: frames 180, walking pairs 42, frozen while walking 0 (0%); legacy threshold flags 7
tmp/walkqa/final-06/depot-inside/side-far.mp4: frames 72, walking pairs 60, frozen while walking 0 (0%); legacy threshold flags 6
tmp/walkqa/final-06/depot-inside/side-near.mp4: frames 72, walking pairs 61, frozen while walking 0 (0%); legacy threshold flags 6
tmp/walkqa/final-06/depot-inside/toward-far.mp4: frames 72, walking pairs 55, frozen while walking 0 (0%); legacy threshold flags 7
tmp/walkqa/final-06/depot-inside/toward-near.mp4: frames 72, walking pairs 55, frozen while walking 0 (0%); legacy threshold flags 6
tmp/walkqa/final-06/depot-outside/away-far.mp4: frames 72, walking pairs 26, frozen while walking 0 (0%); legacy threshold flags 10
tmp/walkqa/final-06/depot-outside/away-near.mp4: frames 72, walking pairs 26, frozen while walking 0 (0%); legacy threshold flags 10
tmp/walkqa/final-06/depot-outside/diagonal-away-left.mp4: frames 76, walking pairs 69, frozen while walking 0 (0%); legacy threshold flags 16
tmp/walkqa/final-06/depot-outside/diagonal-away-right.mp4: frames 72, walking pairs 51, frozen while walking 0 (0%); legacy threshold flags 16
tmp/walkqa/final-06/depot-outside/diagonal-toward-left.mp4: frames 72, walking pairs 54, frozen while walking 0 (0%); legacy threshold flags 6
tmp/walkqa/final-06/depot-outside/diagonal-toward-right.mp4: frames 96, walking pairs 89, frozen while walking 0 (0%); legacy threshold flags 19
tmp/walkqa/final-06/depot-outside/diagonal.mp4: frames 72, walking pairs 51, frozen while walking 0 (0%); legacy threshold flags 16
tmp/walkqa/final-06/depot-outside/exit.mp4: frames 30, walking pairs 29, frozen while walking 0 (0%); legacy threshold flags 0
tmp/walkqa/final-06/depot-outside/object-click.mp4: frames 180, walking pairs 78, frozen while walking 0 (0%); legacy threshold flags 21
tmp/walkqa/final-06/depot-outside/post-behind.mp4: frames 120, walking pairs 40, frozen while walking 0 (0%); legacy threshold flags 6
tmp/walkqa/final-06/depot-outside/post-front.mp4: frames 120, walking pairs 28, frozen while walking 0 (0%); legacy threshold flags 6
tmp/walkqa/final-06/depot-outside/side-far.mp4: frames 72, walking pairs 28, frozen while walking 0 (0%); legacy threshold flags 6
tmp/walkqa/final-06/depot-outside/side-near.mp4: frames 72, walking pairs 28, frozen while walking 0 (0%); legacy threshold flags 6
tmp/walkqa/final-06/depot-outside/toward-far.mp4: frames 84, walking pairs 78, frozen while walking 0 (0%); legacy threshold flags 4
tmp/walkqa/final-06/depot-outside/toward-near.mp4: frames 84, walking pairs 78, frozen while walking 0 (0%); legacy threshold flags 4
tmp/walkqa/final-06/road/away-far.mp4: frames 120, walking pairs 114, frozen while walking 0 (0%); legacy threshold flags 17
tmp/walkqa/final-06/road/away-near.mp4: frames 72, walking pairs 60, frozen while walking 0 (0%); legacy threshold flags 12
tmp/walkqa/final-06/road/diagonal-away-left.mp4: frames 120, walking pairs 114, frozen while walking 0 (0%); legacy threshold flags 19
tmp/walkqa/final-06/road/diagonal-away-right.mp4: frames 96, walking pairs 89, frozen while walking 0 (0%); legacy threshold flags 20
tmp/walkqa/final-06/road/diagonal-toward-left.mp4: frames 128, walking pairs 123, frozen while walking 0 (0%); legacy threshold flags 34
tmp/walkqa/final-06/road/diagonal-toward-right.mp4: frames 92, walking pairs 86, frozen while walking 0 (0%); legacy threshold flags 22
tmp/walkqa/final-06/road/diagonal.mp4: frames 96, walking pairs 89, frozen while walking 0 (0%); legacy threshold flags 20
tmp/walkqa/final-06/road/exit.mp4: frames 87, walking pairs 86, frozen while walking 0 (0%); legacy threshold flags 2
tmp/walkqa/final-06/road/far-exit.mp4: frames 164, walking pairs 134, frozen while walking 0 (0%); legacy threshold flags 26
tmp/walkqa/final-06/road/object-click.mp4: frames 180, walking pairs 74, frozen while walking 0 (0%); legacy threshold flags 17
tmp/walkqa/final-06/road/side-far.mp4: frames 72, walking pairs 60, frozen while walking 0 (0%); legacy threshold flags 6
tmp/walkqa/final-06/road/side-near.mp4: frames 72, walking pairs 28, frozen while walking 0 (0%); legacy threshold flags 6
tmp/walkqa/final-06/road/toward-far.mp4: frames 96, walking pairs 91, frozen while walking 0 (0%); legacy threshold flags 9
tmp/walkqa/final-06/road/toward-near.mp4: frames 96, walking pairs 91, frozen while walking 0 (0%); legacy threshold flags 24
tmp/walkqa/final-06/road/trap-behind.mp4: frames 180, walking pairs 153, frozen while walking 0 (0%); legacy threshold flags 42
tmp/walkqa/final-06/road/trap-front.mp4: frames 180, walking pairs 138, frozen while walking 0 (0%); legacy threshold flags 50
tmp/walkqa/final-06/road/tree-behind.mp4: frames 154, walking pairs 153, frozen while walking 0 (0%); legacy threshold flags 22
tmp/walkqa/final-06/road/tree-front.mp4: frames 332, walking pairs 325, frozen while walking 2 (1%); legacy threshold flags 87
```

### Supplemental depth-speed audit (unchanged reviewer tools remain above)

```text
40px body-depth bins; same-cycle adjacent walking frames, >=24 pairs each; mean ground speed (not per-clip median).
alley          y=[760, 800]   side                 1.412 m/s side=1.412 ratio=1.000 n=30 evidence=['alley/diagonal-away-left.json', 84]
alley          y=[800, 840]   side                 1.329 m/s side=1.329 ratio=1.000 n=60 evidence=['alley/diagonal-toward-right.json', 16]
alley          y=[800, 840]   walk-away-right      1.091 m/s side=1.329 ratio=0.821 n=82 evidence=['alley/diagonal-away-left.json', 68]
alley          y=[800, 840]   walk-toward          1.094 m/s side=1.329 ratio=0.823 n=34 evidence=['alley/toward-near.json', 11]
alley          y=[840, 880]   side                 1.183 m/s side=1.183 ratio=1.000 n=38 evidence=['alley/diagonal-away-right.json', 32]
alley          y=[840, 880]   walk-away-right      1.432 m/s side=1.183 ratio=1.210 n=37 evidence=['alley/diagonal-away-left.json', 48]
alley          y=[840, 880]   walk-toward          1.326 m/s side=1.183 ratio=1.121 n=58 evidence=['alley/diagonal-toward-right.json', 81]
alley          y=[880, 920]   side                 1.438 m/s side=1.438 ratio=1.000 n=159 evidence=['alley/diagonal-away-left.json', 6]
alley          y=[880, 920]   walk-away-right      1.405 m/s side=1.438 ratio=0.977 n=71 evidence=['alley/diagonal-away-right.json', 13]
alley          y=[880, 920]   walk-toward          1.613 m/s side=1.438 ratio=1.121 n=29 evidence=['alley/diagonal-toward-right.json', 90]
depot-inside   y=[720, 760]   side                 1.660 m/s side=1.660 ratio=1.000 n=28 evidence=['depot-inside/diagonal-toward-left.json', 7]
depot-inside   y=[760, 800]   side                 1.420 m/s side=1.420 ratio=1.000 n=185 evidence=['depot-inside/diagonal-toward-right.json', 34]
depot-inside   y=[760, 800]   walk-away-right      1.410 m/s side=1.420 ratio=0.994 n=58 evidence=['depot-inside/away-near.json', 12]
depot-inside   y=[760, 800]   walk-toward          1.289 m/s side=1.420 ratio=0.908 n=71 evidence=['depot-inside/toward-far.json', 17]
depot-inside   y=[800, 840]   side                 1.418 m/s side=1.418 ratio=1.000 n=241 evidence=['depot-inside/diagonal-away-right.json', 15]
depot-inside   y=[800, 840]   walk-away            1.140 m/s side=1.418 ratio=0.804 n=45 evidence=['depot-inside/diagonal-away-right.json', 64]
depot-inside   y=[800, 840]   walk-away-right      1.112 m/s side=1.418 ratio=0.784 n=67 evidence=['depot-inside/diagonal-away-right.json', 46]
depot-inside   y=[800, 840]   walk-toward          1.264 m/s side=1.418 ratio=0.892 n=53 evidence=['depot-inside/diagonal-toward-right.json', 100]
depot-inside   y=[840, 880]   side                 1.360 m/s side=1.360 ratio=1.000 n=38 evidence=['depot-inside/diagonal.json', 28]
depot-outside  y=[800, 840]   side                 1.607 m/s side=1.607 ratio=1.000 n=106 evidence=['depot-outside/diagonal-toward-right.json', 24]
depot-outside  y=[800, 840]   walk-away-right      1.330 m/s side=1.607 ratio=0.827 n=68 evidence=['depot-outside/diagonal-away-left.json', 67]
depot-outside  y=[800, 840]   walk-toward          1.667 m/s side=1.607 ratio=1.037 n=85 evidence=['depot-outside/object-click.json', 52]
depot-outside  y=[840, 880]   side                 1.422 m/s side=1.422 ratio=1.000 n=115 evidence=['depot-outside/object-click.json', 7]
depot-outside  y=[840, 880]   walk-away-right      1.436 m/s side=1.422 ratio=1.009 n=69 evidence=['depot-outside/diagonal-away-right.json', 35]
depot-outside  y=[840, 880]   walk-toward          1.738 m/s side=1.422 ratio=1.222 n=110 evidence=['depot-outside/object-click.json', 66]
road           y=[760, 800]   side                 1.924 m/s side=1.924 ratio=1.000 n=86 evidence=['road/diagonal-toward-right.json', 15]
road           y=[760, 800]   walk-away-right      1.531 m/s side=1.924 ratio=0.796 n=90 evidence=['road/diagonal-away-right.json', 87]
road           y=[760, 800]   walk-toward          3.073 m/s side=1.924 ratio=1.597 n=51 evidence=['road/toward-far.json', 23]
road           y=[800, 840]   side                 1.648 m/s side=1.648 ratio=1.000 n=402 evidence=['road/trap-front.json', 85]
road           y=[800, 840]   walk-away            1.289 m/s side=1.648 ratio=0.782 n=38 evidence=['road/diagonal.json', 73]
road           y=[800, 840]   walk-away-right      1.242 m/s side=1.648 ratio=0.754 n=202 evidence=['road/far-exit.json', 66]
road           y=[800, 840]   walk-toward          2.889 m/s side=1.648 ratio=1.753 n=128 evidence=['road/toward-far.json', 56]
road           y=[800, 840]   walk-toward-right    1.403 m/s side=1.648 ratio=0.851 n=88 evidence=['road/tree-front.json', 169]
road           y=[840, 880]   side                 1.540 m/s side=1.540 ratio=1.000 n=101 evidence=['road/trap-behind.json', 2]
road           y=[840, 880]   walk-away            0.873 m/s side=1.540 ratio=0.567 n=50 evidence=['road/trap-front.json', 105]
road           y=[840, 880]   walk-away-right      1.445 m/s side=1.540 ratio=0.939 n=182 evidence=['road/diagonal-away-right.json', 52]
road           y=[840, 880]   walk-toward          2.227 m/s side=1.540 ratio=1.446 n=84 evidence=['road/toward-far.json', 78]
road           y=[840, 880]   walk-toward-right    0.987 m/s side=1.540 ratio=0.641 n=26 evidence=['road/trap-behind.json', 53]
road           y=[880, 920]   side                 1.644 m/s side=1.644 ratio=1.000 n=105 evidence=['road/trap-front.json', 4]
road           y=[880, 920]   walk-away-right      1.231 m/s side=1.644 ratio=0.749 n=121 evidence=['road/diagonal.json', 12]
road           y=[880, 920]   walk-toward          2.218 m/s side=1.644 ratio=1.349 n=54 evidence=['road/object-click.json', 64]
```

## Engineering verification outputs

The final tests include the concurrent API tests present at verification time. The gameplay proof uses the isolated API revision below; these are distinct evidence boundaries.

### `verification-06/tests-final.log`

```text

> anima@0.1.0 test:run /Users/gorkolas/Developer/anima
> vitest run

Testing types with tsc and vue-tsc is an experimental feature.
Breaking changes might not follow SemVer, please pin Vitest's version when using it.

 RUN  v4.0.16 /Users/gorkolas/Developer/anima

 ✓ api/src/__tests__/services/ground-regions.test.ts (2 tests) 44ms
 ✓ api/src/__tests__/services/ground-line.test.ts (2 tests) 36ms
 ✓ api/src/__tests__/services/floor-judge-transport.test.ts (3 tests) 305ms
 ✓ api/src/__tests__/routes/scene-image.test.ts (2 tests) 137ms
 ✓ api/src/__tests__/services/ground.test.ts (8 tests) 29ms
 ✓ packages/engine/src/__tests__/occlusion-perception.test.ts (10 tests) 41ms
 ✓ packages/engine/src/__tests__/scenes/ScenePreloadManager.test.ts (26 tests) 251ms
 ✓ packages/engine/src/__tests__/audio/SceneSoundManager.test.ts (34 tests) 49ms
 ✓ packages/engine/src/__tests__/transitions/IrisTransition.test.ts (32 tests) 75ms
 ✓ api/src/__tests__/services/places-ground.test.ts (4 tests) 92ms
 ✓ api/src/__tests__/services/floor-judge.test.ts (6 tests) 30ms
 ✓ api/src/__tests__/services/sessions.test.ts (14 tests) 83ms
stdout | api/src/__tests__/routes.test.ts > API Routes > GET /api/health > should return health status
<-- GET /api/health

stdout | api/src/__tests__/routes.test.ts > API Routes > GET /api/health > should return health status
--> GET /api/health 200 14ms

stdout | api/src/__tests__/routes.test.ts > API Routes > Session Routes > POST /api/session > should create a new session
<-- POST /api/session

stdout | api/src/__tests__/routes.test.ts > API Routes > Session Routes > POST /api/session > should create a new session
--> POST /api/session 200 1ms

stdout | api/src/__tests__/routes.test.ts > API Routes > Session Routes > GET /api/session/:id > should return session info for valid session
<-- POST /api/session

stdout | api/src/__tests__/routes.test.ts > API Routes > Session Routes > GET /api/session/:id > should return session info for valid session
--> POST /api/session 200 1ms

stdout | api/src/__tests__/routes.test.ts > API Routes > Session Routes > GET /api/session/:id > should return session info for valid session
<-- GET /api/session/sess_787226c0-179a-41de-9414-243fefe7e577

stdout | api/src/__tests__/routes.test.ts > API Routes > Session Routes > GET /api/session/:id > should return session info for valid session
--> GET /api/session/sess_787226c0-179a-41de-9414-243fefe7e577 200 1ms

stdout | api/src/__tests__/routes.test.ts > API Routes > Session Routes > GET /api/session/:id > should return 404 for non-existent session
<-- GET /api/session/sess_00000000-0000-0000-0000-000000000000

stdout | api/src/__tests__/routes.test.ts > API Routes > Session Routes > GET /api/session/:id > should return 404 for non-existent session
--> GET /api/session/sess_00000000-0000-0000-0000-000000000000 404 0ms

 ✓ api/src/__tests__/routes/world.test.ts (1 test) 71ms
stdout | api/src/__tests__/routes.test.ts > API Routes > Session Routes > PATCH /api/session/:id > should update session data
<-- POST /api/session

stdout | api/src/__tests__/routes.test.ts > API Routes > Session Routes > PATCH /api/session/:id > should update session data
--> POST /api/session 200 1ms

stdout | api/src/__tests__/routes.test.ts > API Routes > Session Routes > PATCH /api/session/:id > should update session data
<-- PATCH /api/session/sess_8aefcc50-9018-421b-af94-2c90e2bdd4e4

stdout | api/src/__tests__/routes.test.ts > API Routes > Session Routes > PATCH /api/session/:id > should update session data
--> PATCH /api/session/sess_8aefcc50-9018-421b-af94-2c90e2bdd4e4 200 1ms

stdout | api/src/__tests__/routes.test.ts > API Routes > Session Routes > PATCH /api/session/:id > should return 404 for non-existent session
<-- PATCH /api/session/sess_00000000-0000-0000-0000-000000000000

stdout | api/src/__tests__/routes.test.ts > API Routes > Session Routes > PATCH /api/session/:id > should return 404 for non-existent session
--> PATCH /api/session/sess_00000000-0000-0000-0000-000000000000 404 0ms

stdout | api/src/__tests__/routes.test.ts > API Routes > Session Routes > DELETE /api/session/:id > should delete existing session
<-- POST /api/session

stdout | api/src/__tests__/routes.test.ts > API Routes > Session Routes > DELETE /api/session/:id > should delete existing session
--> POST /api/session 200 0ms

stdout | api/src/__tests__/routes.test.ts > API Routes > Session Routes > DELETE /api/session/:id > should delete existing session
<-- DELETE /api/session/sess_cdd76307-764b-403b-8dad-9d3e72c91cd9

stdout | api/src/__tests__/routes.test.ts > API Routes > Session Routes > DELETE /api/session/:id > should delete existing session
--> DELETE /api/session/sess_cdd76307-764b-403b-8dad-9d3e72c91cd9 200 0ms

stdout | api/src/__tests__/routes.test.ts > API Routes > Session Routes > DELETE /api/session/:id > should delete existing session
<-- GET /api/session/sess_cdd76307-764b-403b-8dad-9d3e72c91cd9

stdout | api/src/__tests__/routes.test.ts > API Routes > Session Routes > DELETE /api/session/:id > should delete existing session
--> GET /api/session/sess_cdd76307-764b-403b-8dad-9d3e72c91cd9 404 0ms

stdout | api/src/__tests__/routes.test.ts > API Routes > Session Routes > DELETE /api/session/:id > should return 404 for non-existent session
<-- DELETE /api/session/sess_00000000-0000-0000-0000-000000000000

stdout | api/src/__tests__/routes.test.ts > API Routes > Session Routes > DELETE /api/session/:id > should return 404 for non-existent session
--> DELETE /api/session/sess_00000000-0000-0000-0000-000000000000 404 0ms

stdout | api/src/__tests__/routes.test.ts > API Routes > TTS Routes > POST /api/tts > should return 400 if text is missing
<-- POST /api/tts

stdout | api/src/__tests__/routes.test.ts > API Routes > TTS Routes > POST /api/tts > should return 400 if text is missing
--> POST /api/tts 400 0ms

stdout | api/src/__tests__/routes.test.ts > API Routes > TTS Routes > POST /api/tts > should return audio buffer on success
<-- POST /api/tts

stdout | api/src/__tests__/routes.test.ts > API Routes > TTS Routes > POST /api/tts > should return audio buffer on success
--> POST /api/tts 200 1ms

stdout | api/src/__tests__/routes.test.ts > API Routes > TTS Routes > POST /api/tts > should handle TTS service errors
<-- POST /api/tts

stdout | api/src/__tests__/routes.test.ts > API Routes > TTS Routes > POST /api/tts > should handle TTS service errors
--> POST /api/tts 500 0ms

stdout | api/src/__tests__/routes.test.ts > API Routes > TTS Routes > GET /api/voices > should return list of voices
<-- GET /api/voices

stdout | api/src/__tests__/routes.test.ts > API Routes > TTS Routes > GET /api/voices > should return list of voices
--> GET /api/voices 200 1ms

stdout | api/src/__tests__/routes.test.ts > API Routes > TTS Routes > GET /api/voices > should handle errors
<-- GET /api/voices

stdout | api/src/__tests__/routes.test.ts > API Routes > TTS Routes > GET /api/voices > should handle errors
--> GET /api/voices 500 0ms

 ✓ api/src/__tests__/routes.test.ts (13 tests) 54ms
 ✓ api/src/__tests__/services/narrator-voice.test.ts (4 tests) 12ms
 ✓ api/src/__tests__/routes/narrate.test.ts (8 tests) 149ms
 ✓ api/src/__tests__/services/tts.test.ts (9 tests) 10ms
 ✓ api/src/__tests__/services/exits.test.ts (1 test) 4ms
stderr | packages/engine/src/__tests__/inventory/InventoryManager.test.ts > InventoryManager > pickup and remove > pickupItem() returns false for unknown item
InventoryManager: Cannot pick up unknown item: nonexistent

stderr | packages/engine/src/__tests__/inventory/InventoryManager.test.ts > InventoryManager > pickup and remove > pickupItem() returns false for duplicate
InventoryManager: Item already in inventory: key

stderr | packages/engine/src/__tests__/inventory/InventoryManager.test.ts > InventoryManager > pickup and remove > removeItem() returns false for non-existent
InventoryManager: Cannot remove item not in inventory: key

stderr | packages/engine/src/__tests__/inventory/InventoryManager.test.ts > InventoryManager > money > spendMoney() fails if insufficient (returns false)
InventoryManager: Insufficient funds to spend: 100

stderr | packages/engine/src/__tests__/inventory/InventoryManager.test.ts > InventoryManager > combinations > combineItems() returns null if no recipe
InventoryManager: No recipe found for combining: key + coin

stderr | packages/engine/src/__tests__/inventory/InventoryManager.test.ts > InventoryManager > combinations > combineItems() returns null if player doesn't have first item
InventoryManager: Cannot combine items - missing item(s): rope, hook

stderr | packages/engine/src/__tests__/inventory/InventoryManager.test.ts > InventoryManager > combinations > combineItems() returns null if player doesn't have second item
InventoryManager: Cannot combine items - missing item(s): rope, hook

 ✓ packages/engine/src/__tests__/inventory/InventoryManager.test.ts (39 tests) 36ms
 ✓ packages/engine/src/walkarea/anchor.test.ts (3 tests) 676ms
     ✓ inside preserves authored scales and stops before captions  474ms
 ✓ packages/engine/src/characters/CharacterMotor.test.ts (12 tests) 639ms
 ✓ packages/engine/src/__tests__/scenes/BaseScene.test.ts (43 tests) 447ms
 ✓ api/src/__tests__/services/occluders.test.ts (2 tests) 5ms
 ✓ packages/engine/src/walkarea/navigation.test.ts (4 tests) 11ms
 ✓ packages/engine/src/__tests__/ui/UIState.test.ts (32 tests) 13ms
 ✓ packages/engine/src/__tests__/state/GameState.test.ts (28 tests) 10ms
 ✓ packages/storyscript/src/runtime.test.ts (3 tests) 18ms
 ✓ packages/engine/src/walkarea/perspective.test.ts (3 tests) 5ms
 ✓ packages/engine/src/__tests__/groundline/GroundLine.test.ts (3 tests) 4ms
 ✓ packages/engine/src/__tests__/verification/ArtLandmarks.test.ts (6 tests) 15ms
 ✓ packages/engine/src/__tests__/occlusion.test.ts (7 tests) 16ms
 ✓ packages/engine/src/occlusion/bridge.test.ts (2 tests) 3ms
 ✓ packages/engine/src/occlusion/exits.test.ts (4 tests) 4ms
 ✓ packages/engine/src/characters/walkHeading.test.ts (4 tests) 4ms
 ✓ packages/engine/src/debug/AgentDebug.test.ts (1 test) 5ms

 Test Files  35 passed (35)
      Tests  375 passed (375)
Type Errors  no errors
   Start at  22:22:04
   Duration  3.35s (transform 6.15s, setup 1.14s, import 12.01s, tests 3.38s, environment 19.30s)
```

### `verification-06/typecheck-engine-final.log`

```text

> @anima/engine@0.1.0 typecheck /Users/gorkolas/Developer/anima/packages/engine
> tsc --noEmit
```

### `verification-06/typecheck-game-final.log`

```text

> @anima/shadow-over-innsmouth@0.1.0 typecheck /Users/gorkolas/Developer/anima/adventures/shadow-over-innsmouth
> tsc --noEmit
```

### `verification-06/typecheck-api-final.log`

```text

> @anima/api@0.1.0 typecheck /Users/gorkolas/Developer/anima/api
> tsc --noEmit
```

### `verification-06/lint-engine-final.log`

```text

> @anima/engine@0.1.0 lint /Users/gorkolas/Developer/anima/packages/engine
> biome check .

Checked 88 files in 50ms. No fixes applied.
```

### `verification-06/lint-game-final.log`

```text

> @anima/shadow-over-innsmouth@0.1.0 lint /Users/gorkolas/Developer/anima/adventures/shadow-over-innsmouth
> biome check .

Checked 69 files in 99ms. No fixes applied.
```

### `verification-06/lint-api-final.log`

```text

> @anima/api@0.1.0 lint /Users/gorkolas/Developer/anima/api
> biome check src

Checked 40 files in 31ms. No fixes applied.
```

### `verification-06/registration-tests.log`

```text
...
----------------------------------------------------------------------
Ran 3 tests in 0.078s

OK
```

### `verification-06/verify-art-final.log`

```text

> @anima/shadow-over-innsmouth@0.1.0 verify:art /Users/gorkolas/Developer/anima/adventures/shadow-over-innsmouth
> node scripts/verify-art.mjs


=== outside (bus-station-kat-seated-composite-v1.png) — PASS (0 errors, 2 warnings) ===
[WARNING] art-internally-inconsistent :: bus
  actual:    "150 px/m at y=910"
  expected:  "315 px/m"
  use this:  "already excluded from the model (use:false)"
  note:      INTENTIONAL stylization (owner ruling 2026-07-13): painted under strict perspective scale so the frame isn't dominated. Do not repaint. Kept use:false so it stays out of the model.
[WARNING] art-internally-inconsistent :: car
  actual:    "194 px/m at y=894"
  expected:  "304 px/m"
  use this:  "already excluded from the model (use:false)"
  note:      INTENTIONAL stylization (owner ruling 2026-07-13): same as bus. Do not repaint.

=== inside (arkham-bus-depot-flat-2d.png) — PASS (0 errors, 1 warnings) ===
[WARNING] art-internally-inconsistent :: vending-machine
  actual:    "331 px/m at y=894"
  expected:  "254 px/m"
  use this:  "already excluded from the model (use:false)"
  note:      painted ~30% oversized relative to the doorway

Art verification: all scenes PASS
```

### `verification-06/town-final-live.log`

```text
start
changed-depot You paint a sweeping red spiral onto the wooden bench. It stands out starkly against the weathered timber, a bold new mark on the decaying platform, easily visible even from the far end of the harbor.
road The bus, an ancient hulk, rattles and groans as it pulls away from the depot, leaving the salt-choked air and the distant cry of gulls behind. The road ahead, cracked and overgrown, winds into the gathering gloom. The town recedes in the rearview mirror, its gabled roofs and narrow lanes swallowed by the encroaching shadows.
road-left
road-right
road-far
road-near
alley You turn from the main road, leaving the gnarled trees and oppressive fog behind. The alley beside the house is narrower, darker, and the silence here feels heavier. The scent of brine intensifies, mixing with something vaguely organic and decaying.
alley-left
alley-right
alley-far
alley-near
chosen-option Your knuckles rap against the cold, damp wood of the alley door. The sound is muffled, absorbed by the oppressive silence of the alley, but a faint, high-pitched squeaking can be heard from within.
changed-alley You paint a large, swirling red spiral across the weather-beaten wood of the door. The vibrant color stands out starkly against the grime and decay, a fresh, defiant mark in the oppressive alley.
return-0
return-1
reload
inside The heavy timber doors of the bus depot creak open as you push through, revealing the dimly lit interior. The salty air outside gives way to the stale, close atmosphere within, carrying faint echoes of distant gulls.
inside-option You step through the doorway. The stale air of the depot is immediately replaced by the damp, chilling embrace of the Innsmouth fog. The world outside is a muted tapestry of grey, the familiar platform now barely visible through the swirling mist.
finish
PASS /Users/gorkolas/Developer/anima/tmp/open-world-demo/journey.md
```

## Commits and provenance

Small commits were made on `open-world-mvp`, staged by explicit path. The following are this brief's commits; the concurrent `ecd9779` API commit is deliberately excluded.

```text
b53cc23 test(walking): audit transition completion and depth-dependent speed
03fd619 fix(proof): use valid isolated world session identifiers
b1c4cd8 fix(proof): reset narrative history before deterministic walk captures
ebb1bf9 fix: keep exit approach lookup compatible with the game TypeScript target
c86c99a fix(exits): separate stance approaches from physical travel triggers
067ecac fix(proof): save native PNG town frames without blocking conversion
95ab400 fix(exits): choose reachable approaches with room for a final stance
898d594 fix(walking): search safe stance continuations and normalize support cadence
077143c fix(proof): wait for an active exit transition before declaring failure
621ea14 fix: keep partial support pivots visible between captured frames
b15fae2 test: retain Brief 06 proof plans and independent audit commands
f652d05 docs: record Brief 06 generation costs and local matte fallback
1639a1f fix: approach the nearest reachable floor for blocked objects
dea7c81 fix: replan unsafe incoming poses before drawing a foot handoff
d01daad fix(walking): plan boundary pivots and measure arrival against the next heading
a1b15e3 feat(sprites): add longer Kling depth strides and natural cycle playback rates
a35fffe fix(walking): preserve explicit pose selection when placing a character
e37aacd fix(walking): enter safe startup poses and preserve proof geometry
c511b01 fix(walking): replan and validate physical stances at each handoff
9845320 docs(walking): retain measured Brief 06 starting conditions
6eec882 docs(walking): record Brief 06 baseline and acceptance chain
```

Final gameplay behavior is from `c86c99a` plus the ES2020 compatibility fix `ebb1bf9`; proof-session reset/identifier fixes are `b1c4cd8` and `03fd619`. `verification-06/provenance.json` records the captured source revision, unchanged reviewer-tool hashes, sprite metadata hashes, input-cache archive hash and town run. `proof-manifest.json` records every final video hash and exact frame count.

Concurrent API/floor derivation changes invalidated the cached road during an early replay. The failed cached road record was recovered from the already-loaded scene; the independent API/art work was preserved. Subsequent gameplay verification used committed API source from `d01daad`, API tree **b76e7694590455224b35936f1a49bd4711a3419b**, in an isolated runtime with a copied cache/database. Provider credentials were disabled. This is an integration test against that fixed API fixture, not a claim that the independently changing API pipeline passed the same journey. Final checkout API tests/typecheck/lint pass separately. `playtest-town.mjs --run=15 --ledger=tmp/walkqa/api-proof-env/api/data/calls.jsonl` recorded 69 calls, all cached.

The isolated runtime was removed after retaining its non-environment data/cache as `verification-06/api-proof-input-cache.tar.gz` for reproduction. Recreate a disposable checkout of the API source at the stated revision, restore that archive beneath its working root, and use the existing workspace dependencies/assets. The source and generated assets remain in the checkout. No credentials or dotenv files were written. The archive is local verification input, not a published artifact.

Generation total: **2 Kling, 1 BRIA, 0 image edits, 0 Veo**. Both Kling requests used existing keyframes; toward received BRIA. Away's upload was refused before BRIA submission and was processed with the local gray keyer. See `tmp/walkqa/calls.md`, `tmp/hermes-depth-06/REVIEW.md`, manifests, seeds and sheets. Concurrent `CALL 04a` entries are separate work and were not staged as this brief's costs.

## Cleanup

Stopped task-owned API and game process trees on 4317 and 8080. Closed brief06-road and brief06-alley; earlier depot proof sessions already closed. No other ports or sessions stopped.
Removed isolated API runtime and its symlinks after preserving data/cache as api-proof-input-cache.tar.gz (verification input; no environment files).
Removed experimental fixtures:
tmp/walkqa/CharacterMotorExperimental.ts
tmp/walkqa/CharacterMotorBeam.ts
tmp/walkqa/simulate-experiment-06.ts
tmp/walkqa/simulate-grid-06.ts
tmp/walkqa/road-trapgrid-plan.json
tmp/walkqa/experiment-06
tmp/walkqa/grid-06
tmp/walkqa/trial-06
tmp/walkqa/simulation-06
Generation raw/keyed/normalized temporary frame directories were removed earlier; source videos, manifests, seeds, source/contact sheets and final assets remain. Proof PNG sequences removed by renderer after MP4/log encoding.
Preserved unrelated API/art/debug-test work, final proof clips, historical regression evidence, source scripts and verification records. No push, merge, deployment or GitHub settings changes.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
