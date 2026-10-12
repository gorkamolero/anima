# Brief 08 — crossings, destinations and return trips

**Status: FAIL / incomplete acceptance.** Started 2026-10-12 on `open-world-mvp`, revision `58863d5`.

Read the Footfall goal, findings, complete 07/04c reports and last 20 commits. Reviewer explicitly approved both staged 04c floors. Existing shared call-ledger changes and untracked `AgentDebug.test.ts` are preserved.

Final budget used: 2/4 image edits, 29/40 segmentation calls, no generated video. Playback ports: API 4317, game 8080; all browser runs muted. No acceptance claimed until fresh visual and numerical checks complete.

## Floor installation

Removed only the contradictory global obstacle question; focused object and water/sky/wall checks remain. Installed the approved review-record candidates through the explicit reviewed replacement with previous/candidate data, overlay hash, approval date and original judge disagreement retained. GET/overlay comparisons are recorded below.

## Remaining verification

All requested object crossings, every exit round trip, town replay with zero uncached paid calls, lockcheck/walkstats, tests, typecheck, lint and verify:art.

### Installed floors and stale overlay names

Both GETs returned 200 and exactly matched the staged review records' floor arrays (`verification-08/{road,alley}-installed.json`). Fresh stored overlays are pixel-identical (ImageMagick AE=0) to final `derivation/{road,alley}-04c.png`. **The brief's `*-04c-candidate-overlay.png` files are stale**: created 00:21, whereas the recovery records and final overlays were updated through 01:31. Their contents differ from those final review records. Installation uses the final staged records explicitly named in the brief, not a raster reconstructed from an obsolete preview. Audits retain the originally supplied overlay paths; final overlay hashes and comparison evidence are in this report's verification directory. The original judge disagreement is retained without modifying its probabilities.

Removed global obstacle question only. Floor/refresh/judge tests: 14 passed. This is installation proof, not crossing acceptance.

Initial town run 21 passes the formerly failing scale-growth stage, but now fails later on alley near arrival: `near: did not stop within half a drawn stride`. Investigating; not a passing replay.

### Travel and replay diagnosis

Reciprocal connection persistence and occupied-return protection implemented and tested. Interior side edges are disabled at derivation; only labelled/authored doors remain. New physical-exit narration requires travel, and arrival uses the opposite gate with a motor-owned walk-in.

Town run 23 reaches and passes alley near/scale checks. Its next failure is a real return-routing defect: the restored alley has only a far exit, so the old test's unconditional edge-left return no longer exists. A return gate must be created for narrative trips as well as physical exits. Run 22 also exposed click-coordinate quantization: the requested half-pixel target becomes an integer DOM pointer. The checker now verifies that actual target differs by at most 1.5 px, then applies the unchanged half-stride limit to raw position and the actual target.

### Verified increments

- Town run 24 **PASS**, 56 cached calls, zero uncached calls (`tmp/open-world-demo/run-24.json`). This preceded the subsequent caption-position and physical-threshold changes; final replay will be repeated.
- Full suite: 388 tests / 39 files passed. Typecheck, lint and art verification passed at that increment; final checks remain pending.
- Alley far now completes through normal narrator travel to cached `place-aa7dd184a5f30fbc1f89`, and persists reciprocal `far`/`near` connections. Captured `exits-08/alley-far/{out,back}.mp4`: transitions 198 and 128; first visible arrivals 212 and 140. Fresh arrival frame inspection remains required.
- New harbour artwork was generated (one image edit), but remains failed because the environment question rejects rear dock pixels as water. Segmented-water exclusion and an independent foreground-platform segmentation did not clear the verdict. It was **not installed as a working place**. Normal narrator travel can reuse a matching existing place; the exterior right exit now leads to cached pier `place-96acfd3d8faaf8f903fe`. The road left exit similarly resolves to cached outskirts `place-395743b437774b879679`.
- Candidate destinations are filtered for the required opposite edge before being offered to the narrator. A failed arrival rolls back to the source instead of stranding Hermes. Disconnected polygons belonging to one side share a single persistent journey.
- Trigger regions retain their physical artwork coordinates. A reachable approach only triggers explicitly requested exits; an ordinary walk behind a tree no longer encounters an invisible displaced side gate.
- Caption UI moved above the floor, releasing the image's foreground for physical walking. The former y=948 cutoff prevented front-side approaches to foreground road nets. No floor mask was enlarged by this UI change.
- Duplicate semantic/labelled net layers are now deduplicated by normalized names, avoiding two different baselines for the same object.

### Open depot floor decision

