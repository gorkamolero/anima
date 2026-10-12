from pathlib import Path
import json
base=Path('tmp/walkqa');v=base/'verification-13';proof=base/'proof-13'
jumps=json.loads((proof/'jumps.json').read_text());coverage=json.loads((v/'exit-coverage.json').read_text());matches=json.loads((v/'matches/summary.json').read_text())
report='''# Brief 13 — standing edits from walk exits

**Status: implemented, mechanically verified, visual acceptance FAILS; budget FAILS.** Five new standing sprites come from edits of the exact selected walk frames. All 16 stops and eight starts were rendered frame-perfect and all 24 requested 2× sheets were individually inspected. **13/24 cuts meet both ≤4 screen-pixel movement bars; 11 do not.** Worst retained cut: depot toward, head **9.20 px**, torso **4.99 px**. Opaque limb/satchel silhouette pops remain, including on some numerically passing cuts. This is not FOOTFALL sign-off.

**Budget overrun:** ten explicit standing edits (five first attempts plus one retry each) used `fal-ai/nano-banana-2/edit`. I then mistakenly invoked two normal town journeys without `--replay`. They produced **two additional Nano Banana image edits** plus uncached narrator/perception work. Thus **12 image edits total exceeds the cap of 10**. Those mistaken runs also populated the local API scene caches/world records; they are retained rather than attempting unrelated database cleanup. There were no BRIA calls and no generated video. The subsequent saved replay passed with zero uncached calls; that does not erase the earlier overrun. [Call audit](../verification-13/call-audit.json), [run 68](../verification-13/town68.json), [run 69](../verification-13/town69.json).

## Artwork and registration

Inputs were the highest-IoU support exits from brief 12: side **8**, away **2**, away-right **18**, toward **5**, toward-right **19**. Each was extracted without reframing onto the walk's **612×1059** canvas and composited on flat **#828282** grey. One input per edit; old keyframes were visual review references, not extra model inputs. [Input montage](../verification-13/edits/inputs.png), [selection](../verification-13/edits/selection.json).

The first prompt preserves the user's instruction: “Same character, same framing, same camera, same scale and position. He has stopped walking and stands still with both feet flat on the ground, weight even, arms relaxed at his sides. Keep head, torso, satchel, face and clothes identical; change only the legs and feet, and the arms if needed.” It additionally specifies exact upper-body coordinates, unchanged planted shoe, the canvas and flat grey. The retry strengthens the unchanged upper-body/arms/shoe requirements and supplies planted-shoe coordinates. Away retries also specify the lowered free sole's approximate target. Exact prompts, parameters, request IDs and all ten original outputs are retained in [edits](../verification-13/edits/); the `*-N.manifest.json` files are authoritative, including the selected front-diagonal first attempt.

fal returned 784×1360 canvases (front first attempt: 784×1357). `matched-standing.py` keys grey locally using brief 11's connected body, edge alpha estimation and background decontamination, restores the **entire canvas** to 612×1059, then registers premultiplied upper-body pixels by translation only. No cropped-box recentering, per-part warp, upper-body compositing, new drawing or walk-frame edits were applied. Registration estimates rounded to **(0,0)** for every selected edit; the model mostly retained upper-body coordinates after canvas restoration. The ~3 px head/torso goal is not claimed for every sole-aligned cut: preserving the head alone cannot undo a moved shoe.

Selected attempts: side **2**, away **2**, away-right **2**, toward **2**, toward-right **1**. The front-diagonal retry preserved the arm better but placed the free shoe higher and worsened the opposite-support footprint; its rejected output and overlay remain available. Side retry still moved the planted shoe by roughly **58 sprite px** under local boot registration. Translating the entire sprite would move the head by the same amount and would cancel out again when the motor locks the sole. This is an unresolved edit failure, not something corrected by invented keypoints. The final side cut consequently uses frame10 on L / frame24 on R instead of the edit source8.

Face, glasses, hair, satchel side/strap, jacket and palette were checked against the old references in every `*-review.png`. They retain each walk cycle's character drawing; the older front keyframe's facial proportions are different from the walk and were not copied back. The retained toward pose keeps the source's bent arm to preserve its torso; fully relaxed arms and perfect upper-body overlap were not simultaneously achieved. The selected front-diagonal torso-centroid proxy remains 6.30 sprite px from its source before sole alignment (arm change); its head is 0.66 px. The retry was performed as required, but did not satisfy every constraint.

The new files are `hermes-matched-stand-{side,away,away-right,toward,toward-right}.{png,json}`. Old keyframe and standing sprites are preserved. Runtime standing, startup and side idle use the new assets; the legacy side idle is retired from this scene. The talk cycle is unchanged. [Normalization/registration](../verification-13/edits/normalization.json), [magenta/edge review](../verification-13/edges-review.png), and the five `*-contacts-2x.png` sheets show the reviewed shoe landmarks. Some preserve the walk tracker’s within-shoe point rather than replacing it with a sole bounding-box midpoint. Regenerating all five walk contact tracks with `root-motion.py` produced **identical contact coordinates**; its new debug sheets are in [contacts](../verification-13/contacts/).

## Exit selection and remaining half-cycle limitation

`matched-cuts.py` measures every frame on its actual support and ranks exits/entries by the existing score: `100*(1-IoU)+headPx+torsoPx`. The generator chooses the best exit per support and contiguous stance. It no longer inserts a poor frame only to cover a temporal gap. Entry floor/route safety, the runtime half-cycle cap, one opaque sprite and planted-support locking remain unchanged.

**Both supports do not yet match everywhere. Removing forced exits did not prove universal half-cycle coverage.** The static uncovered phases below can still reach the existing explicit `unmatchedCut` fallback. None of the 24 retained proof clips or successful saved town replay used that fallback. This is a named remaining limitation; the cap was not relaxed, and the safety fallback was not renamed as success.

| Cycle | Exits | Half-cycle cap | Maximum wait from any phase | Uncovered source phases |
|---|---|---:|---:|---|
'''
for r in coverage:report+=f"| {r['cycle'].replace('hermes-','')} | {', '.join(map(str,r['exitFrames']))} | {r['halfCycleCap']} | {r['maxWaitFromAnyFrame']} | {', '.join(map(str,r['uncoveredFrames'])) or 'none'} |\n"
report+='''
The maximum wait is the cyclic gap minus one (a request can arrive on the next source frame). Safety geometry may further restrict a candidate. [Coverage audit](../verification-13/exit-coverage.json). All per-support metrics and walk/standing/overlay debug sheets are in [matches](../verification-13/matches/summary.json).

## Actual cut jump table

These are **actual screen transforms**, not just the old sprite-pixel metric multiplied by outgoing scale. The evidence builder projects each pose's alpha-weighted head centroid (top 0–23%) and torso centroid (25–62% of that pose's visible height) through its own position, mirror and scale. Thus it includes perspective-scale changes at a sole-locked cut. These are reproducible region proxies, not anatomical feature trackers. All values below are **screen px**, before the sheets' 2× enlargement. Start measurements use frames0→1, not the later stop in the same clip.

| Scene | Heading | Kind | Walk frame | Head | Torso | ≤4 both | Overlay |
|---|---|---|---:|---:|---:|---|---|
'''
for r in jumps:report+=f"| {r['scene']} | {r['heading']} | {r['kind']} | {r['walkFrame']} | {r['headScreenPx']:.2f} | {r['torsoScreenPx']:.2f} | {'PASS' if r['within4px'] else '**FAIL**'} | [2×](../proof-13/{r['scene']}/{r['heading']}-cut-overlay-2x.png) |\n"
report+='''
[Machine-readable jumps](../proof-13/jumps.json), [cut/support telemetry](../proof-13/results.json).

## Visual review and remaining failures

Every road/depot last-six and every start first-six sheet below was opened and inspected individually. The overlays are diagnostic only; no overlay/blend is used by the game.

- **Side stops (road/depot, both mirrors):** frame24 uses the opposite-support arm swing and a different bag angle from source8. The new stance drops the lifted leg abruptly and changes hand/bag silhouette. Road torso4.80 px; depot head4.61/torso6.58 px. The side edit's shifted shoe also leaves both starts just outside target (4.11/4.03 px). [Depot overlay](../proof-13/depot/left-cut-overlay-2x.png), [start overlay](../proof-13/starts/left-cut-overlay-2x.png).
- **Toward stops:** source5 matches the L-support start well (0.90/1.53 px), but the R-support exit24 differs in lean, arm placement and shoe geometry. The locked placement changes scale from 0.395706 to0.385549 in the depot, amplifying the head displacement to9.20 px. Road is6.54/3.57 px. The overlay shows the head/torso shift and reposed arms directly. [Worst overlay](../proof-13/depot/toward-cut-overlay-2x.png).
- **Front-diagonal opposite support:** R-support exit19 is close (depot toward-right0.10/2.73 px); L-support exit2 changes the bag and arm silhouette. Both starts are5.72/5.15 px, and road toward-right is4.15/3.67 px. [Start overlay](../proof-13/starts/toward-right-cut-overlay-2x.png). The original source7 forced exit is gone, but phases3–6 still lack a good exit within the cap.
- **Rear and rear diagonal:** retained measured cuts meet the head/torso bar, but the free boot still drops between drawings. Passing a centroid threshold does not make the silhouette continuous. The rear-diagonal L stance at another gait phase remains a poor static match even though the retained road frame9 cut is within4 screen px after perspective projection.

The stop plans were regenerated under the new entry/exit policy to cover all final headings. They are **not identical-route A/B captures** of brief12; in particular the final depot toward-right uses a different start/goal and source19. Its small jump is not proof that the old short source7 scenario is fixed. The explicit coverage failure above prevents that claim. All plans and candidate searches are retained.

## Verification

| Check | Result |
|---|---|
| Unchanged reviewer lockcheck | **24 clips, max0.00 px**, including standing seams |
| Unchanged reviewer walkstats | **0 off-floor, 0 object contacts**, all636 visible samples |
| Supplementary projected support | Max4.69e-13 px anchor error |
| Actual renderer alpha audit | **636/636 exact 256-bin histogram matches** to opaque normal-pose controls; alpha1, no blend sprite |
| Selected proof cuts | All matched; no unmatched fallback in retained clips |
| Head/torso ≤4 screen px | **13/24 pass, 11 fail** |
| No silhouette pop | **FAIL** |
| Universal good exit within half cycle | **FAIL**, phases listed above |
| Tests | **412 tests, 43 files passed** |
| Typecheck / lint | Passed |
| verify:art | Passed; existing oversized vending-machine warning |
| Saved town replay71 | Passed, **25 cached calls / 0 uncached** |
| Budget | **FAIL: 12 image edits versus10 allowed**, including mistaken journey calls |

Alpha uses the actual Phaser RenderTexture snapshot method from brief12, independently comparing the rendered sprite with the same source frame/transform at normal alpha. It is not a comparison of two different poses' opaque areas. [Acceptance](../verification-13/acceptance.json), [histograms](../proof-13/alpha-histograms.json), [lockcheck](../verification-13/lockcheck.txt), [walkstats](../verification-13/walkstats.txt), [tests](../verification-13/tests-final.log), [typecheck](../verification-13/typecheck-final.log), [lint](../verification-13/lint-final.log), [art](../verification-13/art.log), [town71](../verification-13/town71.log).

After retiring the legacy side idle from startup as well, the complete saved replay71 passed again. A fresh start capture on the final code is frame-for-frame identical in transform, texture, frame, opacity and renderer alpha histograms to the retained proof ([startup equivalence](../verification-13/startup-equivalence.json)).

Reviewer-owned files under `tmp/walkqa/tools` were not edited; [hash verification](../verification-13/reviewer-tools-unchanged.txt). The town script only updates expected texture names, keeping all arrival, matched-cut, floor and uncached-call assertions. Owner changes in `calls.md`, `walkstats.py`, and `AgentDebug.test.ts` remain untouched and uncommitted.

## Proof index

[Road index](../proof-13/road-review.png) · [Depot index](../proof-13/depot-review.png) · [Starts index](../proof-13/starts-review.png)

| Heading | Road stop | Depot stop | Start |
|---|---|---|---|
'''
for d in ['left','right','away','away-left','away-right','toward','toward-left','toward-right']:
 report+=f'| {d} | [last6 2×](../proof-13/road/{d}-last6-2x.png) · [clip](../proof-13/road/{d}.mp4) | [last6 2×](../proof-13/depot/{d}-last6-2x.png) · [clip](../proof-13/depot/{d}.mp4) | [first6 2×](../proof-13/starts/{d}-first6-2x.png) · [clip](../proof-13/starts/{d}.mp4) |\n'
