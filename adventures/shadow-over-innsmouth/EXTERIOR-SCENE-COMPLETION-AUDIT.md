# Exterior Scene Completion Audit

Objective: implement the generated Hermes exterior placement workflow for the
Shadow over Innsmouth standalone exterior scene.

## Success Criteria

- Use the accepted non-Hermes exterior scene with Kat baked in as the reference
  scene.
- Use the full Hermes reference to generate a scene placement reference.
- Derive the playable exterior Hermes scale, ground line, and TALK/door routes
  from that generated placement reference, not from tiny in-engine nudges.
- Keep Kat outside only; do not duplicate her inside.
- Verify the playable scene mechanically and regenerate visual screenshots.

## Prompt-To-Artifact Checklist

| Requirement | Evidence | Status |
| --- | --- | --- |
| Generate Hermes into the non-Hermes exterior/Kat scene. | `art/generated/hermes-exterior-kat-placement-reference-v1.png` was generated from `public/backgrounds/bus-station-kat-seated-composite-v1.png` plus `art/@hermes.jpeg`. | Pass |
| Use generated reference for calibration. | Exterior calibration manifest now has `baseScale: 0.5`; ground-line points are `(120,950,0.8)`, `(520,966,1.02)`, `(755,976,1.06)`, `(1040,966,1.1)`, `(1520,950,0.85)`, `(1800,942,0.78)`. | Pass |
| Update playable scene data. | `standaloneScenes.ts` exterior Hermes scale is `0.5`; waiting-bench TALK route is `{ x: 755, y: 976 }`; depot-door route exits through `{ x: 2140, y: 942 }`. | Pass |
| Regenerate rendered sizing evidence. | Browser-clicked evidence now includes `tmp/scene-line-outside-bench-talk-after-fix.png`, `tmp/scene-line-outside-walk-after-fix.png`, and `tmp/scene-line-door-transition-after-fix.png`. | Pass |
| TALK frame is based on visual adult-vs-seated sizing. | `tmp/visual-reference-audits/outside-kat-talk.png` compares the generated reference and runtime; Hermes is `561.27px` actual visible height against `560.77px` expected, at `x: 755`, `y: 976`, `scale: 0.53`. | Pass |
| Review scale frame-by-frame, not only at TALK. | `review:scene-scale` writes full-size per-frame images under `tmp/scene-scale-reviews/outside-route/review-frames/` plus `tmp/scene-scale-reviews/outside-route/outside-route.png`. `SCENE-SCALE-VISION-REVIEW.md` records the vision pass. | Pass |
| Prevent bad spans from being normal idle positions. | `standaloneScenes.ts` sets exterior free-walk ranges to `x:200..760` and `x:1280..1520`; `x:120` is clipping/reference-only, the Kat-overlap span is skipped, and door/bus interactions still use authored hotspot routes. | Pass |
| Door transition remains offscreen. | Verifier passes `Hermes exits fully off the right edge before transition` with `exitX: 2140`, `exitY: 942`, `hiddenBeforeTransition: true`. | Pass |
| Kat is not duplicated inside. | Interior Kat remains `visible: false`; verifier passes `Kat does not duplicate inside after being visible outside`; interior waiting bench exposes only `look`. | Pass |
| Workflow doc records the corrected method. | `SCENE-CHARACTER-ASSET-WORKFLOW.md` now documents the generated exterior placement reference, the frame-scale trap, and the final browser-click review artifacts. | Pass |
| Verification commands pass. | `verify:scene`, `typecheck`, and `build` pass after the visual-height calibration. | Pass |

## Current Runtime Evidence

- Exterior Hermes base scale: `0.5`.
- Exterior start scale: `0.4672`, position `x: 360`, `y: 959`.
- Exterior TALK scale: `0.53`, position `x: 755`, `y: 976`.
- Exterior free-walk ranges: `x: 200..760` and `x: 1280..1520`.
- Exterior bus USE scale: `0.3997`, position `x: 1660`, `y: 945`.
- Door transition: `exitX: 2140`, `exitY: 942`,
  `hiddenBeforeTransition: true`, `from: outside`, `to: inside`.
- Interior after transition: Kat `visible: false`, `seatedVisible: false`,
  `standingVisible: false`.

## Visual Artifacts

- Generated placement reference:
  `art/generated/hermes-exterior-kat-placement-reference-v1.png`
- Visual reference audit:
  `tmp/visual-reference-audits/outside-kat-talk.png`
- Scene-scale filmstrip:
  `tmp/scene-scale-reviews/outside-route/outside-route.png`
- Full-size scene-scale review frames:
  `tmp/scene-scale-reviews/outside-route/review-frames/`
- Final TALK-to-Kat screenshot:
  `tmp/scene-line-outside-bench-talk-after-fix.png`
- Final left-to-right sizing sheet:
  `tmp/exterior-sizing/exterior-sizing-contact-sheet.png`
- Final bus screenshot:
  `tmp/full-review/23-bus-rescaled.png`
- Final door/interior transition screenshot:
  `tmp/full-review/24-door-rescaled.png`

## Notes

- The previous `1.2` / `1.572` pass is superseded. It used raw sprite-frame
  scale and produced a visually giant Hermes.
- The engine fix matters: the ground line now reads current `getBaseScale()`,
  and Hermes world-bounds collision no longer pushes enlarged sprites off the
  authored foot line.