The first new bench capture still pops at frame 47: its route passes through the gap between the legs and the seat suddenly covers Hermes (`verification-08/bench-crossing-2x.png`). Physical bench support now follows the contact polyline across the space between the legs, so this invalid route is blocked. The existing depot floor then has no route behind the bench/pergola. A new SAM dock-floor candidate covers visible wooden decking and excludes segmented water and all object silhouettes, but the environment judge still rejects the wooden rear dock as water (P=1.0). The exact candidate and disagreement are in `verification-08/dock-floor-review.json`; close-up `verification-08/dock-close.png`. A separate reviewer exception was requested asynchronously; **no answer received and no installation performed**. Road/alley approval was not extended to this new candidate.

The original failed/short bench clips remain diagnostic only and are not counted as acceptance.

### Latest review (03:02 local)

Budget: **2/4 image edits, 29/40 segmentation calls**. The rejected wooden-harbour image was not promoted. A second, stone-quay destination (`place-2a19481aac649a2e69f1`) passed the judge. Its missing left sidewalk was recovered by additional segmentation, unioned with its existing floor, and passed the ordinary judge/rederive path without any reviewer exception. Outside-right now connects to this quay; the unusable old pier connection was removed with an audit (`verification-08/rejected-pier-connection.json`).

All six primary exit pairs now have fresh out/back capture files. Depot door walk-ins increased from two frames to 22. Quay arrival is 9 walking frames; return is 24. An arrival guard fixes an unintended chained transition through the depot door next to the right edge. Transition extraction and final eye review are in progress.

Town runs 26 and 27 passed the route, but overlapped other work in the shared call ledger; **neither is the final zero-paid-call proof**. Run 28 is now running with provider credentials disabled. Full suite: 388 tests in 39 files, typecheck, lint and verify:art passed after the arrival guard.

Crossing acceptance is **not established**. Alpha-intersection review caught false positives in the initial candidate plans: a baseline switch beside an object is not a walk behind its pixels. The road right-trap route had zero alpha overlap; the crate path initially only passed beside the crate. A closer crate path hides part of a foot behind the attached net, which is not proof of walking behind the wooden crate itself. The left-net return still needs a verified return switch. These remain failures/limitations, not numerical passes promoted to visual approval. The depot bench/pergola floor exception is still awaiting an answer.


## Final verified state

- Final GETs still exactly equal both final 04c review-record floor arrays: `verification-08/{road,alley}-get-final.json`. Reviewer audits: `derivation/place-f2d0a7f7f76225002663/replace-reviewed-1791791433268.json` and `derivation/place-2635d8cd03bce818a634/replace-reviewed-1791791434282.json`.
- Town run **28 PASS**, **63 cached calls, 0 uncached calls**, providers disabled in the API process. Original record: `tmp/open-world-demo/run-28.json`; copied record: `verification-08/town28.json`.
- 388 tests / 39 files passed. Typecheck, lint, verify:art passed. Logs: `verification-08/{tests,typecheck,lint,art}-final.log`. The subsequent capture-harness-only change passed syntax and formatter checks.
- `lockcheck.py` on the four assembled crossing attempts: maximum **0.0 px**. On 29 visible exit/location segments: maximum **0.0 px**. Exact invocation paths and results are retained in `verification-08/{crossings,exits}-lockcheck.txt`.
- `walkstats.py tmp/walkqa/crossings-final-08`: all four assembled attempts have **0 off-floor, 0 object contacts**, cadence 2.13–2.20. This is **not** a visual pass and does not hide the per-leg failures below. `walkstats.py tmp/walkqa/exit-stats-08` validates each visible location segment against that location's own floor: 0 off-floor and 0 object contacts throughout, but cadence failures remain (short arrivals 0–1.45; alley outbound 2.30; failed road-left approaches 2.47). Results: `verification-08/exits-walkstats.txt`.
- All four assembled crossing attempts have 0 identical rendered frame pairs while walking (`verification-08/*freeze.txt`). This was not generalized to the exit clips.

### Crossings: eye-review outcome

All switch strips below were viewed at 2×, along with maximum-alpha-overlap crops. No rectangular occluder clipping was introduced; runtime layers use the cached object alpha. The exact overlap scans are in `verification-08/overlap.json`. No claim that all required crossings pass.

