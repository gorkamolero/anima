# Brief 09 — finish crossings and exits

**Status: FAIL — partial implementation, with explicit evidence of the remaining failures.** Started 2026-10-12 on `open-world-mvp`. Final implementation: `daad1ea` (plus its preceding Brief 09 commits). No source changes during the definitive capture pass.

Read `docs/FOOTFALL-GOAL.md`, Brief 08 and the reviewer findings. Pre-existing `tmp/walkqa/calls.md` edits and untracked `packages/engine/src/debug/AgentDebug.test.ts` are preserved.

Budget used: **0/2 image edits, 0/30 segmentation calls, no generated video**. All game playback uses `?mute=1`, API 4317 and game 8080. Recorded game clips are frame-perfect captures, not generated video.

## Approved dock installation

Installed through the new explicit `replaceReviewedAnchorFloor` path, corresponding to the existing reviewed replacement for generated places. It stores the previous and candidate floors, `approvedBy: "reviewer"`, date `2026-10-12`, both reviewed overlays and their SHA-256 hashes, and the unchanged judge disagreement. The environment verdict remains P=1.0; no judge answer was rewritten.

- Audit: `tmp/walkqa/derivation/anchor-2ba79a535c078ef2c2086a41bd5e0c664d2370643a074c014a0522b07ada6298/replace-reviewed-1791797585124.json`.
- Approved overlays: `tmp/walkqa/verification-08/dock-close.png`, `dock-candidate.png`.
- Initial GET: `verification-09/dock-installed.json`.
- Network GET `/api/occluders/outside`: **200, exact candidate floor match**, `verification-09/dock-get-final.json`.
- Regenerated occluder PNGs were pixel-identical (AE=0); metadata-only changes were restored. Evidence: `verification-09/occluder-pixel-comparison.json`.

## Implementation and diagnosis

The physical radius remains **0.15 m**, applied to object supports. `clearanceMask` governs drawn-body collision, and actual sole contacts must remain on the raw floor. The route mask adds only a **single 5 px raster-cell margin**, rejecting thin reconstruction slivers without eroding open floor by the physical radius. Separating those two masks was necessary: treating a routing margin as a body collision boundary prevented literal-edge walk-ins.

The road right trap's 142 rear raw-floor cells were being removed by the old whole-floor erosion. Object-only clearance restored that rear band. The left trunk had a second fault: small gaps between the coarse floor mask and object alpha prevented the existing two-sided hidden-floor bridge. The bounded bridge now tolerates up to 20 px of disagreement at silhouette boundaries/internal alpha gaps, still requiring visible floor at both outer ends and subtracting all physical supports afterwards. This also connects the road's right-edge floor pocket to the main road. It does not grant a general fill behind walls or one-sided silhouettes.

All three road-left fragments share the primary reachable approach as well as the same persistent journey. Their artwork trigger polygons remain in place. Side arrivals select an actual boundary-floor row, start at **x=0 or x=1919.999**, and walk inward. The walking clock targets 1.8–2.0 steps/s, with a minimum 1/2.2 second support even for partial turns. The motor checks continuation at terminal footfalls and stops when an identical support detour repeats (0.1 px quantization).

Town runs 29–34 and 36 are retained failed diagnostics. The broad partial-support search experiment was removed. **Town run 37 PASS: 63 cached calls, 0 uncached calls**, including both returns, reload and finish. Source: `tmp/open-world-demo/run-37.json`; log: `verification-09/town37.log`. Run 35 also passed, but precedes the final motor guard.

## Definitive capture pass

Use only `tmp/walkqa/proof-09/` for final acceptance. Other `*-09` capture folders are retained diagnostics. Capture implementation was frozen at `daad1ea`. PNG frames were captured at 24 fps and encoded locally; telemetry has one row per frame. Temporary source-frame directories have been removed after encoding/review.

