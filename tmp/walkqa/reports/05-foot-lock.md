# Brief 05 — foot locking and diagonal cycles

Status: IN PROGRESS. No acceptance claim.

## Baseline and proof matrix

Before is Brief 03 after; pending means no completed measurement.

| Clip | Before median / max px | After max px | Status |
|---|---:|---:|---|
| road/away-far.mp4 | 5.26 / 5.44 | pending | pending |
| road/away-near.mp4 | 2.52 / 4.47 | pending | pending |
| road/diagonal.mp4 | 5.94 / 17.19 | pending | pending |
| road/exit.mp4 | no stance | pending | pending |
| road/far-exit.mp4 | 122.04 / 122.04 | pending | pending |
| road/object-click.mp4 | no stance | pending | pending |
| road/side-far.mp4 | 1.71 / 4.18 | pending | pending |
| road/side-near.mp4 | 2.05 / 3.62 | pending | pending |
| road/toward-far.mp4 | 1.37 / 1.66 | pending | pending |
| road/toward-near.mp4 | 1.2 / 2.72 | pending | pending |
| road/trap-behind.mp4 | 4.55 / 15.04 | pending | pending |
| road/trap-front.mp4 | 0.44 / 4.5 | pending | pending |
| road/tree-behind.mp4 | 3.29 / 31.59 | pending | pending |
| road/tree-front.mp4 | 0.2 / 0.26 | pending | pending |
| alley/away-far.mp4 | no stance | pending | pending |
| alley/away-near.mp4 | 3.79 / 8.9 | pending | pending |
| alley/crate-behind.mp4 | no stance | pending | pending |
| alley/crate-front.mp4 | no stance | pending | pending |
| alley/diagonal.mp4 | 10.97 / 30.84 | pending | pending |
| alley/exit.mp4 | 0.22 / 0.48 | pending | pending |
| alley/object-click.mp4 | 3.27 / 3.27 | pending | pending |
| alley/side-far.mp4 | 8.33 / 15.85 | pending | pending |
| alley/side-near.mp4 | 4.47 / 7.33 | pending | pending |
| alley/toward-far.mp4 | 0.01 / 0.01 | pending | pending |
| alley/toward-near.mp4 | 0.59 / 1.07 | pending | pending |
| depot-outside/away-far.mp4 | no stance | pending | pending |
| depot-outside/away-near.mp4 | 3.83 / 10.51 | pending | pending |
| depot-outside/diagonal.mp4 | pending | pending | pending |
| depot-outside/exit.mp4 | pending | pending | pending |
| depot-outside/object-click.mp4 | pending | pending | pending |
| depot-outside/post-behind.mp4 | pending | pending | pending |
| depot-outside/post-front.mp4 | pending | pending | pending |
| depot-outside/side-far.mp4 | 2.64 / 8.26 | pending | pending |
| depot-outside/side-near.mp4 | 5.77 / 7.24 | pending | pending |
| depot-outside/toward-far.mp4 | 0.01 / 0.01 | pending | pending |
| depot-outside/toward-near.mp4 | 0.1 / 3.93 | pending | pending |
| depot-inside/away-far.mp4 | 1.56 / 1.56 | pending | pending |
| depot-inside/away-near.mp4 | 1.86 / 3.11 | pending | pending |
| depot-inside/bench-behind.mp4 | 2.62 / 4.71 | pending | pending |
| depot-inside/bench-front.mp4 | 0.84 / 1.55 | pending | pending |
| depot-inside/diagonal.mp4 | 16.66 / 29.91 | pending | pending |
| depot-inside/exit.mp4 | no stance | pending | pending |
| depot-inside/object-click.mp4 | 1.71 / 5.24 | pending | pending |
| depot-inside/side-far.mp4 | 2.89 / 5.76 | pending | pending |
| depot-inside/side-near.mp4 | 3.06 / 9.48 | pending | pending |
| depot-inside/toward-far.mp4 | 1.56 / 9.41 | pending | pending |
| depot-inside/toward-near.mp4 | 1.07 / 1.37 | pending | pending |

| road/diagonal-away-right.mp4 | new clip | pending | pending |
| road/diagonal-away-left.mp4 | new clip | pending | pending |
| road/diagonal-toward-right.mp4 | new clip | pending | pending |
| road/diagonal-toward-left.mp4 | new clip | pending | pending |
| alley/diagonal-away-right.mp4 | new clip | pending | pending |
| alley/diagonal-away-left.mp4 | new clip | pending | pending |
| alley/diagonal-toward-right.mp4 | new clip | pending | pending |
| alley/diagonal-toward-left.mp4 | new clip | pending | pending |
| depot-outside/diagonal-away-right.mp4 | new clip | pending | pending |
| depot-outside/diagonal-away-left.mp4 | new clip | pending | pending |
| depot-outside/diagonal-toward-right.mp4 | new clip | pending | pending |
| depot-outside/diagonal-toward-left.mp4 | new clip | pending | pending |
| depot-inside/diagonal-away-right.mp4 | new clip | pending | pending |
| depot-inside/diagonal-away-left.mp4 | new clip | pending | pending |
| depot-inside/diagonal-toward-right.mp4 | new clip | pending | pending |
| depot-inside/diagonal-toward-left.mp4 | new clip | pending | pending |