| Required object | Result and evidence |
|---|---|
| Road left tree trunk | **FAIL**: current continuous route stops beside the house under the canopy, not behind the trunk. `limitations-08/left-tree/tree-limit-out-f0177.png`; `verification-08/road-left-tree-e55fac-support-2x.png`. Rear raw floor exists, so this is **not** excused as no floor in the artwork. |
| Road left trap/net | **Partial**: deterministic initial pose produces exactly one switch each way (out frame 1, return 44), with a real net-fringe foot overlap and no box/halo visible there. This proves the fringe, not a deep walk behind the trap; do not promote it to the complete requested crossing. `crossings-final-08/left-fishing-net-0-55e961/roundtrip.mp4`. |
| Road right trap/net | **FAIL**: switches 30/164 occur beside the object; alpha-overlap scan is zero. There are 142 rear raw-floor cells in the measured contact band but zero navigable cells after clearance. This is an unresolved clearance/reachability problem, **not proof that the artwork has no floor**. `verification-08/road-right-lobster-trap-d0a0fc-support-2x.png`. |
| Alley crate | **Artwork limitation at the wooden crate**: directly backed by the wall, with 0 raw and navigable rear-band cells over its contact span. `verification-08/alley-crate-0-55e961-support-2x.png`. The attempted route switches 25/85 and only hides a boot behind the attached net at frame 42; it does not prove passing behind the wooden crate. The reviewer must decide whether this qualifies for the brief's exception. |
| Depot outside bench | **BLOCKED / not installed**: the unsafe under-seat route is fixed, but rear access requires the separate dock-floor decision. `limitations-08/outside-bench/rear-approach-f0095.png`, `verification-08/depot-outside-bench-a15409-support-2x.png`. |
| Depot pergola post | **BLOCKED / not installed**: same pending dock floor; the attempted rear approach stops in front. `limitations-08/pergola-post/rear-approach-f0095.png`, `verification-08/depot-outside-pergola-b60423-support-2x.png`. |
| Depot net pile | **Partial**: single switches 28/127, actual foot overlap with the right-hand floats/net at frame 40. Clean fringe pixels by eye, but this is a fringe pass, not a full traverse behind the pile. `crossings-final-08/fishing-net-pile-22c3fb/roundtrip.mp4`. |
| Depot inside bench | **Artwork limitation**: bench is against the wall; 0 raw or navigable rear-band cells. `verification-08/depot-inside-bench-6b9a9a-support-2x.png`, `limitations-08/inside-bench/rear-approach-f0095.png`. No fabricated walk behind the wall. |