| Crossing | Result | Maximum real alpha overlap behind object | Round-trip cadence | Lock / off-floor / contacts |
|---|---|---:|---:|---|
| Road left tree trunk | Full front → behind → front | 9,236 pixels | 1.88 steps/s | 0 px / 0 / 0 |
| Road right trap/net | Full front → behind → front | 281 pixels outbound; return scan also positive | 1.90 | 0 px / 0 / 0 |
| Depot pergola post | Full round trip via wide left approach | 5,201 pixels | 1.95 | 0 px / 0 / 0 |
| Depot bench | FAIL: rear traverse not completed | 0 in final bounded attempt | Attempt only | 0 px / 0 / 0 |
| Depot net pile | FAIL: partial overlap, no full traverse | 954 pixels | Attempt only | 0 px / 0 / 0 |
| Alley wooden crate | Existing wall-backed artwork limitation | Not claimed | N/A | Prior evidence retained |

Round-trip videos and telemetry: `proof-09/roundtrips/{left-tree-e55fac,right-lobster-trap-d0a0fc,pergola-b60423}/roundtrip.mp4` and `.json`. Their matching `area.json` uses raw floor for sole checks and physical object supports for contacts.

Exact event crops live beside each source clip in `proof-09/crossings/road/` and `proof-09/crossings/depot-pergola/`: `*-baseline-*-2x.png`, `*-alpha-entry-*-2x.png`, `*-alpha-exit-*-2x.png`, and `*-max-overlap-*-2x.png`. Each strip contains frames immediately before/at/after the event (clip endpoints have only available adjacent frames). `*-alpha-scan.json` records every frame, actual nontransparent object/sprite intersection and depth relation. Index: `verification-09/proof-crossings-review.json`.

By-eye review: the tree conceals Hermes while he crosses its rear; he reappears on the other side. Trap overlap is mainly at the boots against the trap top, not a full-body disappearance. The pergola post visibly cuts across his body; he returns around the same wide left approach. Baseline switches happen away from the object silhouette, so alpha-entry/exit crops are the stronger visual evidence. Reviewed all eight exit sheets and the crossing baseline/alpha/max-overlap crops.

**Cadence caveat:** all three assembled round trips pass, but four short pergola waypoint clips fail the unchanged estimator: `pergola-front-to-behind` 1.00, `pergola-clear` 1.23, `pergola-behind-side` 1.37, `pergola-side` 1.53. They remain failures under “all new clips”; concatenation does not waive those failures. The four road crossing legs individually pass (1.78–1.86).

## Exits

All **8 pairs / 16 legs** completed their actual transition and walk-in, with exactly one location change per leg: outside-left, outside-right, road-left, road-left-1, road-left-2, road-far, alley-far, depot-door. All three road-left outbound approaches now work. Each folder `proof-09/exits/<pair>/` contains source legs, `roundtrip.mp4`, telemetry, `render.json`, a `review-sheet.png`, exact transition PNGs and 2× arrival crops. Index: `verification-09/proof-exits-review.json`.

Side-edge pairs visibly enter partly off-frame and walk in. The placement call uses x=0/1919.999; the first captured visible walking frame has already advanced inward by 6–21 px. Near/far arrivals retain the authored approach positions: road→alley and alley→far-alley first visible foot y is about 1039–1040 rather than literal y=1080, and return far entries are internal vanishing-point approaches. Thus the broad “every edge pair” interpretation is **not satisfied** for near/far. See `proof-09/exits/{road-far,alley-far}/review-sheet.png`.

The alley outbound approach now measures **1.91 steps/s**, below the previous 2.30. All 32 visible location-specific exit segments have **0 px lock drift, 0 off-floor samples and 0 object contacts**. However 19/32 segments measure below 1.6 steps/s (range 1.09–1.57), mostly short approach/walk-in portions. Full unchanged output is reproduced below; these are numerical acceptance failures, despite the support-duration clamp. No checker or acceptance threshold was changed.

