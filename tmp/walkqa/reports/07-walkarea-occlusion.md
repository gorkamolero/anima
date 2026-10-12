# Brief 07 — walk areas, occlusion and exits

**Status: NOT ACCEPTED.** Object-support exclusion, compatibility and freeze regressions are fixed and tested. Complete walk-behind, exit and speed acceptance remains unmet; see the final audit below.

Read the Footfall goal, complete findings (including F10–F12), Brief 06 and 04a reports, current 04b report, and git log -20. Starting revision: 9f63dc8 on open-world-mvp. Brief 04b has not committed; its dirty API ground/routes, tests, corpus manifest, call ledger and anchor mask images are preserved. No edits to its reserved paths until its commit lands.

## Budget

**8/60 segmentation calls**, zero image/video generation. The MP4s are game-frame captures, not generated video. Calls are copied to `verification-07/segmentation-calls.md`. Task-owned API/game use 4317/8080, muted, with paid provider credentials disabled during playtests.

## Findings

- Anchor runtime currently uses only the authored band. Generated and anchor runtime bridge silhouettes strictly above baseline but do not reserve object support thickness or subtract footprints.
- Brief 06 freezes are frames 300–301 of road/tree-front: a partial support is stretched to a full nominal step.
- Existing proof near/far depth labels do not establish distinct depot walks.

## Acceptance outstanding

Geometry implementation and regression tests; anchor segmented floor integration; mask completeness comparisons and visual review; all-scene overlays; old-version loading and explicit rederivation; cadence/freeze fixes and before/after speed audit; every reachable occluder crossing; every exit and return; full checks and cached town journey. No previous brief's evidence is counted as Brief 07 acceptance.

## Engine support subtraction (first increment)

Added baseline-adjacent silhouette footprints for every runtime occluder, using a depth-scaled 0.15 m support strip and subcell alpha sampling. Subtraction runs after bridge construction; existing perspective-aware 0.3 m body erosion supplies clearance. Physical footprint pixels are exported as `area.objectFootprints`; `walkstats.py` reports object contacts separately and explicitly prints MISSING for historical logs without footprint geometry. Negative out-of-image contacts now use floor rounding.

Validation: two footprint tests pass (behind-strip bridge preserved, support and below-baseline pixels excluded, body dilation enforced, mismatched grids rejected). Engine and game typechecks pass. This is not yet anchor floor intersection or a visual geometry sign-off.

## Floor intersection and first visual audit

Cached anchor floor masks were available, requiring zero paid calls. `/occluders/:scene` now supplies segmented floor; anchor runtime intersects the authored band with segmented/bridged floor before support subtraction. All ten runtime overlays were rendered with `tools/overlay07.py` and opened individually.

Observed failures: depot-outside green avoids nets but authored disjoint ranges leave isolated left/right patches; depot-inside has a very narrow band and its current occluder response is empty. Road's stored 04b floor has only a central patch, preventing left-tree reachability; alley has foreground floor only and an empty occluder response. Pier retains tiny disconnected deck patches. Stepped-street's labelled lamp-post mask incorrectly includes background building/stairs. Church green is within central aisle; lobby green remains on floor/rug; grocery green stays within central/foreground floor; square green avoids fountain/plinth but has no established rear route. These are initial diagnostics, not final acceptance. Files: `walkareas/<scene>.png`, underlying `geometry-07/<scene>/{area,navigation}.json`.

## Compatibility and timing increments

04b landed as bdbc1cf, releasing its reserved API files. Added explicit `POST /api/places/:id/rederive` using the existing image and stable ID. Timestamped start/result audit JSON is stored in that place's proof directory. Failed replacement preserves a previously working record. Regression sets derivationVersion=-100, GETs it, finds a walking path, and verifies no implicit derivation; explicit rederive and failed-replacement preservation also pass (4 service tests).

Motor partial turns now retain complete-stance frame timing instead of stretching a few poses across an entire step. Animation cadence interpolates 1.6–2.2 steps/s from far to near navigable depth; contact placement remains unchanged. Thirteen motor tests pass, including a new depth-cadence/anchor-preservation test. Actual clip freeze/speed verification is still outstanding.

## Mask and capture corrections

Seven SAM2 calls reserved under CALL 07 (hard 60-call scope): right net pile, missing left net pile, exterior bench, pergola, interior bench, corrected stepped-street lamp, and interior bus. Boxes were checked against the current source artwork; old anchor labels had coordinates from different artwork. No source image/video generation. Alpha construction now retains all segmented components instead of silently retaining only the largest. Independent PNG comparison (`tools/maskcoverage07.py`, `verification-07/mask-coverage.json`) reports zero missing reference pixels for each checked anchor occluder. Segmentation coverage is not a semantic guarantee; visual inspection remains required.

