# Exterior Scene Completion Prompt

Use this as the next goal prompt.

```text
You are in /Users/gorkolas/www/anima.

Your job is to finish the Shadow over Innsmouth standalone exterior scene to a
visually acceptable playable state. The previous "complete" claim was wrong:
the character sizing was not actually fixed. Do not repeat that mistake.

Current rejected state:
- Kat is seated outside in the accepted composite, but her apparent body scale
  makes her read as too large relative to Hermes in the playable screenshot.
- Hermes was scaled to 0.66, but the user rejected the result as still not
  visually fixed.
- Kat currently appears outside and then also appears inside after Hermes enters
  the station. That continuity is rejected. A character cannot be visibly seated
  outside and simultaneously seated inside unless the game explicitly moves her
  or changes scene state.
- Passing verifier/build/typecheck is not enough. The output must look correct
  in screenshots.
- The previous completion audit is invalid if it treats current scale as done.

Primary objective:
Make the exterior scene actually work visually and mechanically:
- Kat must remain the accepted baked seated Kat from the exterior composite.
- Hermes must be correctly sized relative to Kat, the bench, shelter posts, car,
  and station door.
- Hermes must move on authored point-and-click walk lines, not through Kat,
  bench, rope/net clutter, or impossible floor areas.
- TALK on the waiting bench must route Hermes to a believable approach point
  near Kat without overlapping her, her backpack, the bench, or the floor clutter.
- USE on the depot door must route Hermes to the right, fully offscreen, then
  transition inside.
- Interior continuity must be fixed: if Kat is baked into the exterior
  composite, do not also render/spawn her in the interior immediately after the
  station-door transition. Either keep her outside and hide/remove the interior
  Kat for that transition, or implement an explicit authored state transition
  that explains how/when she moves inside. Do not leave both visible by default.
- The workflow must document how to do this sizing/placement pass so the same
  mistake does not recur.

Non-negotiable visual standard:
Do not claim completion until rendered screenshots show the fix. The agent must
move Hermes left-to-right through the scene, take screenshots, compare them
critically, and adjust scale/ground-line/route points until the result is
visually coherent.

Important user corrections to preserve:
- Kat was already correct in the original image/composite. Do not replace her
  with a newly generated seated Kat.
- If a transparent Kat sprite is ever needed, extract it from the accepted
  composite, not a new generation.
- Do not use the old interior seated Kat as a convenience sprite when the
  current authored scene has Kat already visible outside. Continuity beats test
  convenience.
- This style does not need collision/navmesh as the first tool. It needs
  authored walk lines, approach points, and scale/depth curves.
- The character-size problem must be solved by visual calibration, not by
  asserting a number in JSON.

Known files:
- Scene code:
  - adventures/shadow-over-innsmouth/src/game/scenes/StoryGameScene.ts
  - adventures/shadow-over-innsmouth/src/game/scenes/standaloneScenes.ts
- Accepted exterior Kat composite:
  - adventures/shadow-over-innsmouth/art/generated/kat-outside-station-bench-composite-v1.png
- Runtime exterior composite:
  - adventures/shadow-over-innsmouth/public/backgrounds/bus-station-kat-seated-composite-v1.png
- Clean exterior without Kat:
  - adventures/shadow-over-innsmouth/public/backgrounds/bus-station-flat-v1.png
- Hermes sprite:
  - adventures/shadow-over-innsmouth/public/assets/sprites/hermes/hermes-fal-veo-transparent-loop.png
- Verifier:
  - adventures/shadow-over-innsmouth/scripts/verify-playable-scene.mjs
- Sizing review script:
  - adventures/shadow-over-innsmouth/scripts/review-exterior-sizing.mjs
- Workflow doc:
  - adventures/shadow-over-innsmouth/SCENE-CHARACTER-ASSET-WORKFLOW.md
- Calibration manifest:
  - adventures/shadow-over-innsmouth/placement-calibration/hermes-terminal-flat-exterior.json
- Current visual artifacts:
  - tmp/exterior-sizing/exterior-sizing-contact-sheet.png
  - tmp/exterior-sizing/exterior-sizing-report.md
  - tmp/scene-line-outside-after-fix.png
  - tmp/scene-line-outside-bench-talk-after-fix.png
  - tmp/scene-line-door-transition-after-fix.png

Mandatory process:
1. Inspect current rendered screenshots first. Do not rely on memory, code, or
   verifier output.
2. Create a sizing diagnosis artifact that compares at least three candidate
   Hermes scales/curves in the same scene:
   - current scale,
   - one smaller candidate,
   - one larger candidate or a different depth curve if needed.
   The artifact must show start/default, Kat approach, door approach, and
   right/offscreen route frames.
3. Measure visible proportions from rendered screenshots using Pillow,
   ImageMagick, ffmpeg/identify, or another concrete image-analysis tool. If
   Pillow is missing, install it in the repo/env or use an available equivalent.
   Do not skip measurement.
4. Compare Hermes against:
   - Kat seated head/torso/body height in the accepted composite,
   - bench seat/back height,
   - shelter post height,
   - station door height,
   - car height/nose if visible near the door route.
5. Use visual judgment plus measurements to choose a new exterior `baseScale`
   and any `scaleFactor` changes. The result must not make Hermes look tiny
   next to Kat or huge against the station/car.
6. Adjust exterior route points if the screenshots show Hermes walking through
   Kat, her backpack, bench legs, rope/net pile, or impossible floor clutter.
   Prefer authored route points and depth-line edits over collision systems.
7. Fix interior continuity. After exterior door USE, inspect the inside
   screenshot and state snapshot. Kat must not be visible inside unless a real
   story/state transition says she moved from outside to inside. The verifier
   must assert the chosen continuity rule.
8. Re-run the exterior sizing review script after each real scale/route change.
9. Re-run the playable-scene verifier and inspect the regenerated screenshots.
10. Update `SCENE-CHARACTER-ASSET-WORKFLOW.md` with the final sizing and
   continuity calibration rule if the fixed process deviates from the previous
   documented norm.
11. Replace/update `EXTERIOR-SCENE-COMPLETION-AUDIT.md` so it states the current
    visual and continuity evidence honestly. Do not say done unless the
    screenshot evidence is actually visually acceptable.

Required verification commands before any completion claim:
- pnpm --filter @anima/shadow-over-innsmouth typecheck
- pnpm --filter @anima/shadow-over-innsmouth verify:scene http://localhost:8080/
- pnpm --filter @anima/shadow-over-innsmouth review:exterior-sizing http://localhost:8080/
- pnpm --filter @anima/shadow-over-innsmouth build

Completion gate:
Before claiming completion, provide or reference:
- the final TALK-to-Kat screenshot,
- the final left-to-right exterior sizing contact sheet,
- the final door transition screenshot,
- the final interior post-transition screenshot showing the selected continuity
  rule,
- the selected final scale/ground-line numbers,
- a short explanation of why the new sizing is better than the rejected current
  state,
- the passing verification commands.

If the screenshot still looks wrong, keep iterating. If the background itself
has irreconcilable perspective problems, say so plainly and propose an art fix
such as regenerating the scene composite or extracting/repositioning Kat from
the accepted composite. Do not paper over it with tests.
```
