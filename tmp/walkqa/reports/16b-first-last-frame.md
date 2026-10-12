# Brief 16b — first/last frames improve the endpoint, but the stop set fails

**Not accepted. F20 remains open.** Twelve first/last-frame videos completed. One away take passes the initial visual motion gate; the other four headings still lift the original support boot before settling, including the final toward reroll. No new stop artwork or playback behavior is installed. The requested 16 stops / 8 starts are not claimed as rendered or passed.

The pier derivation and scale-clamp bugs are fixed in code, and **all 16 scenes now pass `verify:art`** using the corrected local pier reference. However, that reference was localized by the assistant after three vision providers failed. This is a disclosed manual calibration, **not satisfaction of Footfall's no-human-calibration goal**. Unattended reference localization remains a named limitation.

## Generation and budget

**12/12 first/last videos, 0/5 BRIA removals, 0/2 image edits.** Also three F21 vision calls, all logged in [calls.md](../calls.md). No further video submission is authorized by this brief. Local compositing, translation registration, keying and diagnostic renders are not provider image edits.

[Model research](../verification-16b/models.md) records current fal schemas, minimum durations and advertised prices. Started with Wan 3 at 2 seconds / 480p ($0.10), then tested Wan 2.1 ($0.20), Kling 2.5 Turbo Pro ($0.35), Veo 3.1 Fast ($0.40) and Veo 3.1 ($0.80) on away. Kling 2.1 Pro is deprecated. The cheaper model passed the pilot only after a small endpoint-boot registration correction; the other four headings were then generated with it. Advertised video total approximately **$2.80**, not an invoice; the three vision calls are separate.

The exact requested prompt was used throughout:

> Static camera. The character stops walking and settles into a relaxed stand: the planted foot stays exactly where it is, the other foot comes down beside it, arms relax to his sides. No turning, no camera motion, flat grey background.

Inputs are the brief-15 exit frames: side 29, away 11, away-right 8, toward 13, toward-right 8, at **612 × 1059**. Last frames use the five requested rest assets. [Sources](../verification-16b/sources.json) record the assets, contacts and initial translations. Inputs are flat RGB 128 grey. Each request directory retains the exact first and last PNG, input parameters, request ID, result and downloaded raw video; [manifest and hashes](../verification-16b/videos.json).

The away rest boot needed an additional translation (+2, −1 source px) after metadata alignment; toward needed (−1, 0). See [away registration](../verification-16b/rest-boot-registration.json) and [other headings](../verification-16b/other-rest-registration.json). Side uses the physically matching idle boot rather than assuming that foot labels from separate assets coincide. Its substantially different drawing, and away-right's, did not yield reliable boot-template correlations; those residual alignment uncertainties remain disclosed. No warping or pose editing was applied.

## Every take reviewed

Frames are zero-based, decoded at 24 fps and normalized to the walk canvas. **All-frame links include every decoded frame**; feet links are full-width lower-leg crops at **2× source pixels**. These are raw-generation review sheets, not in-game stop proofs.

