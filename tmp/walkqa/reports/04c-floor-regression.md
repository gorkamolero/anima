# Brief 04c — floor regression repair

**Status: PARTIAL; road/alley recovery requires a review decision.** The clipping code and shrink guard are committed. Stepped street and grocery replacements passed the asymmetric judge and are stored. Depot floors are connected and their occluder responses are populated. The complete road/alley recoveries are staged, with passing physical walk diagnostics, but the global obstacle judge rejects them. No failed probability was overridden. The requested exception decision remains unanswered; these two recoveries were not installed into their original place records.

Source branch: `open-world-mvp`, starting at `6759f66` after Brief 07. Read `FOOTFALL-GOAL.md`, findings F12/F13, 04b/07 reports, the last 15 commits, and the requested before/after images.

## Changes

- `repairGround` no longer subtracts localized or labelled rectangles, expands their bounds, or erodes the entire floor after a global rejection. Only an explicit object raster can repair a rejection; an unresolved rejection still fails closed. Routes no longer pay for bounding-box localization that cannot safely repair the mask.
- Cached object masks are resampled to the actual floor grid. The old 192×108 indexing corrupted exclusions on the road's 384×216 floor. Removed blanket silhouette dilation: clearance belongs at object support depth. Brief 07's bridge → physical footprints → body erosion order and its 0.15 m support rule are unchanged.
- Occluders retain their segmented supporting silhouette when a floor gap leaves no contact samples. A missing/shrunken floor must not erase the object response. Semantic mask names such as `gargoyle-0` match the original label, replacing stale localization bounds. Hazard questions, provider, probability conversion, asymmetric policy, and inclusive 0.6 rejection threshold are unchanged. Review masks now use opaque green for unambiguous mask membership.
- Depot authored bands cover the full image before intersection with segmented floor; perspective calibration lines are unchanged. This removes remaining side and top clipping. The final caption boundary remains intentional.
- Existing-place refreshes losing **more than 15%** of normalized image area keep the entire previous record. The audit logs the reason, loss, previous/candidate geometry, and both uniquely named overlays. Exact 15% is allowed; 16% is retained for review. Failed replacements still preserve the previous working record.

Commits: `4d6f75c` (geometry), `59b0098` (shrink guard). Both include the requested co-author trailer.

## Eight generated overlays, inspected individually

All requested files exist at `tmp/walkqa/derivation/<key>-04c.png`. Green is candidate visible floor; cyan rectangles are region annotations, not clipping boundaries. These are derivation overlays, not a claim that every green cell survives body erosion. `verification-04c/places.json` records IDs, exact areas, status and verdicts. For road/alley, `*-04c-active.json` and `*-04c-active-overlay.png` separately retain the actual installed state.

| Key | Status / area versus 04b | Visual note |
|---|---|---|
| pier | Existing active floor; unchanged | Boards remain covered around crates, rope, posts and exposed water gaps. No rectangular subtraction edge seen. Runtime passage completeness remains a prior limitation; no new all-pier walking signoff. |
| stepped-street | Installed; +166.08% | Both sides and the climb into the upper steps restored. Lamp and net silhouettes excluded. The central vertical-sided rectangle is gone. Regional stair scales retained. |
| church | Existing active floor; unchanged | Central aisle follows pew boundaries. Raised rear floor and peripheral gaps remain omitted; no broad coverage claim. |
| lobby | Existing active floor; unchanged | Foreground floor/rug around desk and pillars retained; only lower stair access. Small omissions at rug edges remain. |
| grocery | Installed; +26.42% | Re-derived from cached perception after the visual audit found another straight right-hand cut. Floor now follows the barrels and doorway instead; central aisle remains open. Judge passed. |
| square | Existing active floor; unchanged | Curved foreground/side floor avoids fountain and lamp supports. Rear deck remains omitted; a full circuit is not established. |
| road | **Staged**, +38.10% | Street/side approaches recovered; traps, nets, trees and buildings excluded by silhouettes. The staged runtime has 162 connected cells under the left-tree span and a path to (442.5, 812.5). Global obstacle P=1.0 blocks installation. A smaller judge-passing intermediate is installed, but does not restore full tree access. |
| alley | **Staged**, +72.65% | Deep cobbled corridor restored; crate, baskets, gargoyle, rear barrel and foreground net/debris contours excluded. No foreground-only rectangle. Global obstacle P=1.0 blocks installation despite object-specific checks passing. Original place remains on its prior shallow floor. |

## Depot verification and the four dirty masks

`derivation/depot-outside-04c.png` and `depot-inside-04c.png` show actual runtime geometry: green navigable floor, red physical supports, cyan occluders, yellow baselines. Both were opened by eye.

