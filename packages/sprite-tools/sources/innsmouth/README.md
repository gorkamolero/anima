# Innsmouth Character Sprite Sources

Approved source poses for sprite video generation.

## Hermes Neutral Source

File: `hermes-neutral-source-approved.png`

Status: approved orientation sample.

Use this as the Hermes source for walk/idle/talk animation generation. This
replaces the earlier anxious/sweaty crop from `@hermes.jpeg`, which is only a
character-sheet reference and not a valid sprite-generation pose.

Generation prompt:

```text
Use case: illustration-story
Asset type: character sprite source pose for a point-and-click adventure game.
Primary request: Generate Hermes as a clean full-body neutral sprite reference, standing upright in a relaxed readable pose. This is a source image for animation generation, not final scene art.
Character identity: Hermes, 22-year-old nerdy curious young man, tousled brown hair, round glasses, gentle intelligent face, brown tweed suit jacket, white shirt, dark green sweater vest, brown trousers, brown shoes, leather satchel strap across body with satchel at side.
Pose: full body visible head to shoes, upright neutral stance, weight slightly on one leg, arms relaxed and natural at sides or one hand lightly near satchel strap. No book, no sweat, no scared expression, no crouch, no exaggerated panic, no dramatic running pose.
Expression: calm, curious, mildly apprehensive but composed.
Background: perfectly flat solid #828282 gray background for chroma key extraction. No shadows, no ground shadow, no floor plane, no props, no scene, no text, no labels, no watermark.
Style: same clean 2D adventure-game character sheet style as the provided Hermes reference: expressive ink outlines, hand-painted cartoon shading, 1930s mystery adventure feel, not photorealistic.
Composition: portrait 9:16, centered, generous padding around character, feet fully visible and near bottom but not cropped.
```

## Kat Neutral Source

File: `kat-neutral-source-candidate.png`

Status: candidate orientation sample.

Use this as Kat's source candidate for walk/idle/talk animation generation after
visual approval. It keeps Kat as the girl character, separate from Hermes, and
is not a final transparent sprite on its own. Final game sprites are generated
by video synthesis plus chroma-key extraction.

Generation prompt:

```text
Use case: illustration-story
Asset type: character sprite source pose for a point-and-click adventure game.
Primary request: Generate Kat as a clean full-body neutral sprite reference, standing upright in a relaxed readable pose. This is a source image for animation generation, not final scene art.
Character identity: Kat, teenage/young adult girl with short messy black hair, pale skin, tired skeptical eyes, black leather jacket, dark band T-shirt, ripped blue jeans, black combat boots, olive backpack with punk patches. Keep the same visual identity as the provided Kat character reference.
Pose: full body visible head to boots, upright neutral stance, weight slightly on one leg, arms relaxed and natural. She may have one hand near a backpack strap, but do not cross her arms. No scene interaction, no crouch, no running, no dramatic action pose.
Expression: guarded, skeptical, composed; not frightened, not smiling broadly, not exaggerated.
Background: perfectly flat solid #828282 gray background for chroma key extraction. No shadows, no ground shadow, no floor plane, no props, no scene, no text, no labels, no watermark.
Style: same clean 2D adventure-game character sheet style as the Kat reference: expressive ink outlines, hand-painted cartoon shading, 1930s mystery adventure game feel, not photorealistic.
Composition: portrait 9:16, centered, generous padding around character, boots fully visible and near bottom but not cropped.
```

## Scene Staging Notes

- `bus_station` uses the composed full-screen depot interior background,
  `adventures/shadow-over-innsmouth/public/backgrounds/arkham-bus-depot-full-scene-v2.png`.
  That image already places Kat seated on the waiting bench, matching the
  `bench` hotspot text in `story/full_game.story`.
- Do not overlay the extracted Hermes/Kat walk-cycle sprites in `bus_station`.
  The runtime hides them for that scene so the scripted seated Kat staging
  remains visible.
- The extracted walk sprites are still valid reusable animation assets for
  scenes where the character should be freestanding rather than baked into the
  background composition.
