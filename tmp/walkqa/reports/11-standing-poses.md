# Brief 11 — directional standing poses

Status: implemented and verified on `open-world-mvp`. All 16 final stops were inspected. The four-frame transition is an anchored dissolve; see the visual limitation below.

## Assets

`9160076` adds four locally keyed, RGBA single-frame sheets and a reproducible local script, `packages/sprite-tools/scripts/standing-sprites.py`. No paid calls, generated video, or AI image edits were used. The original keyframes are unchanged.

All sheets use the walk canvas (612×1059), bottom-centre origin, and both sole contacts. The side walk's alpha>127 median visible height is **1030.5 px**. A single binary-alpha bounding box has integer height: the new stills use its nearest integer, **1030 px** (0.049% quantization), with the lowest sole pixel on row1058. Measurements: `../verification-11/normalization.json`. Full 3× magenta views and inspected edge crops: `../verification-11/hermes-stand-*-magenta-3x.png`, `edges-3x.png`. The grey gap between the rear diagonal's legs was removed as well as the outer background.

## Motion

The motor retains its actual support foot through stop and restart. Standing artwork's default `planted` field cannot replace that live support. The standing pose is solved about the same world anchor as the walk pose, including mirroring and perspective. A four-frame source/standing opacity transition is used at 24fps (166.7ms). This is a short dissolve, not newly generated in-between artwork; the individual blend frames visibly contain both drawings. The final pose is fully opaque and contains no held stride or lifted heel.

The cycle can finish the current safe support near a visually marked passing frame before the four-frame settle. Both endpoints stay on the same anchor. Starting prefers a passing pose with enough remaining support. Free-foot keypoint distances proved unreliable at overlaps, so the five walk sheets now carry visually inspected `passingFrames` metadata. Feet montages documenting those selections are in `../verification-11/*-feet-all.png`.

Initial scene placement faces away into the scene. Travel entries select their inward heading. Object interactions face the object's floor position; narrator openings use the motor's standing transition. The game no longer overwrites the motor with an unrelated side idle/talk pose.

## Verification method

`lockcheck.py` follows the motor's support foot and anchor across texture changes and includes visible settled frames. The old texture-based grouping silently excluded the walk-to-idle seam. `review-stops.py` additionally projects both the outgoing sprite and the incoming blend sprite against the anchor; errors are around 1e-13px.

`walkstats.py` checks physical floor/object contact for every visible sample, including starts, settles, and idle tails. Cadence and speed use locomotion samples, excluding the explicitly tagged settle intervals. The owner's pre-existing >=3-switch cadence rule is preserved.

The town replay's old "hold a switch frame" assertion contradicted this brief. It now asserts the heading-specific standing texture and mirror, frame0, completed settlement, unchanged arrival anchor, the original half-stride arrival decision, and both standing soles on the physical floor. It retains hotspot, scale, Kat, art, travel, and zero-uncached-call checks. An unrelated existing TypeScript error in the anchor-less occluder branch was fixed by removing the unreachable `anchorGround?.horizonY` access.

## Evidence and intermediate failures

- `../diagnostic-11-wide-stance/`: initial wide-stride blend, rejected during visual review.
- `../diagnostic-11-contact-passing/`: contact-distance-only passing selection, rejected; overlapping free-foot trackers selected visually wrong frames.
- `../proof-11/{road,depot}/`: 24fps frame-perfect PNG-derived clips, per-frame JSON, and `*-last6-2x.png` contact sheets. Final six frames end at the first fully standing frame, not six repeated idle tail frames.
- Town45: simultaneous QA writes caused SQLite busy. Later runs are serial.
- Town46: obsolete held-walk-frame assertion.
- Town47: routing-mask/origin assertion incorrectly treated the new standing origin as the sole; both actual boots were on physical floor.
- Town48: restart incorrectly changed an actual right support to the standing metadata's left default; corrected with regression coverage.
- Town49/50: boundary cases exposed an unsafe free standing sole after a valid walking landing/turn. Corrected with final-approach standing-footprint checks, support-preserving startup, and bounded alternate-support recovery. Broad checks on every intermediate stance were rejected because they blocked otherwise valid routes.

## Final results