| # | Take | Judgment | Evidence |
|---|---|---|---|
| 1 | away, Wan 3 | Support drifts about 4.5 source px; endpoint arms differ. Reject. | [all](../verification-16b/away-wan3/all-frames.png), [feet 2×](../verification-16b/away-wan3/feet-full-2x.png) |
| 2 | away, Wan 2.1 | About 3.2 px support drift; free boot smears around frames 12–23. Reject. | [all](../verification-16b/away-wan21/all-frames.png), [feet 2×](../verification-16b/away-wan21/feet-full-2x.png) |
| 3 | away, Kling 2.5 | About 3 px support drift; prolonged arm adjustment after feet settle. Reject. | [all](../verification-16b/away-kling25/all-frames.png), [feet 2×](../verification-16b/away-kling25/feet-full-2x.png) |
| 4 | away, Veo Fast | Extra walking; original support lifts around frames 15–30. Reject. | [all](../verification-16b/away-veofast/all-frames.png), [feet 2×](../verification-16b/away-veofast/feet-full-2x.png) |
| 5 | away, Veo | Extra walking and original support lift around frames 15–30. Reject. | [all](../verification-16b/away-veo/all-frames.png), [feet 2×](../verification-16b/away-veo/feet-full-2x.png) |
| 6 | away, Kling, aligned tail | Extra step, support lift around frames 18–30, head turns. Reject. | [all](../verification-16b/away-kling25-aligned/all-frames.png), [feet 2×](../verification-16b/away-kling25-aligned/feet-full-2x.png) |
| 7 | away, Wan 3, aligned tail | **Promising pilot**: free foot comes down, original support stays flat, character remains on-model and centered. Raw boot-template shift ≤1 source px. Not yet runtime accepted. | [all](../verification-16b/away-wan3-aligned/all-frames.png), [feet 2×](../verification-16b/away-wan3-aligned/feet-full-2x.png), [tracking](../verification-16b/away-wan3-aligned/support-tracking.json) |
| 8 | side, Wan 3 | Forward step frames 3–9, original support lifts around 12–18. Reject. | [all](../verification-16b/side-wan3/all-frames.png), [feet 2×](../verification-16b/side-wan3/feet-full-2x.png) |
| 9 | away-right, Wan 3 | Advances other boot, then lifts original support around 6–15. Reject. | [all](../verification-16b/away-right-wan3/all-frames.png), [feet 2×](../verification-16b/away-right-wan3/feet-full-2x.png) |
| 10 | toward, Wan 3 | Extra step; viewer-right original support lifts around 12–18. Reject. | [all](../verification-16b/toward-wan3/all-frames.png), [feet 2×](../verification-16b/toward-wan3/feet-full-2x.png) |
| 11 | toward-right, Wan 3 | Extra step; original support lifts around 12–18; ending stance spreads. Reject. | [all](../verification-16b/toward-right-wan3/all-frames.png), [feet 2×](../verification-16b/toward-right-wan3/feet-full-2x.png) |
| 12 | toward, Wan 3 reroll | Repeats the extra step and original support lift around 12–18. Reject. | [all](../verification-16b/toward-wan3-reroll/all-frames.png), [feet 2×](../verification-16b/toward-wan3-reroll/feet-full-2x.png) |

First/last conditioning successfully reaches the supplied rest drawing more reliably, but does not constrain the intervening motion enough. Translation registration cannot turn an airborne boot into a physically planted one. Truncating the failed clips before the lift leaves a mid-gait pose; starting after it loses the source seam.

For the away candidate, local grey keying was performed and the [endpoint comparison](../verification-16b/away-wan3-aligned/endpoints-compare.png) retains source, generated first, frame 33, generated last and supplied rest. [Forward preview](../verification-16b/away-wan3-aligned/candidate-stop.mp4) uses frames 0–33; [reverse preview](../verification-16b/away-wan3-aligned/candidate-start.mp4) reverses them. **Reverse has an awkward arm beat:** the right arm first drops away from the torso (reverse of forward frames 30→24), then returns as the foot lifts. That is not signed off as a natural start. The rejected headings would reverse an added stride, so they are not acceptable starts either.

A generic forward/reverse playback prototype passed 23 motor tests, but was removed from the working source after the artwork gate failed. Its [patch](../verification-16b/playback-prototype.patch) and [test log](../verification-16b/motor-tests.log) are retained as investigation evidence, not shipped functionality. The safety hook blocked deleting its task-created stash, which also remains. Existing brief-15 artwork and older keyframes are preserved.

## F21: what was wrong, and what changed

The original pier reference was an **imagined adult** (45% of image height at normalized foot y=0.62), not a measured object. Generated landmarks echoed that estimate. With horizon 475.2 and slope 0.0047214353, the prediction at y=918 was about 1107 px, while the runtime's 1.5 scale-factor cap produced **794 px**. Thus neither the synthetic landmark nor simply enlarging Hermes to match it was a trustworthy repair.

Three code corrections are committed:

1. `665656b`: an explicit horizon now remains effective even when landmark ground-y samples are less than 100 px apart. Previously, a single visible door near the horizon became a constant-scale model. Regression test included. This changes engine verification logic, not reviewer-owned tools.
2. `0b69cbf`: perception can supply a visible known-height object's tight rectangle; derivation computes adult scale at that object's bottom and emits the actual object as the landmark. The measured branch does not use the legacy 100 px horizon-distance floor. Three calibration tests included. Legacy cached guidance keeps its existing fallback.
3. `89c7deb`: generated scenes honor the derived scale clamp instead of silently replacing it with max 1.5.