A complete-stance timing allocator caps each source frame at 1/24 s and redistributes remaining cycle time across longer supports. Production cycle cadence stays 1.6–2.2; partial entries retain their full support timing. Thirteen timing/motor tests pass. First road captures: zero off-floor/footprint contacts; measured cadence 1.60–1.95. The first independently checked road clip has zero frozen walking frames and zero lock excursion. Toward speed still exceeds side; final per-depth audit remains outstanding.

The scene loader previously swallowed geometry failures, letting proofs capture an unfiltered initial area. Geometry failures now stop walking, clear navigability, and make render-walk refuse the proof. Raising the object-list capacity to 32 permits the newly identified second net pile without dropping existing objects.

Town run 17 stopped at the cached painted-depot variant (no variant floor cache). Added unchanged-pixel floor reuse: difference against the segmented anchor removes every changed floor cell. This never adds new floor and requires no segmentation call. Final town rerun pending.

The old exterior disjoint authored ranges prevented any route through the centre even after safe object subtraction; the interior line also acted as a shallow maximum floor boundary. Anchor bands now use explicit floor extents through the image bottom (caption clipping still happens after erosion). Perspective calibration lines remain unchanged. Segmentation and physical supports provide the actual exclusions. Final overlays and walks must be recaptured for these expanded bands; earlier narrow-band proofs are diagnostic only.


## Final audit of this implementation

Source: `7a7abcf` and `86bf303` (with preceding `1ce7eed`, `aa4bcdb`, `d603a56`). 04b's `bdbc1cf` landed before any reserved ground/routes changes. The introduction above records the initial state, not a continuing lock on those files.

### Geometry and masks: reviewed overlays, limited reachability

Every following overlay was opened by eye. Green is the final eroded body-centre walk mask; red is the physical object support (Hermes clearance comes from erosion); cyan outlines the complete occluder mask; yellow is its baseline. No green was observed on red supports or visible object bases. This does not establish that all valid floor is reachable.

| Scene | Overlay | Visual result / limitation |
|---|---|---|
| depot-outside | `walkareas/depot-outside.png` | Green excludes both net piles, bench supports, pergola posts and vehicle; foreground is connected. Right net pile has no reachable behind strip. |
| depot-inside | `walkareas/depot-inside.png` | Green on foreground floor, outside bench and bus; no floor behind the bench against the wall. |
| road | `walkareas/road.png` | Central floor excludes nets/traps. Left tree remains inaccessible because stored 04b ground lacks that route. This does **not** prove the artwork genuinely forbids it. |
| alley | `walkareas/alley.png` | Foreground floor avoids crate/basket. Stored ground has lost the deeper corridor and exits; regression remains. |
| pier | `walkareas/pier.png` | Tiny disconnected safe deck patches; severely incomplete coverage. |
| stepped-street | `walkareas/stepped-street.png` | Corrected lamp mask covers the lamp, not the building/stairs; green stays on lower steps. |
| church | `walkareas/church.png` | Central aisle, excluded pew/pulpit supports. |
| lobby | `walkareas/lobby.png` | Floor/rug remains green, furniture excluded; narrow stair access. |
| grocery | `walkareas/grocery.png` | Foreground/central floor excludes barrel/sack supports. |
| square | `walkareas/square.png` | Green excludes fountain/plinth; rear route not established. |

`verification-07/mask-coverage.json` compares emitted anchor alpha against each SAM reference: zero missing reference pixels for the checked masks. The box/segmentation was also visually checked, including the new left net pile and corrected lamp/bus. Full segmentation coverage alone cannot certify semantic object completeness. The eighth call separately segments the cached painted-depot floor after unchanged-pixel inheritance proved too sparse (`verification-07/painted-floor.png`).

### Walking statistics and speed

`final-07/<scene>/` contains 16 near/far/away/toward clips. All 16: **0 off-floor contacts, 0 object-footprint contacts, 0 frozen walking frames, maximum lock excursion 0.0 px**. Commands and raw output are in `verification-07/{walkstats,lockcheck,freeze}.txt`. These clips precede the final planted-sole depth-order fix; they validate movement, not its final draw order. Final draw-order clips are under `occlusion-07/`.

Depot near/far plans now request different depths: outside differs by 100 px and inside by 65 px. Some resulting walks are too short to establish a complete cadence cycle. Reported per-clip cadence ranges outside 1.6–2.2 on those partial walks; no exemption or pass is claimed. The complete-cycle timing unit test stays inside the natural range while every source frame advances within 1/24 second. The former partial-stance freeze mechanism is removed.