## Milestones

- Read goal, rejected report, last 20 commits, motor, registration, capture script and sprite metadata. Existing untracked AgentDebug.test.ts preserved.

## Paid calls

Brief 05: image edits 3/4; Kling videos 2/4; BRIA removals 2/4. Front edit 1 rejected for facing left; corrected edit reviewed. Both video 6-fps sheets reviewed, full-body walking accepted for extraction. No Veo.

## Commits

- 0fa659c: baseline and call ledger.
- f0b950e: diagonal assets, physical-foot metadata and call provenance.
- ef10c0c: contact-driven motor, local view heading sectors, tests, adapter and capture telemetry.

- Milestone: physical-foot registration replaces image-half identity; existing side/away/toward contact sheets reviewed frame by frame. Motor uses anchor-relative placement and a single frame clock, view-relative eight-sector headings, switch-only turns, bounded anchor correction, and contact-pose hold. 343 tests pass; engine and game typecheck pass. Pixel proof still pending.
- Diagonal assets generated with Kling v3 Standard, 5 seconds, audio disabled. Away loop [28,76), toward [60,85), 24fps. Constant normalization matches 1030.5px median side height; no per-frame alignment. Previews and manifests under public/assets/sprites/hermes.

- Milestone: second side trial remains FAIL, 11.24px, worst 28-39 (`tmp/walkqa/trial-05b/side-near-worst.png`). Early profile handoff was rejected because it anchored the still-swinging boot; restored profile switches 3/21. Full capture runs use the later reviewed data.
- Town replay first attempt stopped at the obsolete 2px arrival assertion. Updated to independently require half-stride distance and a switch frame. Retry pending.

## Open failures

Trial 1 (superseded registration): road side-near 7.75px maximum, worst frames 53-57 (`tmp/walkqa/trial-05/side-near-worst.png`); road diagonal 23.04px maximum, worst frames 13-26 (`tmp/walkqa/trial-05/diagonal-worst.png`). Both FAIL. Diagonal 284 captured frames = 11.83s including hold, versus prior ~64s; still above the ~8s target. Handoffs moved earlier to avoid locking the outgoing toe-off. Seed contacts now initialise on the sole alpha boundary. No checker edits.

Anchor verify:art passes outside and inside. Full proof matrix remains pending. 

### Prior no-stance diagnosis (original clips retained)

All seven representative frames were inspected at full resolution. Height figures
below are source frame height times scale; these are not tiny sprites.

| Clip | Walking frames | Figure height px | Diagnosis | Frame evidence |
|---|---:|---:|---|---|
| road/exit | 38/144 | 211-456 | Walk occurs; scene changes during the clip, invalidating a single-background estimate. | tmp/walkqa/no-stance-05/road-exit-19.png |
| road/object-click | 3/180 | 328-331 | Starts almost at the object approach, too short for a measured stance. New start is farther away. | tmp/walkqa/no-stance-05/road-object-click-1.png |
| alley/away-far | 3/72 | 379-382 | Start and target snap to nearly the same reachable floor edge (y837-840). New approach starts farther forward. | tmp/walkqa/no-stance-05/alley-away-far-1.png |
| alley/crate-behind | 3/144 | 374-377 | Only 2.6 px ground travel after floor snapping; figure is visible. New crossing spans the crate horizontally. | tmp/walkqa/no-stance-05/alley-crate-behind-1.png |
| alley/crate-front | 12/144 | 376-390 | Only 13 px depth travel. New crossing spans the crate horizontally. | tmp/walkqa/no-stance-05/alley-crate-front-6.png |
| depot-outside/away-far | 0/72 | 320 | No walking; original start is over the fishing-net area and click yields no walk. New far approach uses the open left dock. | tmp/walkqa/no-stance-05/depot-outside-away-far-36.png |
| depot-inside/exit | 5/144 | 408-456 | Starts at the door; only five walking frames then scene transition. New approach starts farther from the door. | tmp/walkqa/no-stance-05/depot-inside-exit-2.png |

Raw diagnosis telemetry: `tmp/walkqa/no-stance-05/telemetry.json`. New measurements
remain required; none of these explanations is counted as a pass.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