For the current pier, three attempted automatic localizations (Gemini 2.5 Flash, Gemini 2.5 Pro, GPT-4.1) returned visibly wrong door/horizon coordinates. All were rejected. The final [reference](../verification-16b/door-reference.json) and [overlay](../verification-16b/door-reference-overlay.png) were localized by the assistant at native 1376×768 resolution: door rectangle (1010,294)–(1079,445), sea horizon y=383; assumed door height 2.03 m. **This is manual calibration and remains outside the no-human-calibration goal.** The new prompt/schema has not proved that an unattended provider can supply correct coordinates.

| Measurement | Before | After |
|---|---:|---:|
| Horizon, game px | 475.2 | 538.59375 |
| Scale slope | 0.0047214353 | 0.0039651654 |
| Prediction at fixed y=918 | ≈1107 px | 796.584 px |
| Live Hermes sample | 794 px at y=918 | 1005.490 px at y=1017.5 |
| `verify:art` | Pier fails; other 15 pass | All 16 pass |

The after live sample has a different spawn depth; it must not be compared directly with the before height as if y were unchanged. The fixed-y after value is a calculation, not a pixel measurement. [Calculation](../verification-16b/pier-calculation.json), [live report](../verification-16b/pier-live.json), [render](../verification-16b/pier-after.png), [before art log](../verification-16b/art-before.log), [after art log](../verification-16b/art-after.log).

The local pier DB record, generated landmark sidecar and six matching perception-cache calibration records were updated; floor masks were preserved. [Migration record](../verification-16b/reference-cache-migration.json), [floor/replay summary](../verification-16b/baseline-summary.json). The hand-localized reference is recorded openly rather than presented as provider output. [Repair script](../verification-16b/repair-pier.mts) can replay the local DB/landmark change from retained evidence with `pnpm exec tsx tmp/walkqa/verification-16b/repair-pier.mts --replay`; [cache migration script](../verification-16b/persist-reference.py) is separate. Database/cache files are local state, not shipped source assets.

## Acceptance and verification

| Gate | Result |
|---|---|
| Five stop clips / every ending at rest | **FAIL**: four headings have no usable motion; away only a candidate |
| 16 stops + 8 starts, full game sequences at 2× | **Not rendered** from rejected art |
| Seams ≤4 screen px | Not verified for new clips |
| Reviewer `lockcheck.py` ≤1 px | Not run on new runtime clips; raw template tracking is not a substitute |
| `walkstats.py`: zero off-floor/object contacts | Not verified for new clips |
| Registered contacts, alpha check, half-stride arrival | Not completed for a new installed set |
| `verify:art`, anchors + generated | **PASS**, 2 anchors + 14 generated; existing inside vending-machine warning remains |
| Tests | **425 pass, 45 files** ([log](../verification-16b/tests-final.log)) |
| Typecheck / lint | **PASS** ([typecheck](../verification-16b/typecheck-final.log), [lint](../verification-16b/lint-final.log)) |
| Credential-disabled town replay | **PASS**, run 80, 25 records, 23 cached calls, **0 uncached** ([JSON](../verification-16b/town80.json), [log](../verification-16b/town80.log), [process credential flags](../verification-16b/provider-credentials-disabled.json)) |
| Reviewer scripts | Unchanged from entry, including pre-existing dirty `walkstats.py` ([hash comparison](../verification-16b/reviewer-tools-unchanged.json)) |

Tests and town replay cover the retained game plus calibration fixes, not new stop playback. No acceptance claim is made for brief 16b or the overall Footfall goal. Continuing the stop work requires suitable supplied clips or a revised generation budget; further paid video calls are outside the current authorization. Automatic visible-reference localization is also unresolved.

Only task API 4317 and game 8080 were used, browser URLs included `?mute=1`, and task servers/browser sessions were stopped. Owner ports 4410/8090 were untouched. No keys or dotenv files were written; no push, merge, deploy or GitHub settings changes. Pre-existing edits to `calls.md`, `walkstats.py`, and untracked `AgentDebug.test.ts` were preserved. Commits are separated by source/evidence path and carry the requested co-author trailer.
