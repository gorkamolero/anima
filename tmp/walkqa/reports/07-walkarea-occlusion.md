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

## Mask and capture corrections

Seven SAM2 calls reserved under CALL 07 (hard 60-call scope): right net pile, missing left net pile, exterior bench, pergola, interior bench, corrected stepped-street lamp, and interior bus. Boxes were checked against the current source artwork; old anchor labels had coordinates from different artwork. No source image/video generation. Alpha construction now retains all segmented components instead of silently retaining only the largest. Independent PNG comparison (`tools/maskcoverage07.py`, `verification-07/mask-coverage.json`) reports zero missing reference pixels for each checked anchor occluder. Segmentation coverage is not a semantic guarantee; visual inspection remains required.

A complete-stance timing allocator caps each source frame at 1/24 s and redistributes remaining cycle time across longer supports. Production cycle cadence stays 1.6–2.2; partial entries retain their full support timing. Thirteen timing/motor tests pass. First road captures: zero off-floor/footprint contacts; measured cadence 1.60–1.95. The first independently checked road clip has zero frozen walking frames and zero lock excursion. Toward speed still exceeds side; final per-depth audit remains outstanding.

The scene loader previously swallowed geometry failures, letting proofs capture an unfiltered initial area. Geometry failures now stop walking, clear navigability, and make render-walk refuse the proof. Raising the object-list capacity to 32 permits the newly identified second net pile without dropping existing objects.

Town run 17 stopped at the cached painted-depot variant (no variant floor cache). Added unchanged-pixel floor reuse: difference against the segmented anchor removes every changed floor cell. This never adds new floor and requires no segmentation call. Final town rerun pending.

The old exterior disjoint authored ranges prevented any route through the centre even after safe object subtraction; the interior line also acted as a shallow maximum floor boundary. Anchor bands now use explicit floor extents through the image bottom (caption clipping still happens after erosion). Perspective calibration lines remain unchanged. Segmentation and physical supports provide the actual exclusions. Final overlays and walks must be recaptured for these expanded bands; earlier narrow-band proofs are diagnostic only.