Before/after measurements are in `verification-07/depth-before-after.md`, reproduced below. These are actual adjacent same-cycle ground-displacement samples grouped by 40 px body depth, not a controlled identical-route experiment: geometry, route and support phase differ between briefs. At least six pairs are retained to expose sparse evidence; sample counts are explicit. **Speed acceptance fails** (for example road toward at 760–800 is 3.100 m/s versus side 1.663). Cadence modulation alone has not equalized perspective speeds. No sliding or new animation was introduced.

| Scene | Body y | Cycle | Before m/s (pairs) | After m/s (pairs) |
|---|---|---|---|---|
| alley | 880–920 | side | 1.438 (159) | 1.262 (18) |
| alley | 880–920 | walk-away-right | 1.405 (71) | 1.014 (21) |
| alley | 880–920 | walk-toward-right | no sample | 1.003 (11) |
| alley | 920–960 | walk-away-right | 1.272 (9) | 1.269 (7) |
| depot-inside | 880–920 | side | no sample | 1.182 (63) |
| depot-inside | 880–920 | walk-toward | no sample | 0.853 (13) |
| depot-inside | 880–920 | walk-toward-right | no sample | 0.932 (12) |
| depot-inside | 920–960 | side | no sample | 1.201 (27) |
| depot-inside | 920–960 | walk-away-right | no sample | 0.959 (20) |
| depot-outside | 800–840 | side | 1.607 (106) | 1.541 (8) |
| depot-outside | 800–840 | walk-away | 0.464 (6) | 1.204 (11) |
| depot-outside | 800–840 | walk-toward | 1.667 (85) | 1.935 (19) |
| depot-outside | 800–840 | walk-toward-right | no sample | 1.389 (12) |
| depot-outside | 840–880 | side | 1.422 (115) | 1.090 (11) |
| depot-outside | 840–880 | walk-away | 1.403 (22) | 1.807 (13) |
| depot-outside | 840–880 | walk-toward | 1.738 (110) | 1.602 (7) |
| depot-outside | 880–920 | walk-away-right | 0.963 (47) | 1.815 (11) |
| depot-outside | 920–960 | side | no sample | 1.470 (15) |
| depot-outside | 920–960 | walk-away-right | no sample | 1.049 (14) |
| road | 760–800 | side | 1.924 (86) | 1.663 (80) |
| road | 760–800 | walk-away-right | 1.531 (90) | 1.466 (7) |
| road | 760–800 | walk-toward | 3.073 (51) | 3.100 (18) |
| road | 800–840 | walk-away-right | 1.242 (202) | 1.490 (31) |
| road | 800–840 | walk-toward | 2.889 (128) | 2.706 (35) |
| road | 840–880 | walk-away-right | 1.445 (182) | 1.411 (24) |
| road | 840–880 | walk-toward | 2.227 (84) | 2.312 (28) |
| road | 880–920 | side | 1.644 (105) | 1.841 (9) |
| road | 880–920 | walk-away-right | 1.231 (121) | 1.756 (17) |
| road | 880–920 | walk-toward-right | no sample | 1.384 (11) |
| road | 920–960 | side | 1.601 (19) | 1.541 (18) |
| road | 920–960 | walk-away-right | 1.069 (12) | 1.533 (9) |

### Walk-behinds: inspected frame evidence, not accepted

Draw depth now follows the planted sole, with baseline evaluated at that sole's x. This removes the former three-switch chatter within a support. `verification-07/crossings.json` lists every detected switch and the exact preceding/at/following frame. All five final crossing triptychs were opened by eye.

| Object | Final direct clips / crossing frames | Result |
|---|---|---|
| outside bench | `occlusion-07/depot-outside/bench-a15409/direct-front-to-behind-f000{3,4,5}.png`; return `direct-behind-to-front-f002{3,4,5}.png` | One switch each way. Mask hides the overlapping bench pixels, but the overlap changes abruptly at crossing: no-popping acceptance **not met**. |
| outside left net pile | `occlusion-07/depot-outside/left-fishing-net-pile-19404d/direct-front-to-behind-f000{2,3,4}.png`; return `direct-behind-to-front-f002{6,7,8}.png` | One switch each way, pile pixels occlude his leg. This only exercises the left fringe, not a complete traversal behind the pile. |
| outside pergola | `occlusion-07/depot-outside/pergola-b60423/direct-front-to-behind-f000{3,4,5}.png` | Forward switches once; return has zero walking frames. This overlaps the bench region and does not establish a post traversal. **Fail**. |
| outside right net, small house, van | Individual `reachability.json` plus outside overlay | No behind cells in final navigable mask; no passing crossing proof. |
| inside bench, bus | Individual reachability files plus inside overlay | No behind cells; no passing crossing proof. |
| road left tree, left trap/net, right trap/net | `verification-07/occluder-reachability.json`, road overlay | No reachable behind cells. Foreground-tree requirement remains unresolved. |
| alley crate, fish basket | Same reachability report, alley overlay | No reachable behind cells. |

