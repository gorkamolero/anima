# Hermes directional walking

The away and toward keyframes were edited with `fal-ai/nano-banana-2/edit`, using
`docs/art/@hermes.jpeg` and frame zero of the existing side walk and normalized
idle. Each received one silent 4-second Veo 3.1 fast image-to-video generation and
one BRIA video background removal. Prompts, request IDs, parameters and extraction
commands are in the adjacent manifests. Total: two image edits, two Veo calls,
two BRIA calls. No diagonal generations.

Both sheets use 612 × 1059 frames, eight columns, 24 fps and bottom-center origin.
Away: 33 frames, original video frames [35, 68). Toward: 31 frames, [56, 87).
The local LoopyCut checkout was empty; these intervals were selected by a local
frame-similarity search across 20–48 frame windows, excluding the startup second.
No crossfade or interpolated frames were added.

`normalization` in each manifest records the measured transform. Alpha >127 is
used to exclude faint fringes when measuring. The side walk's median visible
height is 1030.5 pixels (range 1013–1047); the existing idle's is 1055 pixels.
The new loops match the walking median to rounding accuracy, retaining natural
bob and foot motion. A single constant resize and global center/bottom offset
is applied across each loop. Never align each individual frame's feet: doing so
removes the foot travel required for walking. `normalize-sheet.py` implements
this operation after `sprite-factory.py process-alpha` and rebuilds the silent
three-loop magenta preview. The inherited idle is about 2.4% taller than walking.

## Brief 05: diagonal cycles

Two diagonal keyframes use `fal-ai/nano-banana-2/edit` and the same three references
listed above. The first toward-right edit faced left and was rejected; its corrected
edit faces right. Total new calls: **3 edits, 2 Kling videos, 2 BRIA removals**.
No new Veo calls. Full ledger: `tmp/walkqa/calls.md`.

Both silent videos use `fal-ai/kling-video/v3/standard/image-to-video`, duration
`5`, `generate_audio: false`, with prompts for camera-tracked walking in place,
constant size, no drift, fixed three-quarter orientation, full body, flat gray.
Model schema: https://fal.ai/models/fal-ai/kling-video/v3/standard/image-to-video/api
The 6 fps full-video sheets were visually reviewed before BRIA removal.

| Cycle | Source interval at 24 fps | Frames | New keyframe | Mirroring |
|---|---|---:|---|---|
| hermes-walk-away-right | [28,76) | 48 | hermes-away-right-keyframe.png | flipX gives away-left |
| hermes-walk-toward-right | [60,85) | 25 | hermes-toward-right-keyframe.png | flipX gives toward-left |

Adjacent manifests retain request IDs, exact prompts, parameters, references,
loop candidates, measured height ranges, and the constant normalization transform.
Both sheets have 612 x 1059 frames, eight columns, 24 fps. Their median visible
height matches the side walk's 1030.5 px to rounding accuracy. Each has a silent
`-preview-3x.mp4` magenta preview. No per-frame recentering, crossfade, interpolation,
or speed multiplier is applied to the drawing.

Extraction was run with `tmp/hermes-diagonals/prepare.py` (BRIA alpha frames and
local seam search), then `tmp/hermes-diagonals/normalize.py` (constant scale and
packing). These reuse `sprite-factory.py` extraction/packing/preview functions.
The selected away interval contains two gait cycles; toward contains one.

## Contact metadata and runtime

`root-motion.py` retains its historical filename but now writes `contacts`, with
physical `L`/`R` sole points and the planted foot per frame, plus `switchFrames`.
Reviewed `contactSeeds` are embedded in every JSON, making regeneration reproducible:

```
tmp/walkqa/tools/venv/bin/python packages/sprite-tools/scripts/root-motion.py <sheet.json> --debug tmp/walkqa/contacts-05
```

Registration follows a boot-centred patch, predicting from its last displacement.
The support point is chained throughout the stance, rather than re-selected in an
image half on every frame. Swing checkpoints help retain foot identity. Debug
sheets show both contacts and each handoff. **Tracking is still under pixel QA;
these assets and metadata are not a claim of acceptance.**

The motor owns the animation clock and sprite frame. At handoff it captures the
incoming sole's screen position. Each frame then solves body position and scale
from that anchor. Perspective is evaluated at the body's ground point and applied
about the contact. There is no independent walking speed or visual-root offset.
Cycle choice uses eight ground sectors relative to the local camera view ray,
with five degrees of hysteresis. Changes happen at handoff with the same physical
support foot. Anchor correction totals at most one pixel per stance. Navigation
starts with a string-pulled path and rounds corners only inside the floor mask.
Arrival holds a switch pose within half a measured stance displacement, without
snapping to the requested point. The town replay now checks that rule rather than
requiring the old two-pixel exact endpoint.

## Verification status

See `tmp/walkqa/reports/05-foot-lock.md`. The complete 63-clip matrix is **not
accepted: 62 pixel failures and one no-stance clip**. All reported worst stances
were inspected. Exact runtime anchors do not correct inaccurate physical-foot
tracks or boot deformation. Swing points still lose identity through crossings;
the stance trajectories can leave the floor mask. Road diagonal walking time is
5.292 seconds, but toward-right still takes 10.333 seconds. These assets and the
motor require further work before acceptance.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>

## Brief 06: longer depth strides and closed-loop routing

Two 5-second Kling v3 Standard silent videos reuse the existing away/toward keyframes, with walking-in-place long confident stride prompts. No image edits or Veo. Toward uses BRIA; away uses the existing sprite-factory gray-background keyer after fal.ai rejected the BRIA upload for exhausted balance. Total: 2 Kling, 1 BRIA, 0 edits. Manifests contain exact prompts, request IDs, constant normalization and extraction settings.

Away interval [88,118): 30 frames, support switches 5/20. Toward interval [87,112): 25 frames, support switches 5/18. Contact sheets were inspected frame by frame. The new toward toe seed avoids the rotating landing heel; the away tracking search radius is 64 px because its source advances in larger pose increments. Other cycles retain the default registration radius. No per-frame recentering or root translation was added.

Playback metadata: side 33 fps (2.2 steps/s), away 25 (1.667), toward 24 (1.92), away diagonal 25 (2.083), toward diagonal 26.5 (2.12). These are nominal cycle cadences; measured proof cadence and ground-speed distributions are reported separately.

The motor replans at each support handoff, tests every candidate stance body trajectory against the eroded mask and each planted contact against the raw mask, and stops on the held foot when no safe progress step exists. Startup may enter a safe partial stance. The anchor has zero continuous translation, within the maximum one-pixel allowance.

Brief 05 footcheck verdicts above are superseded by the independent reviewer: planted feet passed lockcheck and stancecam. Brief 06 acceptance remains pending in tmp/walkqa/reports/06-steering-speed.md.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
