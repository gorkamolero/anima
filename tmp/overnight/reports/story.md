# Tracks 4 and 6 — story and swarm

Status: Acts 2, 3, 3b and 4 play end to end; all four recordings and lens renders verified; 120/120 swarm sessions pass.

## Playable routes

- Act 2: hotel room → investigation (square, grocery, library, harbor) → Zadok at the pier → act end.
- Act 3: harbor chase → streets → church exterior/interior → Kat → escape road → act end.
- Act 3b: Abel's boat → reef → confrontation; both clerk-interest conditions, rescue/release branches and abyssal credits. Non-abyssal routes reach the Act 4 boundary. Act 3 also offers Abel's boat from church_escape.
- Act 4: apartment → dream → morning → coastal road → beach → all three final choices; ordinary and together credits.
- Act 1 retains Brief B's arrival route. Its full hotel continuation was not part of this brief's live acceptance.

Entry URLs: `http://localhost:8080/?act=2`, `?act=3`, `?act=3b`, `?act=4`. Add `&noticed=1` for the reef's other initial condition; add `&mute=1` for silent reading. The review menu links all acts. L/T/U selects Look/Talk/Use before clicking a labelled hotspot. The standalone act entries start fresh state. At an act ending, Continue carries inventory and flags into the next act. Terminal game endings stay final. The live reef-to-Act-4 test verified the surface/note flags and the corresponding dialogue (`story-continuation.json`, `story-continue-button.png`).

## Implementation

The same StoryRuntime, StoryDialogue, canvas mirror and React dialogue panel serve all acts. Automatic scene chains retain their individual places and captions. Nested entry blocks, scene-level arrows, post-choice continuations, compound conditions and authored end credits now execute. The reef's appended replacement endings override their earlier drafts. All available scene hotspots receive visible clickable regions; missing-art scenes use a labelled interaction board on the depot backdrop.

Two story edits repair structurally unreachable beats: a boat hotspot connects the original chase to the reef; a choice connects the orphaned release dialogue. Other story text is unchanged. Authored acts keep isolated runtime state instead of depending on preview-world saves. Reusing a place across cutscene beats retains its existing geometry.

## Evidence

Scripts: `adventures/shadow-over-innsmouth/scripts/playtest-act2.mjs`, `playtest-act3.mjs` (runs both files), `playtest-act4.mjs`; shared browser policy in `story-player.mjs`. They use real `__anima.click`, `snapshot`, `waitUntil`, keyboard verb events and dialogue events. No runtime teleports or mutations. Recordings use `__anima.record` and are processed by the existing `walk-lens.mjs`.

Per-act traces and screenshots: `tmp/overnight/reports/act{2,3,3b,4}-playtest.json`, `act*-end.png`. Source recordings: `tmp/recordings/act{2,3,3b,4}-playthrough.webm` and telemetry JSON. Lens outputs live in matching directories. These are silent dialogue captures, not a voice audition or walking/scale acceptance. NPC sprites and character scale remain the other tracks' responsibility.

## Recorded evidence

| Act | Full canvas MP4 | Capture duration | Lens output |
|---|---|---:|---|
| 2 | [Act 2](../../recordings/act2-playthrough.mp4) | 240 s | [report](../../recordings/act2-playthrough/report.txt) |
| 3 | [Act 3](../../recordings/act3-playthrough.mp4) | 120 s | [report](../../recordings/act3-playthrough/report.txt) |
| 3b | [Devil Reef](../../recordings/act3b-playthrough.mp4) | 120 s | [report](../../recordings/act3b-playthrough/report.txt) |
| 4 | [Act 4](../../recordings/act4-playthrough.mp4) | 120 s | [report](../../recordings/act4-playthrough/report.txt) |

All MP4s are 1920×1080. Freshness and media metadata: `story-media.json`. Final lens frame counts: Act 2 — 14,070; Act 3 — 6,987; Act 3b — 7,184; Act 4 — 7,066. Act 2 uses the direct route (122 seconds of play, then a held completion screen); the other captures use the curious policy. Earlier curious Act 2 capture attempts exceeded the fixed window or harness wait and were rejected, then replaced by the successful direct-route capture. Optional investigation is covered by the swarm. Choice menus pause before selection in the final Act 2, 3b and 4 captures. Extracted frames were reopened to verify choices, stub labels and completion: `act2-choice-proof.png`, `act2-ending-proof.png`, `act3b-choice-proof.png`, `act4-choice-proof.png`.

