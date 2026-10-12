# Brief 16 — stop-animation generation failed within budget

**Not accepted. No stop animations installed; F20 remains open.** Generated five Kling clips and one re-roll per heading, then rejected all ten. They eventually reach resting poses, but continue walking before settling and lift/move the intended support boot. Locking a tracked point on an airborne boot would not make this a physically planted-foot stop. The ten-video budget is exhausted.

The engine and shipped artwork remain at brief 15. A provisional motor edit was discarded after the art gate failed. Existing brief-15 poses and older keyframes are retained. This is a failed generation report, not a claim that the requested 16 stops / eight starts or `docs/FOOTFALL-GOAL.md` are complete.

## Sources and generation

Used the exact brief-15 exit frames at **612 × 1059**: side 29, away 11, away-right 8, toward 13, toward-right 8. [Source metadata](../verification-16/sources.json) records their existing contacts. Source PNGs were extracted directly from the walk sheets and alpha-composited onto RGB 128 grey; no character edits were made.

Model: `fal-ai/kling-video/v3/turbo/standard/image-to-video`, duration **3 seconds**, the shortest supported single-shot duration in the [current fal schema](https://fal.ai/models/fal-ai/kling-video/v3/turbo/standard/image-to-video/api). Each first take used the brief's requested stop prompt plus immediate-settle/hold instructions. Re-rolls explicitly prohibited an additional stride and instructed the support boot to remain fixed. Exact inputs, queue IDs, results, and downloaded video hashes are retained in [verification-16](../verification-16/) and [videos.json](../verification-16/videos.json). Each video was extracted at 24 fps and resized to the walk canvas for inspection.

**Budget: 10 Kling videos, 0 BRIA calls, 0 image edits.** All requests completed. [Call ledger](../calls.md). No further generation was attempted.

## Visual rejection evidence

Frame numbers below are zero-based at 24 fps. Each heading has two reviewed takes. Linked full-sequence sheets include every decoded frame; the feet sheets are **2× walk-canvas pixels**, not game-screen captures.

| Heading | First take | Re-roll | Failure visible before rest |
|---|---|---|---|
| side | [all frames](../verification-16/side/all-frames.png), [feet 2×](../verification-16/side/feet-rejection-2x.png) | [all frames](../verification-16/side-reroll/all-frames.png), [feet 2×](../verification-16/side-reroll/feet-rejection-2x.png) | Frames 3–24 continue alternating strides; the re-roll adds another step around 33–42. Support boot lifts instead of remaining planted. |
| away | [all frames](../verification-16/away/all-frames.png), [feet 2×](../verification-16/away/feet-rejection-2x.png) | [all frames](../verification-16/away-reroll/all-frames.png), [feet 2×](../verification-16/away-reroll/feet-rejection-2x.png) | Frames 9–24 transfer support and show raised soles; re-roll continues stepping through roughly frame 33. |
| away-right | [all frames](../verification-16/away-right/all-frames.png), [feet 2×](../verification-16/away-right/feet-rejection-2x.png) | [all frames](../verification-16/away-right-reroll/all-frames.png), [feet 2×](../verification-16/away-right-reroll/feet-rejection-2x.png) | Frames 12–24 clearly lift the original planted boot after advancing the other foot; re-roll keeps it airborne into frame 30. |
| toward | [all frames](../verification-16/toward/all-frames.png), [feet 2×](../verification-16/toward/feet-rejection-2x.png) | [all frames](../verification-16/toward-reroll/all-frames.png), [feet 2×](../verification-16/toward-reroll/feet-rejection-2x.png) | Frames 3–18 advance one boot then the original support; the re-roll also advances/lowers the support before spreading both feet. |
| toward-right | [all frames](../verification-16/toward-right/all-frames.png), [feet 2×](../verification-16/toward-right/feet-rejection-2x.png) | [all frames](../verification-16/toward-right-reroll/all-frames.png), [feet 2×](../verification-16/toward-right-reroll/feet-rejection-2x.png) | First take strides through frames 3–21; re-roll takes another stride through 15–27. |

The ending silhouettes are substantially more relaxed than the source poses. The failure is the motion leading to them. Truncating before the support lift leaves a walking pose; starting after the extra strides drops the requested source-image seam. Translation registration cannot remove a support-foot lift or a change in leg pose. Reversing these rejected takes would include backward walking, not the requested short start. No reverse sequence is claimed as validated.

Background removal, registered stop sheets, contact annotation, and runtime integration were not pursued after this rejection. BRIA cannot correct the motion, so its budget was not spent. No 16-stop/8-start game proof was rendered from rejected assets. Seam displacement, stop-animation lockcheck, floor/object contacts, alpha, and half-stride arrival acceptance are **not verified for brief 16**.

## Baseline verification and cleanup

These checks apply to the unchanged brief-15 game, not to new stop animations:

- [Tests](../verification-16/tests.log): **421 passed, 44 files**.
- [Typecheck](../verification-16/typecheck.log) and [lint](../verification-16/lint.log): **pass**.
- [Art verification, including generated scenes](../verification-16/art.log): **one existing scene fails** (`place-96acfd3d8faaf8f903fe`, Hermes actual 794 px at y=918, expected 1107 px). Outside passes; inside has its existing vending-machine warning. No runtime or art modifications were present for this check. This mismatch was not investigated as part of the stop-animation generation failure.
- [Credential-disabled town replay 79](../verification-16/town79.json): **pass**, 25 records, 33 cached calls, **0 uncached**. [Log](../verification-16/town79.log), [actual API process credential flags](../verification-16/provider-credentials-disabled.json).
- [Reviewer-tool hashes](../verification-16/reviewer-tools-unchanged.json): all unchanged relative to the start, including the already-dirty `walkstats.py`.

An initial `verify:art` invocation ran before the QA server was started and attempted its default URL without `?mute=1`; connection was refused, so no page loaded. The actual art check and town replay both used `?mute=1`. Only API 4317 and game 8080 were started. Task servers/browser sessions were stopped afterward; owner ports 4410/8090 were untouched. No keys or dotenv files were written. No push, merge, deploy, or GitHub settings changes.

Pre-existing edits to `calls.md`, `walkstats.py`, and untracked `AgentDebug.test.ts` were preserved. Generation inputs, outputs, scripts and visual rejection evidence are retained for review. Continuing generation requires a revised video budget or suitable supplied clips; another paid attempt is outside this brief's authorization.
