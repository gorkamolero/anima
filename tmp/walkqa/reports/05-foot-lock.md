# Brief 05 — foot locking and diagonal cycles

Status: **NOT ACCEPTED. 0/63 proof clips pass: 62 measured failures and 1 unresolved no-stance clip.**

## Baseline and proof matrix

Before is Brief 03 after. Five baseline entries were not measured in Brief 03; they are explicitly marked below. New diagonal variants have no baseline.

| Clip | Before median / max px | After max px | Status |
|---|---:|---:|---|
| road/away-far.mp4 | 5.26 / 5.44 | 3.44 | FAIL |
| road/away-near.mp4 | 2.52 / 4.47 | 8.09 | FAIL |
| road/diagonal.mp4 | 5.94 / 17.19 | 10.55 | FAIL |
| road/exit.mp4 | no stance | 19.35 | FAIL |
| road/far-exit.mp4 | 122.04 / 122.04 | 2.4 | FAIL |
| road/object-click.mp4 | no stance | 2.95 | FAIL |
| road/side-far.mp4 | 1.71 / 4.18 | 1.87 | FAIL |
| road/side-near.mp4 | 2.05 / 3.62 | 5.47 | FAIL |
| road/toward-far.mp4 | 1.37 / 1.66 | 3.14 | FAIL |
| road/toward-near.mp4 | 1.2 / 2.72 | 6.45 | FAIL |
| road/trap-behind.mp4 | 4.55 / 15.04 | 10.71 | FAIL |
| road/trap-front.mp4 | 0.44 / 4.5 | 11.85 | FAIL |
| road/tree-behind.mp4 | 3.29 / 31.59 | 6.61 | FAIL |
| road/tree-front.mp4 | 0.2 / 0.26 | no stance | unresolved (no stance) |
| alley/away-far.mp4 | no stance | 6.48 | FAIL |
| alley/away-near.mp4 | 3.79 / 8.9 | 10.3 | FAIL |
| alley/crate-behind.mp4 | no stance | 11.78 | FAIL |
| alley/crate-front.mp4 | no stance | 8.25 | FAIL |
| alley/diagonal.mp4 | 10.97 / 30.84 | 19.81 | FAIL |
| alley/exit.mp4 | 0.22 / 0.48 | 10.52 | FAIL |
| alley/object-click.mp4 | 3.27 / 3.27 | 2.72 | FAIL |
| alley/side-far.mp4 | 8.33 / 15.85 | 13.29 | FAIL |
| alley/side-near.mp4 | 4.47 / 7.33 | 11.43 | FAIL |
| alley/toward-far.mp4 | 0.01 / 0.01 | 6.49 | FAIL |
| alley/toward-near.mp4 | 0.59 / 1.07 | 8.91 | FAIL |
| depot-outside/away-far.mp4 | no stance | 8.4 | FAIL |
| depot-outside/away-near.mp4 | 3.83 / 10.51 | 17.13 | FAIL |
| depot-outside/diagonal.mp4 | not measured in 03 | 16.12 | FAIL |
| depot-outside/exit.mp4 | not measured in 03 | 6.06 | FAIL |
| depot-outside/object-click.mp4 | not measured in 03 | 4.1 | FAIL |
| depot-outside/post-behind.mp4 | not measured in 03 | 17.01 | FAIL |
| depot-outside/post-front.mp4 | not measured in 03 | 16.12 | FAIL |
| depot-outside/side-far.mp4 | 2.64 / 8.26 | 7.21 | FAIL |
| depot-outside/side-near.mp4 | 5.77 / 7.24 | 10.47 | FAIL |
| depot-outside/toward-far.mp4 | 0.01 / 0.01 | 11.25 | FAIL |
| depot-outside/toward-near.mp4 | 0.1 / 3.93 | 8.19 | FAIL |
| depot-inside/away-far.mp4 | 1.56 / 1.56 | 2.59 | FAIL |
| depot-inside/away-near.mp4 | 1.86 / 3.11 | 5.73 | FAIL |
| depot-inside/bench-behind.mp4 | 2.62 / 4.71 | 10.53 | FAIL |
| depot-inside/bench-front.mp4 | 0.84 / 1.55 | 12.97 | FAIL |
| depot-inside/diagonal.mp4 | 16.66 / 29.91 | 23.26 | FAIL |
| depot-inside/exit.mp4 | no stance | 7.76 | FAIL |
| depot-inside/object-click.mp4 | 1.71 / 5.24 | 19.25 | FAIL |
| depot-inside/side-far.mp4 | 2.89 / 5.76 | 6.48 | FAIL |
| depot-inside/side-near.mp4 | 3.06 / 9.48 | 7.47 | FAIL |
| depot-inside/toward-far.mp4 | 1.56 / 9.41 | 7.76 | FAIL |
| depot-inside/toward-near.mp4 | 1.07 / 1.37 | 14.53 | FAIL |

| road/diagonal-away-right.mp4 | new clip | 6.68 | FAIL |
| road/diagonal-away-left.mp4 | new clip | 9.31 | FAIL |
| road/diagonal-toward-right.mp4 | new clip | 6.45 | FAIL |
| road/diagonal-toward-left.mp4 | new clip | 8.17 | FAIL |
| alley/diagonal-away-right.mp4 | new clip | 15.15 | FAIL |
| alley/diagonal-away-left.mp4 | new clip | 12.1 | FAIL |
| alley/diagonal-toward-right.mp4 | new clip | 7.32 | FAIL |
| alley/diagonal-toward-left.mp4 | new clip | 10.09 | FAIL |
| depot-outside/diagonal-away-right.mp4 | new clip | 13.88 | FAIL |
| depot-outside/diagonal-away-left.mp4 | new clip | 14.28 | FAIL |
| depot-outside/diagonal-toward-right.mp4 | new clip | 18.38 | FAIL |
| depot-outside/diagonal-toward-left.mp4 | new clip | 15.32 | FAIL |
| depot-inside/diagonal-away-right.mp4 | new clip | 13.28 | FAIL |
| depot-inside/diagonal-away-left.mp4 | new clip | 13.45 | FAIL |
| depot-inside/diagonal-toward-right.mp4 | new clip | 12.26 | FAIL |
| depot-inside/diagonal-toward-left.mp4 | new clip | 13.69 | FAIL |