`verification-08/limitations.json` defines the measured band (within the object's contact span, 15–150 px behind its baseline); counts alone are not proof of physical impossibility. The accompanying artwork crops and endpoint frames were inspected. Full runtime overlays are `walkareas-08/{road,alley,depot-outside,depot-inside}.png`.

### Exits: functional travel versus visual arrival

Reciprocal connections are recorded in `verification-08/connections-final.json`. The normal narrator path now resolves physical exits; subsequent visits use the cached connection. Unvisited generated exits resolve on demand; they have **not** all been previsited/verified recursively.

| Source exit | Destination / return | Final result |
|---|---|---|
| Outside left | road right / outside left | Functional out-and-back. Road arrival is on the right side but projected well inward from the literal image edge; strict edge-arrival acceptance is unresolved. |
| Outside right | new stone quay left / outside right | Functional out-and-back, 9 / 24 destination walking frames. Both sides and return inspected in `exits-08/outside-right/review-sheet.png`. No chained depot-door transition after arrival guard. |
| Depot door | inside / outside | Functional roundtrip, 22-frame walk-ins. Eye review shows the inherited exterior approach is beside the vehicle, not at the painted house doorway. **Not accepted as a frame-perfect doorway entry.** |
| Road far | alley near / road far | Functional out-and-back, 27 / 60 arrival walking frames. |
| Alley far | cached far alley near / alley far | Narration/travel failure fixed. Functional out-and-back, 27 / 100 arrival walking frames. Outbound cadence still 2.30. |
| Road left, left-1, left-2 | stored outskirts right | **FAIL**: none of the final outbound approaches transitions. The old retained harness continued to the next beat and then used road-right to outside; those are NOT returns from the outskirts. `render.json` correctly records outbound `exitCompleted:false`. Harness now stops a retained failed departure and checks its expected destination. |

Successful functional pairs have `exits-08/<name>/roundtrip.mp4` plus per-leg logs. Road-left's combined diagnostic was renamed `failed-attempt.mp4`; fragment captures are diagnostic only. Transition before/at/after paths are enumerated in `verification-08/exits.json`; visible arrival and end-frame paths in `verification-08/exits-review.json`. The primary-pair review sheets were inspected. The road-left fragment attempts reproduce the same failed departure and are not certified as round trips.

### Exact crossing switch frames

Paths below refer to the final per-leg captures, not the earlier failed candidates. `*-2x.png` beside each clip contains the before/at/after crops.

- `tmp/walkqa/occlusion-08/alley/crate-0-55e961/direct-behind-to-front.mp4`: switches [85]; frames `tmp/walkqa/occlusion-08/alley/crate-0-55e961/direct-behind-to-front-f0084.png`, `tmp/walkqa/occlusion-08/alley/crate-0-55e961/direct-behind-to-front-f0085.png`, `tmp/walkqa/occlusion-08/alley/crate-0-55e961/direct-behind-to-front-f0086.png`.

- `tmp/walkqa/occlusion-08/alley/crate-0-55e961/direct-front-to-behind.mp4`: switches [25]; frames `tmp/walkqa/occlusion-08/alley/crate-0-55e961/direct-front-to-behind-f0024.png`, `tmp/walkqa/occlusion-08/alley/crate-0-55e961/direct-front-to-behind-f0025.png`, `tmp/walkqa/occlusion-08/alley/crate-0-55e961/direct-front-to-behind-f0026.png`.

- `tmp/walkqa/occlusion-08/depot-outside/fishing-net-pile-22c3fb/direct-behind-to-front.mp4`: switches [127]; frames `tmp/walkqa/occlusion-08/depot-outside/fishing-net-pile-22c3fb/direct-behind-to-front-f0126.png`, `tmp/walkqa/occlusion-08/depot-outside/fishing-net-pile-22c3fb/direct-behind-to-front-f0127.png`, `tmp/walkqa/occlusion-08/depot-outside/fishing-net-pile-22c3fb/direct-behind-to-front-f0128.png`.

- `tmp/walkqa/occlusion-08/depot-outside/fishing-net-pile-22c3fb/direct-front-to-behind.mp4`: switches [28]; frames `tmp/walkqa/occlusion-08/depot-outside/fishing-net-pile-22c3fb/direct-front-to-behind-f0027.png`, `tmp/walkqa/occlusion-08/depot-outside/fishing-net-pile-22c3fb/direct-front-to-behind-f0028.png`, `tmp/walkqa/occlusion-08/depot-outside/fishing-net-pile-22c3fb/direct-front-to-behind-f0029.png`.

- `tmp/walkqa/occlusion-08/road/left-fishing-net-0-55e961/direct-behind-to-front.mp4`: switches [44]; frames `tmp/walkqa/occlusion-08/road/left-fishing-net-0-55e961/direct-behind-to-front-f0043.png`, `tmp/walkqa/occlusion-08/road/left-fishing-net-0-55e961/direct-behind-to-front-f0044.png`, `tmp/walkqa/occlusion-08/road/left-fishing-net-0-55e961/direct-behind-to-front-f0045.png`.

- `tmp/walkqa/occlusion-08/road/left-fishing-net-0-55e961/direct-front-to-behind.mp4`: switches [1]; frames `tmp/walkqa/occlusion-08/road/left-fishing-net-0-55e961/direct-front-to-behind-f0000.png`, `tmp/walkqa/occlusion-08/road/left-fishing-net-0-55e961/direct-front-to-behind-f0001.png`, `tmp/walkqa/occlusion-08/road/left-fishing-net-0-55e961/direct-front-to-behind-f0002.png`.

- `tmp/walkqa/occlusion-08/road/right-lobster-trap-d0a0fc/direct-behind-to-front.mp4`: switches [164]; frames `tmp/walkqa/occlusion-08/road/right-lobster-trap-d0a0fc/direct-behind-to-front-f0163.png`, `tmp/walkqa/occlusion-08/road/right-lobster-trap-d0a0fc/direct-behind-to-front-f0164.png`, `tmp/walkqa/occlusion-08/road/right-lobster-trap-d0a0fc/direct-behind-to-front-f0165.png`.

- `tmp/walkqa/occlusion-08/road/right-lobster-trap-d0a0fc/direct-front-to-behind.mp4`: switches [30]; frames `tmp/walkqa/occlusion-08/road/right-lobster-trap-d0a0fc/direct-front-to-behind-f0029.png`, `tmp/walkqa/occlusion-08/road/right-lobster-trap-d0a0fc/direct-front-to-behind-f0030.png`, `tmp/walkqa/occlusion-08/road/right-lobster-trap-d0a0fc/direct-front-to-behind-f0031.png`.


### Remaining work / approval boundary

The dock candidate is still **uninstalled**. The water/sky/wall question was kept as requested; its water probability remains 1.0 for this separate candidate. The earlier road/alley approval does not authorize overriding this unrelated verdict. The asynchronous approval request has no answer. Its exact candidate, previous floor and disagreement remain in `verification-08/dock-floor-review.json`, with `verification-08/dock-close.png` for review.

Approval of that candidate alone will not make Brief 08 pass: road trunk/right-trap reachability, literal edge/door arrivals, failed road-left exits and remaining cadence/visual proof still need work. This report is deliberately **FAIL**, not a claim that every required crossing and exit was verified successfully.

Cleanup verified: task servers stopped; neither 4317 nor 8080 is listening. All five task browser sessions closed. No push, merge, deploy, settings changes, keys, or dotenv files written. No task raw-frame staging directories remain; clips, telemetry, caches and verification records are retained. Pre-existing `tmp/walkqa/calls.md` edits and `packages/engine/src/debug/AgentDebug.test.ts` were preserved.