Lens renders use `--skip-gif` for the refreshed long clips; realtime/slowmo MP4s, fixed/stabilised strips, every decoded frame and telemetry reports remain in each recording directory. Optional GIF generation was interrupted when memory-heavy, then the verified MP4/frame stages were resumed. No walking-quality conclusion is drawn from these dialogue captures.

## Scene/art inventory

No places generated. Existing-place catalog captured from GET /api/places in `story-places.json`. Full machine-readable mapping: `story-scenes.json`. There are 53 scene entries: 14 mapped to existing places and 39 labelled placeholders (including transitional/credits scenes). The church interior already exists; its exterior does not have matching art.

| Story file | Scene | Place | Stub label |
|---|---|---|---|
| act2.story | hotel_room | inside | hotel room pending |
| act2.story | town_square | place-0be8458a1e434dd7ee9e | — |
| act2.story | grocery_store | place-045884673aa9e212d400 | — |
| act2.story | harbor | place-2a19481aac649a2e69f1 | — |
| act2.story | library | inside | library pending |
| act2.story | hotel_lobby_evening | place-7672fad03a2b6c668284 | — |
| act2.story | pier_meeting | place-96acfd3d8faaf8f903fe | — |
| act3.story | chase_begins | place-2a19481aac649a2e69f1 | — |
| act3.story | street_chase | place-2635d8cd03bce818a634 | — |
| act3.story | church_exterior | inside | church exterior pending |
| act3.story | church_interior | place-15965c132f18663902c3 | — |
| act3.story | church_escape | place-e3110e2fd21ee4e07819 | — |
| act3.story | escape_road | place-f2d0a7f7f76225002663 | — |
| act3.story | act3_end | inside | act3 end pending |
| act3b_devil_reef.story | devil_reef_approach | inside | devil reef approach pending |
| act3b_devil_reef.story | devil_reef | inside | devil reef pending |
| act3b_devil_reef.story | reef_descent | inside | reef descent pending |
| act3b_devil_reef.story | reef_chamber | inside | reef chamber pending |
| act3b_devil_reef.story | kat_still_fighting | inside | kat still fighting pending |
| act3b_devil_reef.story | kat_further_gone | inside | kat further gone pending |
| act3b_devil_reef.story | confrontation_setup | inside | confrontation setup pending |
| act3b_devil_reef.story | reef_departure | inside | reef departure pending |
| act3b_devil_reef.story | reef_departure_far_gone | inside | reef departure far gone pending |
| act3b_devil_reef.story | rescue_escape | inside | rescue escape pending |
| act3b_devil_reef.story | rescue_choice_left | inside | rescue choice left pending |
| act3b_devil_reef.story | rescue_choice_right | inside | rescue choice right pending |
| act3b_devil_reef.story | rescue_swim | inside | rescue swim pending |
| act3b_devil_reef.story | rescue_boat_race | inside | rescue boat race pending |
| act3b_devil_reef.story | rescue_boat | inside | rescue boat pending |
| act3b_devil_reef.story | ending_together_deep | inside | ending together deep pending |
| act3b_devil_reef.story | ending_witness_release | inside | ending witness release pending |
| act3b_devil_reef.story | ending_witness_mutual | inside | ending witness mutual pending |
| act3b_devil_reef.story | ending_witness_failed | inside | ending witness failed pending |
| act3b_devil_reef.story | rescue_ending_lost | inside | rescue ending lost pending |
| act3b_devil_reef.story | rescue_ending_apart | inside | rescue ending apart pending |
| act3b_devil_reef.story | rescue_ending_together_broken | inside | rescue ending together broken pending |
| act3b_devil_reef.story | rescue_ending_together_uncertain | inside | rescue ending together uncertain pending |
| act3b_devil_reef.story | rescue_ending_together_choice | inside | rescue ending together choice pending |
| act3b_devil_reef.story | surface_false_victory | inside | surface false victory pending |
| act3b_devil_reef.story | surface_she_leaves | inside | surface she leaves pending |
| act3b_devil_reef.story | ACT4_TRANSITION | inside | act4 transition pending |
| act3b_devil_reef.story | ending_to_act4 | inside | ending to act4 pending |
| act3b_devil_reef.story | GAME_END_ABYSSAL | inside | game end abyssal pending |
| act4.story | one_year_later | inside | one year later pending |
| act4.story | the_dream | inside | the dream pending |
| act4.story | one_year_later_morning | inside | one year later morning pending |
| act4.story | drive_to_beach | place-f2d0a7f7f76225002663 | — |
| act4.story | the_beach | place-a53d08124ed6c715c32e | — |
| act4.story | the_end | place-a53d08124ed6c715c32e | — |
| act4.story | the_end_together | inside | the end together pending |
| act4.story | GAME_END_TOGETHER | inside | game end together pending |
| act4.story | epilogue | place-a53d08124ed6c715c32e | — |
| act4.story | GAME_END | inside | game end pending |

