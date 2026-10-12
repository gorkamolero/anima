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