Freeze scan: all three crossing round trips and seven exit round trips have zero identical rendered walking pairs. Outside-left has **2 identical visible walking pairs**, combined frames 238 and 239, on the road return approach. Evidence: `verification-09/proof-freeze.txt`, `proof-frozen-pairs.json`. No global zero-freeze claim is made.

## Named limitations

**Dock bench and net rear passage:** the installed floor has thin disconnected/connected reconstruction strips behind the furniture. At x=1100–1320, one candidate rear band is only y=705–720 (15 px). The roughly 40 px lateral projection of the model's 0.3 m diameter is **not** a ground-depth measurement, so it must not be used to claim the painted deck is physically impassable. Direct and staged porch/pier routes have been attempted; the motor stalls or repeats a detour before completing the traverse. A full bench/net crossing is not proven. Evidence: `verification-09/dock-strip-measurements.json`, `dock-rear-strip-2x.png`, `dock-waypoints.json`, and `proof-09/limitations/dock/rear-traverse-attempt.mp4`. This final 600-frame (25-second) bounded attempt ends still walking near the net; the capture command deliberately exits nonzero because the walk did not complete. There is no fabricated return leg. Endpoint crops: `verification-09/bench-attempt-end-2x.png` and `net-attempt-end-2x.png`; overlap evidence: `verification-09/proof-limit-overlap.json`. This is a floor-reconstruction/drawn-stride limitation, not an approved artwork exception.

**Alley wooden crate:** keep the reviewer-confirmed wall-backed artwork limitation. The rear contact band has 0 raw and navigable floor cells. Evidence retained unchanged: `verification-08/alley-crate-0-55e961-support-2x.png`, `verification-08/limitations.json`, and `occlusion-08/alley/crate-0-55e961/`. The old attached-net fringe overlap is not promoted to a wooden-crate traverse.

## Regression checks

- **393 tests / 40 files PASS** (`verification-09/tests-final.log`).
- Typecheck and lint **PASS** (`typecheck-final.log`, `lint-final.log`).
- `verify:art` **PASS**, with existing authored-art notes (`art-final.log`).
- `playtest-town.mjs` run 37 **PASS**, 63 cached calls, **0 uncached calls** (`verification-09/town37.json`, `town37.log`).
- Reviewer scripts unchanged: `proof-crossings-{lockcheck,walkstats}.txt`, `proof-crossing-legs-{lockcheck,walkstats}.txt`, `proof-exits-{lockcheck,walkstats}.txt`, `proof-limit-{lockcheck,walkstats}.txt`, all under `verification-09/`.
- Tests passing is not acceptance: bench/net, short cadence and near/far placement failures remain above.

## Reviewer decisions needed

1. Whether to accept the documented **dock bench/net reconstruction and drawn-stride limitation**, or require another reconstruction pass. The painted deck has not been proved physically too narrow. Compare `tmp/walkqa/verification-09/dock-rear-strip-2x.png`, `bench-attempt-end-2x.png`, `net-attempt-end-2x.png` with the approved `tmp/walkqa/verification-08/dock-close.png` and `dock-candidate.png`. The approved floor itself stays installed; this is not a request to reopen the water verdict.
2. Whether the unchanged cadence estimator's short-clip failures may be waived. The report defaults to **FAIL**, not a waiver. Representative images: `tmp/walkqa/proof-09/exits/depot-door/review-sheet.png`, `outside-right/review-sheet.png`, and `tmp/walkqa/proof-09/crossings/depot-pergola/pergola-front-to-behind-max-overlap-0022-2x.png`. Exact figures below and in the crossing-leg output.
3. Whether “edge” includes the authored near/far perspective passages. Side-edge arrivals satisfy the requested clipping; near/far are explicitly not certified. Images: `tmp/walkqa/proof-09/exits/road-far/review-sheet.png` and `tmp/walkqa/proof-09/exits/alley-far/review-sheet.png`.

## Exit cadence output