report+='''
## Reproduction and handoff

Run `tmp/walkqa/tools/venv/bin/python packages/sprite-tools/scripts/matched-standing.py`, then `matched-cuts.py`. Both are local; generation is a separate explicit script in `verification-13/edits/edit.mjs` with attempt manifests preventing accidental reuse. It is **not necessary to regenerate images**.

For captures, start only API4317 (`PORT=4317`) and game8080 (`VITE_API_BASE_URL=http://localhost:4317/api VITE_MUTE=1`). Run `render-walk.mjs --plan=tmp/walkqa/verification-13/<road|depot|starts>-plan.json --out=tmp/walkqa/proof-13/<name> --session=walkqa13 --keep-frames --alpha-audit`. Then run `review-cuts.py`, `measure-jumps.py`, `seam-grids.py`, and the unchanged reviewer tools. Captures are1920×1080, exact24fps, muted; clips are local encodes, not generated video.

**Town verification must include `--replay`:** `node adventures/shadow-over-innsmouth/scripts/playtest-town.mjs 'http://localhost:8080/?mute=1' --run=<unused-number> --replay`. Omitting it invokes narrative/image-generation work, as the retained failed runs demonstrate. Attempt counters in the ledger are reservations, not extra image requests; the two image completions in runs68/69 are additional actual calls.

Task-created raw-frame staging directories are removed after retaining clips, lossless sheets, overlays, histograms and logs. Generated inputs/outputs and manifests are retained as reproducibility evidence. API4317/game8080 are stopped; owner ports4410/8090 were not touched. No push, merge, deploy, GitHub settings change, key write or dotenv write. Task commits carry `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
'''
(base/'reports/13-matched-standing.md').write_text(report)