Original object-click clips that did not cross are retained with zero crossings, not counted as successes. `plan-direct.json` uses the real pathfinder and motor via `walkGenerated` to target hidden floor explicitly.

### Exits: real door round trip, remaining failures

`verification-07/exits.json` lists all logic transitions and extracted frames; `visible-exits.json` distinguishes the later visible background change from the earlier location-ID change. Transition sheets were opened by eye. A location-ID change alone is not scene-load proof.

| Exit | Evidence | Result |
|---|---|---|
| outside depot door → inside → outside | `exits-07/roundtrip/door-outside-to-inside.mp4`, `door-inside-to-outside.mp4`, associated PNGs | Continuous round trip, no scene reset or second-start teleport between legs. One location change each way (frames 37 and 5). Both final frames visibly show the destination; entry is on floor by the corresponding right-side doorway. |
| road edge-left | `exits-07/road/edge-left.mp4`, frames 10/11/12 and 179 | One transition to outside; final background loaded. Return not proven; arrival-side acceptance not established. |
| road far | `exits-07/road/far.mp4`, frames 139/140/141 and 195 | One transition to cached place-395743b437774b879679; final background loaded. Return not proven. |
| outside edge-left / edge-right | `exits-07/depot-outside/edge-{left,right}.mp4`, frames 0/183 | No transition: anchor edge handler has no destination. **Fail**. |
| inside edge-left / edge-right | `exits-07/depot-inside/edge-{left,right}.mp4`, frames 0/183 | No transition. **Fail**. |
| alley far / edges | `exits-07/alley/render.json`, alley overlay | Current derived floor exports no exits. Brief 06 far-exit narration failure is **not fixed**, now additionally obscured by lost floor coverage. |

### Compatibility, checks and cached town

Old derivation versions remain loadable and walkable. `api/src/services/places-ground.test.ts` explicitly stores version -100, loads it without derivation, and finds a walk path. `POST /api/places/:id/rederive` is an explicit stable-ID refresh with timestamped started/result audit files; failed replacement preserves the previous working record.

- `pnpm test:run`: **382 tests / 38 files passed**.
- `pnpm typecheck`: passed.
- `pnpm lint`: passed after formatting; repeated runtime writes of identical landmark templates removed.
- `pnpm --filter @anima/shadow-over-innsmouth verify:art`: passed with existing intentional warnings.
- `playtest-town.mjs`, run 20: **FAILED** at “Scale did not grow toward camera” in the shallow alley floor. **27 calls, all cached, zero uncached paid calls**. Source was this checkout, provider credentials disabled; no isolated old API workaround. `tmp/open-world-demo/run-20.json`, `verification-07/town20.log`.

The brief is not complete. Remaining work is safe floor coverage/route recovery (especially alley/tree), real post/net crossings without popping, anchor edge destinations and all return journeys, alley narration completion, and speed/cadence acceptance on sufficient-length walks. Passing static checks do not override these visual failures.


### Final arrival correction and cleanup

Final door round-trip recapture is at `7a7abcf`. Loading no longer exposes the default spawn on the wrong side: Hermes stays hidden until geometry and the entry position are ready. Opened `verification-07/door-arrivals.png`: first visible interior arrival is frame 48 (preceding/at/after PNGs 47/48/49), exterior arrival is frame 12 (11/12/13). Both are on the floor beside the corresponding doorway. Logs include `visible` to distinguish a loaded background from a placed character. Exact paths: `verification-07/door-arrivals.json`. Typecheck and lint passed again after this correction.

API 4317 and game 8080 were stopped; `lsof` confirmed no listener on either port. Closed task browser sessions brief07, brief07-exits, brief07-overlays and anima-town. The renderer removes temporary frame sequences after successful encoding; any surviving encoded sequences were removed only when both MP4 and JSON existed. Source, masks, proof clips/frames, cache inputs and verification records are retained. `verification-07/proof-manifest.json` records hashes and sizes of local visual evidence; videos remain local rather than inflating the source commit.

Preserved unrelated pre-existing old anchor PNG modifications, shared call-ledger changes and the untracked AgentDebug test. This brief's eight call records are separately committed. No push, merge, deployment, GitHub settings change, dotenv file or secret export.