## Validation

23 tests pass across StoryScript runtime, actual act routes (including 13 reef decision routes) and dialogue presentation, plus carried state at act boundaries. Adventure typecheck passes. Logs: `story-tests.log`, `story-branches.log`, `story-typecheck.log`, `story-lint.log`. Full repository lint/Footfall acceptance is outside this brief; protected walking, exit, arrival, sprites, ground derivation and Footfall files were not edited.

## Swarm

120/120 real-browser sessions passed: Act 2 — 24; Act 3 — 24; Act 3b — 48; Act 4 — 24. Policies: 32 curious, 32 rusher, 56 completionist. All options in every observed menu were selected; the 13 reef decision routes are also checked directly. This is observed menu/route coverage, not a claim to enumerate every possible combination of independent flags.

Endings: 90 ACT_END, 19 GAME_END, 6 GAME_END_ABYSSAL, 5 GAME_END_TOGETHER. Each session has a JSON trace under `swarm/`. An additional joined chase-to-reef test passed (`story-linked-route.json`), followed by the real Continue-button test through Act 4 (`story-continuation.json`). The latter ran after the continuation change; the 120-session batch tested the unchanged fresh-entry paths.

The failure table retains the initial discoveries rather than discarding them. All listed issues were fixed before the final batch.

| Session | Act | Policy | Failure | Status | Trace |
|---|---|---|---|---|---|
| probe | 2 | curious | session failure: Error: Transition/dialogue failed to settle | Fixed: isolated authored state from preview persistence | tmp/overnight/reports/story-probe.json |
| probe | 2 | curious | error thrown: Error: Unable to save world | Fixed: isolated authored state from preview persistence | tmp/overnight/reports/story-probe.json |
| recorded probe | 3b | curious | session failure: Error: Transition/dialogue failed to settle | Fixed: long cutscene wait budget and reused same-place geometry | tmp/overnight/reports/act3b-driver-timeout.json |
| initial-2 | 3 | curious | runner error: Error: Timed out: !!window.__anima?.scene.getReviewQaSnapshot().story && !!window.__anima?.scene.getReviewQaSnapshot().dialogue | Fixed: readiness waits for controller instead of transient line | tmp/overnight/reports/swarm-initial/session-002.json |
| initial-3 | 3b | curious | runner error: Error: Timed out: !!window.__anima?.scene.getReviewQaSnapshot().story && !!window.__anima?.scene.getReviewQaSnapshot().dialogue | Fixed: readiness waits for controller instead of transient line | tmp/overnight/reports/swarm-initial/session-003.json |


Full option counts: [swarm.md](swarm.md).

## Commits

- `da732a4` — Play later acts through shared dialogue.
- `b999e18` — Add recorded act players and deterministic swarm.
- `d2a884a` — Cover reef branches and preserve cutscene progress.
- `5fffe78` — Stabilize swarm startup and mark act completion.
- `dadd5fd` — Numeric frame ordering for long lens captures; shared resume support is in concurrent commit `7ede357`.
- `e360665` — Preserve recorded choice menus, reject truncated playthroughs, clear stale lens frames, test condition precedence.
- `bd2dd6d` — Carry story choices into the next act, with unit and live UI tests.

No push, deploy, branch switch, server restart, paid generation, or new listening port.
