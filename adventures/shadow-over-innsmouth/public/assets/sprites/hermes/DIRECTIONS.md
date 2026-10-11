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

`walkHeading` looks 100 screen pixels ahead along the remaining polyline.
Vertical entry requires |dy| / |dx| >1.15; vertical exit is below 0.75. The last
20 pixels retain the previous heading. Left/right reuse the existing profile
sheet, flipped for right. Away idle holds frame zero; front/side idle use the
existing idle as requested. Generated and anchor walks share the same path
updater. Anchor clicks now retain their requested Y inside the authored band;
scale is extended from the authored groundline's existing Y/scale relationship.

Playback rate is actual path distance per second divided by current scale and
source stride speed (600 pixels/second profile, 240 depth). Depth movement is
40% of profile speed to match its shorter projected stride. Perspective still
reduces travel speed and size into depth. Dedicated 3/4 cycles are not included.

Silent real-time agent-browser recordings at 1920 × 1080, 30 fps, and 6 fps
contact sheets live in `tmp/hermes-directions/`: `road-away-and-back`,
`road-diagonals`, `alley`, `depot`, and joined `all`. An additional `inside` take
checks the interior anchor. These are recordings of live movement, without
virtual-clock stepping or screenshot crossfades. The test browser suppresses
world/session writes, interactable loading and narration; place/background
reads use the real API. No persistent world or cache changes are needed.

Review: back/front views on depth legs, profile on crossings, smooth depth size
changes and sustained headings without rapid alternation. Magenta loop reviews
show intact limbs and no obvious seam pop or background halo. Foot planting was
reviewed visually at game size; this is sprite cadence matching, not skeletal
foot locking. Grid paths still have their original right-angle routing.
