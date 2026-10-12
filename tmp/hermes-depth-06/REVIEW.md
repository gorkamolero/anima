# Brief 06 source and contact review

Paid generation: two silent Kling v3 standard 5-second clips from the existing cycle keyframes; one BRIA removal (toward). No image edits, no Veo. Away upload was refused before BRIA submission; `key-away.py` uses the local sprite-factory gray keyer. Request IDs and settings are in the adjacent manifests and `tmp/walkqa/calls.md`.

Reviewed all frames of away-feet.png and toward-feet.png, plus the normalized full-body loop sheets and source-video sheets. Toward's initial heel seed was replaced with a toe seed to avoid an ankle registration jump. Away's larger inter-pose jumps use searchRadius 64; the default for other cycles remains 24. Both planted-contact tracks follow the boots. The source away drawing has coarser pose increments than toward.

Away interval [88,118), supports L5 and R20; toward [87,112), supports L5 and R18. Seeds and scripts remain here. Final cycle FPS: away 25, toward 25.5; side 33, away diagonal 25, toward diagonal 26.5. Registration is not evidence of speed or arrival acceptance: see the final report and reviewer tool outputs.

Temporary raw, normalized and keyed per-frame directories were removed after the sheets, sprite assets, source videos, extraction metadata and proof were retained.
