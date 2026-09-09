# fal.ai Sprite Pipeline

This repo now uses fal.ai for the current sprite-video path.

## Environment

`FAL_KEY` is loaded from the repo `.env`. The key was copied from the sibling
`../carvingen` environment and is intentionally not recorded here.

## Model Mapping

| Task | fal.ai endpoint | Local command |
| --- | --- | --- |
| Image reference to walk video | `fal-ai/veo3.1/fast/image-to-video` | `npx tsx scripts/video-generate.ts ...` or `npx tsx scripts/fal-video.ts generate ...` |
| Multi-reference video generation | `fal-ai/veo3.1/reference-to-video` | `npx tsx scripts/fal-video.ts generate --mode reference ...` |
| Transparent video background removal | `bria/video/background-removal` | `npx tsx scripts/fal-video.ts remove-bg --background Transparent --codec webm_vp9 ...` |
| Loop detection | local `tools/loopycut/cli.py` | `uv run scripts/sprite-factory.py process-alpha --detect-loop ...` |
| Transparent video to Phaser sheet | local `sprite-factory.py` | `uv run scripts/sprite-factory.py process-alpha --detect-loop ...` |

## Working Path

```bash
npx tsx scripts/video-generate.ts \
  --model veo \
  --image sources/innsmouth/hermes-neutral-source-approved.png \
  --prompt "Hermes performs a smooth readable walk cycle..." \
  --aspect 9:16 \
  --duration 4 \
  --resolution 720p \
  --output output/fal/hermes-veo-walk/raw.mp4

npx tsx scripts/fal-video.ts remove-bg \
  --video output/fal/hermes-veo-walk/raw.mp4 \
  --output output/fal/hermes-veo-walk/alpha.webm \
  --background Transparent \
  --codec webm_vp9

uv run scripts/sprite-factory.py process-alpha \
  --video output/fal/hermes-veo-walk/alpha.webm \
  --output ../../adventures/shadow-over-innsmouth/public/assets/sprites/hermes/hermes-fal-veo-transparent-loop \
  --fps 24 \
  --cols 8 \
  --detect-loop \
  --preview-loops 3
```

Repeat with `sources/innsmouth/kat-neutral-source-candidate.png` and the Kat
output paths.

## Alpha Decode Note

BRIA transparent WebM is valid when the stream has `alpha_mode=1`, but ffmpeg's
native VP9 decoder can flatten the alpha. `process-alpha` forces
`-c:v libvpx-vp9` for `.webm` inputs before extracting RGBA PNGs.

BRIA ProRes MOV was tested with `--codec mov_proresks`; it decoded here as
`yuv444p12le` with no usable alpha. Do not use the MOV path for this pipeline.

`--background Magenta --codec mp4_h264` remains only a visual/debug fallback.
It should not be the production extraction path because it can contaminate
edges and requires a second keying pass.

## Delivered Examples

| Character | Source | Sheet | Frame size | Frames |
| --- | --- | --- | --- | --- |
| Hermes | fresh fal Veo + BRIA transparent WebM + LoopyCut | `adventures/shadow-over-innsmouth/public/assets/sprites/hermes/hermes-fal-veo-transparent-loop.png` | 612x1059 | 30 |
| Kat | fresh fal Veo + BRIA transparent WebM + LoopyCut | `adventures/shadow-over-innsmouth/public/assets/sprites/kat/kat-fal-veo-transparent-loop.png` | 515x994 | 31 |
| Hermes | existing raw + BRIA transparent WebM | `adventures/shadow-over-innsmouth/public/assets/sprites/hermes/hermes-bria-transparent-walk.png` | 926x1598 | 96 |
| Kat | existing raw + BRIA transparent WebM | `adventures/shadow-over-innsmouth/public/assets/sprites/kat/kat-bria-transparent-walk.png` | 819x1485 | 96 |

Orientation samples are in `tmp/orientation-samples/fal/`.

Three-loop MP4 previews are written next to the sheets:

- `adventures/shadow-over-innsmouth/public/assets/sprites/hermes/hermes-fal-veo-transparent-loop-preview-3x.mp4`
- `adventures/shadow-over-innsmouth/public/assets/sprites/kat/kat-fal-veo-transparent-loop-preview-3x.mp4`

## Verification

Check final sheets with:

```bash
magick identify -format '%f alpha-min=%[fx:minima.a] alpha-max=%[fx:maxima.a]\n' \
  adventures/shadow-over-innsmouth/public/assets/sprites/hermes/*transparent-walk.png \
  adventures/shadow-over-innsmouth/public/assets/sprites/kat/*transparent-walk.png
```
