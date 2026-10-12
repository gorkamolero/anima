# Brief 07 — walk areas, occlusion and exits

Status: in progress; no visual acceptance claimed.

Read the Footfall goal, complete findings (including F10–F12), Brief 06 and 04a reports, current 04b report, and git log -20. Starting revision: 9f63dc8 on open-world-mvp. Brief 04b has not committed; its dirty API ground/routes, tests, corpus manifest, call ledger and anchor mask images are preserved. No edits to its reserved paths until its commit lands.

## Budget

0/60 segmentation calls; 0 image/video generation. No task-owned servers started yet.

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
