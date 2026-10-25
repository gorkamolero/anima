# Track 3 — dialogue and Act 1

Entry: http://localhost:8080/?act=1&scene=inside&mute=1 (omit mute for voice).
The review panel also has a Play Act 1 link. Existing walking and open-world preview URLs remain available.

## Implemented

- Shared React dialogue panel for StoryScript and the existing narrator event payloads: speaker colours, one line at a time, numbered choices, free-text narrator action input, click/Space/Enter advancement. Story lines use cached POST /api/tts with readable fallback (60 ms/character, minimum 2.5 seconds); request timeout is ten seconds. No playtest TTS calls; successful audible playback was not auditioned.
- StoryScript choice/state execution: nested clerk choices award the ticket and set flags; Kat's bus conversation sets relationship/family flags; ticket and conversation gates precede boarding and arrival. Fixed NOT-flag evaluation and IF-contained jumps falling through.
- Act 1 scene bridge uses the actual act1.story, authored depot landmark regions and the existing generated Innsmouth scene. Kat is visible seated in the interior for this story route. The platform doorway leads outside; clicking the bus boards it.
- Dialogue stops the motor and faces the conversation target. It never assigns Hermes a position. Ground clicks resume movement after closing. Kat's existing seated talk animation follows her lines.
- The React panel is mirrored as text on the game canvas for __anima.record. DOM screenshots show the full styled panel.

## Scope and missing art

This delivery's playable route ends at arrival in Innsmouth, as Brief B requests. The rest of act1.story (hotel, room and overnight sequence) is not end-to-end verified.

- Bus interior background, seat layout and driver sprite are missing. The depot interior is an explicit placeholder, labelled `[bus interior pending]` in both dialogue panel and canvas. Its draft-coordinate hotspots have visible labels.
- The clerk speaks from the ticket window but has no separate visible clerk sprite.
- Innsmouth arrival reuses existing `place-d3fc732744430e25f7c1` (description: Innsmouth main street). It is a waterfront/depot-like town image, not bespoke bus-arrival art. No arrival/disembarking animation was generated.
- Street church, Gilman House sign/entrance and later hotel actions still need matching artwork/region review for a continuation beyond the requested arrival endpoint.

## Verification

- StoryScript: 4 tests pass, including the actual Act 1 route and repeat-Kat termination.
- Engine: 243 tests across 10 files pass.
- Presentation/voice: 4 tests pass (timed lines, choice wait, stale input, cancellation, muted/no-fetch and HTTP-failure reading fallback).
- Repository typecheck passes. Changed-file Biome check passes; StoryScript and engine package lint pass.
- Full repository lint is **not passing**: adventure sprite-metadata formatting diagnostics (the earlier Footfall errors were fixed by its owner; only a warning remains there) are outside this track's permitted edits. See act1-lint.log. No forbidden files were changed to mask those failures.
- Live script: `node adventures/shadow-over-innsmouth/scripts/playtest-act1.mjs`. Checks actual canvas hotspot clicks, the panel choices, muted auto-advance, fixed position while locked, resumed walking, inventory/flags, gated rest and arrival. Uses __anima.click, waitUntil, snapshot and record.

Live result: **PASS**, captured in `tmp/overnight/reports/act1-playtest.json` and `act1-playtest.log`.

Shareable full-scene clip: `tmp/recordings/act1-playthrough.mp4` (H.264, 1920×1080, 120.017 seconds, 9,553,896 bytes). Reopened and decoded the MP4 for frame inspection.

Continuous source clip: `tmp/recordings/act1-playthrough.webm` (120 seconds, 143,224,929 bytes; 7,113 telemetry samples). Telemetry: `tmp/recordings/act1-playthrough.json`. Screenshots: `tmp/overnight/reports/act1-{schedule,clerk,kat-bench,platform,bus,rest-gated,kat-choice,arrival}.png`. Inspected the styled choice panel, arrival image and decoded recording frames showing clerk dialogue and Hermes/Kat together.

The narrator compatibility check injected the existing options/resolved events without making model calls: three options and free text rendered under Narrator; visible voice ellipsis; Enter dismissed the caption. The additional `anima:narrator-finished` event closes the panel once the line's voice/reading fallback finishes, while preserving resolved events for existing consumers.

Lens processing: `node adventures/shadow-over-innsmouth/scripts/walk-lens.mjs act1-playthrough --every 240 --slow 1` (full-frame decode; real-time and 1x review clips; sampled strips). Lens completed successfully: 7,076 decoded video frames / 119.98 seconds. Outputs are `tmp/recordings/act1-playthrough/{realtime.mp4,slowmo.mp4,slowmo.gif,fixed-strip.png,stabilised-strip.png,report.txt,metrics.json}`. Inspected the fixed strip and source frames. The short resumed-walk segment reports no zero-motion render samples (0/58) and median planted-sole slide 0.98 px. This dialogue-heavy recording is not a replacement for Track 1's complete walking suite; its long drawing holds include intentional dialogue idle poses.

Final narrator completion event was also checked in the live React UI: a resolved caption displayed, then `anima:narrator-finished` removed it. Final adventure typecheck passes.

## Commits

- ae62faf — shared panel
- acdeb2d — timed dialogue queue and authored region adapter
- 456f03a — scene wiring
- 6e0533f — StoryScript guards and conditional returns
- be16106 — canvas dialogue mirror, UI readiness, bounded TTS request
- 85c82c7 — dialogue tests and recorded live journey
- ae75fec — allow asynchronous scene geometry during live test
- 866e1aa — audio-fallback tests

- d2942f1 — narrator advance controls
- bd032b6 — narrator completion after voice/reading fallback
