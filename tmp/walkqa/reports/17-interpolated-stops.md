# Brief 17 — interpolation and rigid trials fail; pier calibration is unattended

**Not accepted. F20 remains open.** Local RIFE produced all five nine-frame candidates (seven in-betweens). Side and away-right smear/double limbs; away dissolves the visible sole into the heel. The rigid-piece fallback was built and inspected, but does not reach the supplied rest drawings cleanly. A second interpolation model, FILM, also fails the side pilot. **No new stop art or runtime playback was installed. The requested 16 game stops / eight starts remain unrendered.**

**F21 is fixed for the existing pier:** its door rectangle and sea horizon now come from the pipeline's semantic masks, without hand-placed points or boxes. The local DB, landmark sidecar and six perception caches use those detections. All 16 scenes pass art verification. This is not a claim that the whole Footfall goal is complete, or that every possible background now calibrates successfully.

## Models, endpoints and budget

[Model manifest](../verification-17/model-manifest.json). RIFE 4.25 ran locally through [rife-mlx](https://github.com/xocialize/rife-mlx), revision `764b89be56497fb26243d1de75f2957f3889e5d3`, in `tmp/interpolation-17/venv`; weights/cache are under `tmp/interpolation-17/hf`. No dependencies or weights were added to the repo packages. The builder is `packages/sprite-tools/scripts/interpolated-stops.py`.

The five sources are brief-15 exits side 29, away 11, away-right 8, toward 13, toward-right 8. The supplied rest assets are exactly brief 16b's table. The script starts with its retained endpoint PNGs, uses translation only and RGB 128 grey, interpolates t=1/8 through 7/8, then removes connected grey locally. Body interiors (alpha >127 eroded by three pixels) are set to 255; edge antialiasing remains. This also corrects near-opaque alpha inherited from the previously registered rest PNGs. [Pixel audit](../verification-17/pixel-audit.json): all 45 final RIFE candidate frames have **zero nonopaque body-interior pixels**. This is an asset audit, not a rendered game alpha check.

Registration is **not a solved gate**. The original and rest boots have different outlines, so translation cannot make their drawings pixel-identical. The side template fit reaches the search boundary and the head is clipped at the top after translation; it is not certified registration. For away-right, template matching initially selected the other boot. That was corrected by inspecting physical leg ownership: the viewer-left rest sole (222,1006) was translated to source (285,1024), a (+63,+18) correction relative to brief 16b's retained endpoint. The corrected pair is the final retained candidate. Its planted shape still changes. Matching a template on the wrong foot would have given a misleading ~1 px result; it was rejected, not treated as lock proof.

**Paid budget used: 1/10 fal interpolation calls, 2/10 segmentation calls, 0 generative videos, 0 image-edit calls.** The [FILM endpoint](https://fal.ai/models/fal-ai/film/api) was tried only after local RIFE failed visually; it returned seven in-betweens plus endpoints as PNGs. [Exact FILM input](../verification-17/side/film/input.json), [request](../verification-17/side/film/request.json), [result](../verification-17/side/film/result.json). Segmentation inputs and IDs are retained under [door](../verification-17/f21/door/input.json) and [sea](../verification-17/f21/sea/input.json). Attempts were appended to `tmp/walkqa/calls.md` before submission. Local reruns use no provider calls.

## Every interpolation frame inspected

Each candidate directory contains `candidate-sheet.png`, all `frame-00.png` through `frame-08.png`, individual full-body `review-NN-2x.png`, and upper/limb panels covering frames 0–2, 3–5 and 6–8 at **2× source pixels**. All in-betweens were inspected across these panels, including the corrected away-right run. These are candidate-image reviews, **not 24 in-game sequences**.

| Heading/model | Visual result | Full sequence | Representative 2× evidence |
|---|---|---|---|
| side / RIFE | Reject. Frames 2–5 ghost the free hand; middle leg contours soften/double. Support shape moves; final head is clipped. | [overview](../verification-17/side/overview.png) | [upper 3–5](../verification-17/side/upper-3-5-2x.png), [legs 3–5](../verification-17/side/limbs-3-5-2x.png) |
| away / RIFE | Reject under the no-smear bar. Frames 3–5 dissolve black sole/cuff into the grounded heel rather than showing one coherent rotating boot. | [overview](../verification-17/away/overview.png) | [legs 3–5](../verification-17/away/limbs-3-5-2x.png) |
| away-right / RIFE | Reject after physical-foot registration correction. Frames 2–5 show doubled/smeared knee, cuff, boot and hand. | [overview](../verification-17/away-right/overview.png) | [legs 3–5](../verification-17/away-right/limbs-3-5-2x.png), [upper 3–5](../verification-17/away-right/upper-3-5-2x.png) |
| toward / RIFE | Most promising. Both limb silhouettes remain coherent; boot laces/creases dissolve slightly. Not runtime-certified and not installed as a partial set. | [overview](../verification-17/toward/overview.png) | [legs 3–5](../verification-17/toward/limbs-3-5-2x.png) |
| toward-right / RIFE | Little movement; coherent silhouettes, fading knee crease. Ends in the requested brief-15 pose, retaining its bent/crossed-leg appearance. Not runtime-certified. | [overview](../verification-17/toward-right/overview.png) | [legs 3–5](../verification-17/toward-right/limbs-3-5-2x.png) |
| side / FILM | Reject. Frames 2–6 smear the hand, bag/coat boundary and knee, despite reaching the requested endpoint. | [overview](../verification-17/side/film/overview.png) | [upper 3–5](../verification-17/side/film/upper-3-5-2x.png), [legs 3–5](../verification-17/side/film/limbs-3-5-2x.png) |

Raw template tracking found maximum shifts of **8.54 source px side, 9.43 away-right, 0 away/toward/toward-right**. These are appearance-dependent diagnostics, not anatomical lock measurements and not `lockcheck.py`. A zero template shift does not validate a sole that dissolves or changes shape. The candidate JSON contacts repeat the intended source anchor solely as a draft; they are explicitly labelled unvalidated. They must not be installed or used to manufacture a passing lock score.

## Rigid compositing fallback

`packages/sprite-tools/scripts/rigid-stop-fallback.py` segments the visible swing leg below the hips, intersects that polygon with the source alpha, excludes those pixels from the planted piece, and fits rotation plus translation to the target leg mask. It keeps the source planted pixels unchanged throughout. Upper-body RGB blends only on pixels opaque in both drawings when regional silhouette IoU is at least 0.97; otherwise the upper body cuts at frame 4. It never crossfades two limb silhouettes. The leg remains one rigid source piece throughout, including the endpoint: no hidden final snap to the target drawing.

[Fit records](../verification-17/rigid-summary.json), [midpoint displacement diagnostics](../verification-17/rigid-midpoint-jumps.json).

| Heading | Upper IoU / handling | Best attempted rigid leg endpoint IoU | Result |
|---|---|---:|---|
| side | 0.603 / midpoint cut | 0.549 | Bent leg remains bent; upper cut jumps head/torso about 18.8/18.6 screen px at scale 0.42. [Sequence](../verification-17/side/rigid/overview.png) |
| away-right | 0.813 / midpoint cut | 0.586 | Moving the crossing leg exposes missing planted-leg pixels and a gap at the hip; torso cut jumps 8.84 screen px at scale 0.42. [Sequence](../verification-17/away-right/rigid/overview.png) |
| away | 0.983 / common opaque interior blend | 0.877 | Mask overlap hides the real failure: rotating a 2D piece cannot turn its visible black sole into the back of a planted boot. It ends with the sole still raised. [Sequence](../verification-17/away/rigid/overview.png) |
| toward | 0.979 / common opaque interior blend | 0.930 | Small changes only; no full runtime acceptance. [Sequence](../verification-17/toward/rigid/overview.png) |
| toward-right | 0.981 / common opaque interior blend | 0.955 | Essentially the original bent pose; no full runtime acceptance. [Sequence](../verification-17/toward-right/rigid/overview.png) |

The numeric fits depend on the hand-reviewed segmentation and are not a proof that every possible composite is impossible. These actual trials fail by eye. Their concrete limitations are **different source/rest anatomy, out-of-plane boot rotation, and occluded source pixels**. A single rigid leg cannot straighten a bent knee or supply the unseen calf. Painting/reconstructing those pixels or articulating thigh, shin and boot separately would change the requested method. No such unapproved rescue was applied.

Reverse playback of rejected candidates would reverse the same ghosting, missing pixels and abrupt cuts. No acceptable reverse start is claimed. Runtime integration and the 16-stop/eight-start game proof were not pursued with rejected art; brief-15 playback remains installed, with its known F20 defect.

## F21: detected references, not assistant coordinates

Added `api/src/services/semantic-scale.ts` and connected it to both cached and fresh coastal ground derivation in `ground-perception.ts`. For pier/dock/harbour/sea descriptions it calls SAM3 with **text only** (`door`, `sea`), caches raw results and masks by image hash, and derives:

- A tight pixel bounding rectangle from a confident door mask. Confidence, aspect ratio and filled-area checks reject weak or building-shaped detections.
- A sea horizon from the most-supported near-horizontal upper boundary across mask columns. Independent sea masks must agree within 1% image height; the door bottom must be sufficiently below the horizon.
- Adult scale from a declared **2.03 m standard-door assumption**, using the existing calibration math. No imagined adult, scene-specific coordinates or runtime clamp fit.

For scenes without a confident door/sea boundary, this coastal path raises an explicit `Unattended scale limitation` error; it does not silently use a hand reference. Other scene types retain their existing derivation. This approach is not a universal known-height detector, and a painted nonstandard door can still make the standard-height assumption wrong.

The two actual calls returned door confidence **0.95379**, door pixel bounds **(1011,296)–(1079,442)**, and two sea masks agreeing on horizon **y=381** at native **1376×768**. [Detection overlay](../verification-17/f21/detected-overlay.png), [measurement and provenance](../verification-17/f21/measurement.json), [raw masks/results](../verification-17/f21/), [replayable application script](../verification-17/f21/apply-detection.mts). The script consumes the pipeline detector's result; it contains no reference rectangle or horizon coordinates. The raw provider responses were seeded into the detector's normal cache to avoid duplicate paid calls.

| Pier measurement | Brief 16b manual reference | Brief 17 semantic masks |
|---|---:|---:|
| Native door bounds | (1010,294)–(1079,445) | (1011,296)–(1079,442) |
| Native horizon y | 383 | 381 |
| Game horizon y | 538.59375 | 535.78125 |
| Scale slope | 0.0039651654 | 0.0038967188 |
| Predicted Hermes height at fixed y=918 | 796.584 px | 788.637 px |
| Art verification | Pass with manual localization | Pass with detected localization |

[Migration record](../verification-17/f21/migration.json): six floor caches updated, existing masks retained. Local DB and generated landmark sidecar now use `semantic-door-opening` and detection provenance. No hand-placed references were added to shipped data or code. Existing authored anchor scenes remain authored; this work resolves the pier follow-up, not their history.

## Acceptance and cleanup

| Gate | Result |
|---|---|
| Five accepted stop sheets / every ending at rest | **FAIL**: RIFE, rigid fallback and FILM pilot do not provide an accepted complete set |
| 16 in-game stops + 8 starts at 2× | **Not rendered**; no rejected assets installed |
| Seams ≤4 screen px | **Not verified in game**; rigid side/away-right midpoint diagnostics exceed 4 px |
| Reviewer lockcheck ≤1 px through stop sheets | **Not run**; draft contacts are not proof |
| Reviewer walkstats zero off-floor/object contacts | **Not run on new stop clips** |
| Body alpha 1 | Asset interiors pass all 45 RIFE frames; game alpha acceptance not run |
| Arrival within half a stride | Not reverified for new stops; playback unchanged |
| `verify:art` | **PASS all 16 scenes**, including pier using detections; existing inside vending-machine warning remains. [Log](../verification-17/art.log) |
| Tests | **428 pass, 46 files**, including three new semantic-scale tests. [Log](../verification-17/tests.log) |
| Typecheck / lint | **PASS**. [Typecheck](../verification-17/typecheck.log), [lint](../verification-17/lint.log) |
| Credential-disabled town replay | **PASS**, run 81: 25 records, 17 cached calls, **0 uncached**. [JSON](../verification-17/town81.json), [log](../verification-17/town81.log), [actual API process credential flags](../verification-17/provider-credentials-disabled.json) |
| Reviewer tools | All unchanged relative to task entry, including already-dirty `walkstats.py`. [Hashes](../verification-17/reviewer-tools-unchanged.json) |

The first art run failed because Vite's default API URL was port 3001. No owner port was used. Restarted our game server with `VITE_API_BASE_URL=http://localhost:4317/api`, then the art check and town replay passed. Every browser navigation used `?mute=1`. API 4317/game 8080 and task browser sessions were stopped; owner ports 4410/8090 were untouched. [Cleanup](../verification-17/cleanup.json).

Pre-existing ledger edits, `walkstats.py` edits and untracked `AgentDebug.test.ts` were preserved. No keys or dotenv files written, no generative video, no push/merge/deploy/settings changes. Small path-scoped commits carry the requested co-author trailer. Models and venv are untracked under ignored `tmp/`; all source images, model outputs and verification evidence are retained locally.