Location IDs map to road `place-f2d0a7f7f76225002663`, alley `place-2635d8cd03bce818a634`, outskirts `place-395743b437774b879679`, quay `place-2a19481aac649a2e69f1`, far-alley `place-aa7dd184a5f30fbc1f89`.

```text
clip                                         walk s  dist px off-floor steps/s object-contacts
inside/depot-door-door-inside-to-outside.json    0.8      72    0/18    1.33 0
inside/depot-door-door-outside-to-inside.json    0.9      87    0/22    1.09 0
outside/depot-door-door-inside-to-outside.json    0.9      90    0/22    1.09 0
outside/depot-door-door-outside-to-inside.json    1.9     460    0/46    1.57 0
outside/outside-left-back.json                  1.5     385    0/35    1.37 0
outside/outside-left-out.json                   1.9     298    0/46    1.57 0
outside/outside-right-back.json                 1.5     386    0/35    1.37 0
outside/outside-right-out.json                  2.4     353    0/58    1.66 0
place-2635d8cd03bce818a634/alley-far-back.json    4.5      72    0/108   1.78 0
place-2635d8cd03bce818a634/alley-far-out.json   10.0     202    0/239   1.91 0
place-2635d8cd03bce818a634/road-far-back.json    4.5     136    0/109   1.76 0
place-2635d8cd03bce818a634/road-far-out.json    0.9      83    0/22    1.09 0
place-2a19481aac649a2e69f1/outside-right-back.json    1.5     262    0/37    1.30 0
place-2a19481aac649a2e69f1/outside-right-out.json    0.9     301    0/22    1.09 0
place-395743b437774b879679/road-left-1-back.json    0.9     208    0/21    1.14 0
place-395743b437774b879679/road-left-1-out.json    0.9     298    0/22    1.09 0
place-395743b437774b879679/road-left-2-back.json    0.9     208    0/21    1.14 0
place-395743b437774b879679/road-left-2-out.json    0.9     298    0/22    1.09 0
place-395743b437774b879679/road-left-back.json    0.9     208    0/21    1.14 0
place-395743b437774b879679/road-left-out.json    0.9     298    0/22    1.09 0
place-aa7dd184a5f30fbc1f89/alley-far-back.json    1.5      92    0/35    1.37 0
place-aa7dd184a5f30fbc1f89/alley-far-out.json    0.9      76    0/21    1.14 0
place-f2d0a7f7f76225002663/outside-left-back.json    3.0     353    0/72    1.67 0
place-f2d0a7f7f76225002663/outside-left-out.json    4.7     405    0/112   1.71 0
place-f2d0a7f7f76225002663/road-far-back.json    2.5      61    0/61    1.57 0
place-f2d0a7f7f76225002663/road-far-out.json    3.8     106    0/91    1.85 0
place-f2d0a7f7f76225002663/road-left-1-back.json    3.1     392    0/74    1.62 0
place-f2d0a7f7f76225002663/road-left-1-out.json    9.1     852    0/218   1.87 0
place-f2d0a7f7f76225002663/road-left-2-back.json    3.1     392    0/74    1.62 0
place-f2d0a7f7f76225002663/road-left-2-out.json    9.1     852    0/218   1.87 0
place-f2d0a7f7f76225002663/road-left-back.json    3.1     396    0/75    1.60 0
place-f2d0a7f7f76225002663/road-left-out.json    9.1     852    0/218   1.87 0
```

## Commits and cleanup

Implementation commits: `4740817` reviewed floor audit path; `f344403` clearance/bridge separation; `d673c52` cadence/repeated supports; `30304f3` safe terminal continuation; `daad1ea` side approaches and arrivals. All use the requested Claude co-author trailer. Evidence/report commits follow separately by path. No push, merge, deployment, settings changes, credentials or dotenv writes.

API 4317 and game 8080 stopped. Task browser sessions closed; the pre-existing `anima` session is preserved. Task-created raw-frame staging removed, with clips, telemetry, failed diagnostics and audit records retained. Original dirty `calls.md` and untracked `AgentDebug.test.ts` remain untouched.