| Check | Final result |
|---|---|
| Tests | 410 tests, 43 files passed; heading/mirror selection and stop/restart support regressions included |
| Typecheck / lint / verify:art | Passed; art retains existing vending-machine size warning |
| Town replay 57 | Passed full town route, 17 cached calls, **0 uncached calls** |
| lockcheck, including settling | **0.00 px** maximum excursion across all 16 clips |
| Incoming and outgoing contact projection | Maximum error < 0.000000001 px |
| walkstats | **0 off-floor, 0 object contacts**, including settle/idle samples |
| Duplicate walking frames | 0 across all 16 final clips |
| Final poses | Eight correct headings in each room; all settle intervals are four frames |
| Narrator opening | Actual opening method faces the left-house object and finishes standing; options response stubbed in memory, no network call |

Logs are in `../verification-11/`: `tests-final.log`, `typecheck-final.log`, `lint-final.log`, `art.log`, `town57.log`, `lockcheck.txt`, `walkstats.txt`, `freeze.txt`, `narrator-smoke.json`. Per-stop measurements: [results.json](../proof-11/results.json). This is Brief 11 proof, not a claim that every wider FOOTFALL goal has passed.

Town55/56 exposed a test that inferred scale direction from labels even when exit avoidance moved the actual near endpoint behind the far endpoint. The assertion now sorts the actual rendered depths and checks growth there. The other scale/art checks remain. One road diagonal proof was obscured by a tree and was replaced with a visible toward-right stop before final review.

### Reviewer index

| Heading | Road | Depot |
|---|---|---|
| left | [clip](../proof-11/road/left.mp4) · [last six at 2×](../proof-11/road/left-last6-2x.png) | [clip](../proof-11/depot/left.mp4) · [last six at 2×](../proof-11/depot/left-last6-2x.png) |
| right | [clip](../proof-11/road/right.mp4) · [last six at 2×](../proof-11/road/right-last6-2x.png) | [clip](../proof-11/depot/right.mp4) · [last six at 2×](../proof-11/depot/right-last6-2x.png) |
| away | [clip](../proof-11/road/away.mp4) · [last six at 2×](../proof-11/road/away-last6-2x.png) | [clip](../proof-11/depot/away.mp4) · [last six at 2×](../proof-11/depot/away-last6-2x.png) |
| away-left | [clip](../proof-11/road/away-left.mp4) · [last six at 2×](../proof-11/road/away-left-last6-2x.png) | [clip](../proof-11/depot/away-left.mp4) · [last six at 2×](../proof-11/depot/away-left-last6-2x.png) |
| away-right | [clip](../proof-11/road/away-right.mp4) · [last six at 2×](../proof-11/road/away-right-last6-2x.png) | [clip](../proof-11/depot/away-right.mp4) · [last six at 2×](../proof-11/depot/away-right-last6-2x.png) |
| toward | [clip](../proof-11/road/toward.mp4) · [last six at 2×](../proof-11/road/toward-last6-2x.png) | [clip](../proof-11/depot/toward.mp4) · [last six at 2×](../proof-11/depot/toward-last6-2x.png) |
| toward-left | [clip](../proof-11/road/toward-left.mp4) · [last six at 2×](../proof-11/road/toward-left-last6-2x.png) | [clip](../proof-11/depot/toward-left.mp4) · [last six at 2×](../proof-11/depot/toward-left-last6-2x.png) |
| toward-right | [clip](../proof-11/road/toward-right.mp4) · [last six at 2×](../proof-11/road/toward-right-last6-2x.png) | [clip](../proof-11/depot/toward-right.mp4) · [last six at 2×](../proof-11/depot/toward-right-last6-2x.png) |

Clips are exact 24fps game-frame encodes, not generated video. Each contact sheet includes the final walk frames, blend frames, and first solid standing frame. No held mid-stride endpoint remains. Both artwork layers retain the same planted anchor through the blend, but the supplied drawings differ in silhouette; the dissolve visibly ghosts during its intermediate frames. No anatomical in-between art was generated.

Capture plans and `review-stops.py` are retained in `../verification-11/`. Recreate raw frames with `render-walk.mjs --keep-frames` using the final road/depot plans, then run the review script. Task-created raw frame staging directories were removed after retaining the clips, sheets, JSON and check logs.

Implementation commits: `9160076` assets, `cdd09f8` motor, `adf4864` game wiring, `4ab8a73` typecheck repair, `67c10fb` QA. All use the requested co-author trailer. Pre-existing owner changes in `calls.md`, the short-clip cadence rule, and `AgentDebug.test.ts` remain uncommitted.

No push, merge, deploy, settings change, key write, or dotenv edit. Owner ports4410/8090 were not touched. Task servers4317/8080 have been stopped; no listeners remained on those ports.