## Milestones

- Read goal, rejected report, last 20 commits, motor, registration, capture script and sprite metadata. Existing untracked AgentDebug.test.ts preserved.

## Paid calls

Brief 05: image edits 3/4; Kling videos 2/4; BRIA removals 2/4. Front edit 1 rejected for facing left; corrected edit reviewed. Both video 6-fps sheets reviewed, full-body walking accepted for extraction. No Veo.

## Commits

- d43bd5d: restore the requested scene between proof beats.

- 0fa659c: baseline and call ledger.
- b811a2c: explicit exit completion at a valid held footfall; regression tests.
- daebd44: half-stride arrival regression assertions and idle sole identity.
- f0b950e: diagonal assets, physical-foot metadata and call provenance.
- ef10c0c: contact-driven motor, local view heading sectors, tests, adapter and capture telemetry.

- Milestone: physical-foot registration replaces image-half identity; existing side/away/toward contact sheets reviewed frame by frame. Motor uses anchor-relative placement and a single frame clock, view-relative eight-sector headings, switch-only turns, bounded anchor correction, and contact-pose hold. 343 tests pass; engine and game typecheck pass. Pixel proof still pending.
- Diagonal assets generated with Kling v3 Standard, 5 seconds, audio disabled. Away loop [28,76), toward [60,85), 24fps. Constant normalization matches 1030.5px median side height; no per-frame alignment. Previews and manifests under public/assets/sprites/hermes.

- Milestone: second side trial remains FAIL, 11.24px, worst 28-39 (`tmp/walkqa/trial-05b/side-near-worst.png`). Early profile handoff was rejected because it anchored the still-swinging boot; restored profile switches 3/21. Full capture runs use the later reviewed data.
- Town replay first attempt stopped at the obsolete 2px arrival assertion. Updated to independently require half-stride distance and a switch frame. Retry pending.

- Milestone: all three non-road exit retries now complete and release input after the explicit-exit/half-stride integration fix. Source walking clips are separated at the actual scene transition; full uncut videos, full telemetry and destination frames are retained under `tmp/walkqa/transitions-05/`. This prevents a second background from corrupting the checker median. No walking frames are omitted from the source segment.
- Verification after exit fix: 346 tests pass; engine, game and API typecheck/lint pass. Town replay is now reaching both return exits; final replay PASS: 83 cached calls, 0 uncached calls; no TTS requests (`tmp/open-world-demo/run-1.json`, `journey.md`).


- Milestone: all 63 full-resolution captures exist. 58 pixel checks have finished; none passes. Every previously unmeasured clip now has a measured stance, but these are failures, not accepted replacements.
- Telemetry audit: 5,259 walking frames; maximum contact-to-anchor residual 4.69e-13 px, maximum within-stance anchor correction 0.9445 px, maximum perspective scale relative error 4.50e-13, no identical position/texture-frame pairs while walking. These algebraic checks do not establish pixel planting. **747 walking frames lie outside the floor mask**; bounded anchor steering does not yet constrain the entire drawn stance to the navigation corridor. Details: `tmp/walkqa/final-05/telemetry-results.json`.
- Road original diagonal walking time is 5.292 s. Explicit away-left/right: 5.417 / 6.292 s; toward-left/right: 8.500 / 10.333 s. The latter two fail the approximate 8 s target.
- Tighter sole-ROI trial [45,18] remains FAIL (near 12.06 px, far 5.32 px). Trial metadata and clips are under `tmp/walkqa/trial-sole-05/`; production metadata restored. Do not substitute this experiment for the main proof matrix.
- Capture isolation fixed: each beat now reloads its requested scene after any preceding exit and records the source scene before clicking. Road tree-front still starts inside an exit-sensitive region and leaves after one walking frame; it is not a valid front-crossing proof. The floor mask also has no walkable cells at y950 or below, so the foreground-tree crossing is not established by these plans.

- Final implementation cleanup: removed unused four-direction heading/lookahead and speed-to-playback helpers, their obsolete tests, and unused `--axis`/`--travel` extractor arguments. Final verification: 340 current tests and 3 Python registration tests pass; engine/game/API typecheck and lint pass. Pixel output is unchanged by this dead-code removal.

## Open failures

Trial 1 (superseded registration): road side-near 7.75px maximum, worst frames 53-57 (`tmp/walkqa/trial-05/side-near-worst.png`); road diagonal 23.04px maximum, worst frames 13-26 (`tmp/walkqa/trial-05/diagonal-worst.png`). Both FAIL. Diagonal 284 captured frames = 11.83s including hold, versus prior ~64s; still above the ~8s target. Handoffs moved earlier to avoid locking the outgoing toe-off. Seed contacts now initialise on the sole alpha boundary. No checker edits.

Anchor verify:art passes outside and inside. The full 63-clip pixel matrix is now measured; see the final review below. 

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

Raw diagnosis telemetry: `tmp/walkqa/no-stance-05/telemetry.json`. New measurements are included above; all seven formerly unmeasured cases now fail with measurable stances. None of these explanations is counted as a pass.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