- Outside: one connected foreground route around both net piles; left-to-right path exists. Six occluders returned. Width expands beyond the former authored 200–1520 range. Rear dock coverage is still limited by its segmented floor, not an authored range split.
- Inside: connected foreground/door floor, with a left-to-right path. Two occluders returned (bench and bus); the response is no longer empty. The lower horizontal limit is caption clipping. This does not establish a walk behind the wall-adjacent bench.
- Connectivity records: `derivation/connectivity-04c.json`; runtime inputs: `final-04c/depot-{outside,inside}/{area,navigation}.json`.

The four pre-existing dirty PNGs were inspected against the artwork (`derivation/anchor-dirty-04c.jpg`). They are older, incomplete/wrong cuts: the old “bus” is doorway/awning pixels; the net has a post-shaped missing strip; bench/pergola cuts are incomplete. Their tracked versions were restored, and the rejected edits were retained in the named stash `04c rejected legacy anchor masks retained for audit` after the safety hook required a preserving alternative to direct restore. Brief 07's separate repaired masks remain active. Regenerated active PNGs were pixel-identical to HEAD; their metadata-only changes were also removed from the worktree using a separate named stash. No mask pixel modifications are part of these commits.

## Frame-perfect diagnostic walks

No rejected candidate was installed as an accepted place. Temporary diagnostic IDs were used for playback, then deleted; their exact records are saved in `verification-04c/place-04c-{alley,road}-review.json`.

| Clip | Frames / walking | Off-floor | Object contacts | Max lock excursion | Frozen walking pairs |
|---|---:|---:|---:|---:|---:|
| `review-04c/alley/away-far.mp4` | 92 / 88 | 0/88 | 0 | 0.0 px | 0/87 |
| `review-04c/road/left-tree-approach.mp4` | 148 / 143 | 0/143 | 0 | 0.0 px | 0 |

Alley repeats the requested Brief 06 start `(590,820)` and click `(610,665)`. It travels 162 px into depth and ends at body `(625.67,664.70)`; target projection is `(607.5,662.5)`, inside the motor's recorded half-stride arrival tolerance. The 6 fps contact sheet was inspected across the complete walk. This passes the specified physical measurements **on the staged candidate**, not the original installed place.

The road approach reaches the left side, then triggers its existing edge exit at frame 143. The preceding body position is `(509.62,799.25)`. This is not a completed walk-behind proof. Navigation independently establishes the deeper left-side target/path; `derivation/road-tree-review-reachability-04c.json` records it. The full contact sheet, including the destination change, was inspected.

Raw checks: `logs/04c-review-walkstats.txt`, `04c-review-lockcheck.txt`, `04c-review-freeze.txt`, `04c-tree-freeze.txt`. Every video frame comes from the game's virtual-clock PNG capture at 24 fps; no generated video. Logs, masks and contact sheets remain available alongside the clips. The renderer removed its temporary PNG frame sequences after encoding.

## Why the final recoveries remain staged

Multiple segmentation repairs and a fresh alley floor segmentation were tried without rectangular subtraction. The global obstacle question still says the already excluded crate/nets/barrel are green, while its focused object questions say they are excluded. The exact reviewed images and rejected probabilities are retained in `derivation/{road,alley}-04c/`. The newer candidates preserve more floor and have passing physical diagnostics, but those facts do not change the judge's failed verdict. No probability was edited, omitted, or weakened to promote a candidate.

A decision is needed between retaining the current fail-closed gate and explicitly approving a reviewed exception for the recovered floors. Until then, full Brief 04c acceptance is **not met**. No automatic exception switch was added.

## Checks, budget and cleanup

- Full suite: **384 tests / 38 files passed** (`logs/04c-tests-final.log`). The final audit-comparison adjustment also passed all six place-route tests (`04c-guard-tests.log`).
- Typecheck, lint and `verify:art` passed, with existing artwork warnings only. Logs: `04c-typecheck-final.log`, `04c-lint-final.log`, `04c-art.log`.
- **11/20 segmentation calls, 0 depth calls.** Budget is enforced for `DERIVATION_BRIEF=04c`; task-only ledger: `verification-04c/segmentation-calls.md`. Cached floors/depth were used first. New calls supplied missing/repaired object masks and one alley floor segmentation after cached candidates repeatedly failed review. Model judge requests are separate and their review records are retained. No image/video generation.
- API 4700 was used for geometry checks. Playback used game 8080 / API 4317 with provider credentials disabled and `?mute=1` throughout.
- All three task servers stopped; no listeners remain on 4700, 4317 or 8080. Browser session `brief04c` closed. Temporary diagnostic DB entries and duplicated historical perception artifacts removed. Proofs and cached segmentation inputs retained.
- No push, merge, deployment, GitHub settings, credential writes or dotenv edits. Preserved the pre-existing `AgentDebug.test.ts` and other briefs' shared call-ledger edits.
