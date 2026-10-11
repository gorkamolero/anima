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

## Runtime and verification

`CharacterMotor` selects the existing cycles from ground-plane velocity, with
0.35 m path look-ahead and hysteresis (vertical entry ratio 1.15, exit 0.75).
Positive ground depth selects away, negative depth selects toward; lateral motion
uses the profile sheet, flipped for right. Away idle holds frame zero. Motion is
1 m/s in camera-calibrated ground metres and playback cadence follows ground
speed. Scale is evaluated at the current position every frame, with bounded
scale factors. Anchor and generated clicks share footprint-aware navigation.

Current real-time verification recordings and 6 fps contact sheets are in
`tmp/walkarea/`. Walks are driven by `window.__anima.click`, with per-frame
`window.__anima.snapshot()` ground telemetry. See `docs/OPEN-WORLD.md` for camera
calibration and navigation details. No AI image or video generation was used for
the walking-model migration; these source sheets are unchanged.
