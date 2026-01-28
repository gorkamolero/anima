# SCENE-EVAL.md — Shadow Over Innsmouth

Evaluation criteria for scene composition and staging. Each criterion becomes a check in the automated pipeline.

## Atmosphere

- **Oppression**: Characters should feel dwarfed by architecture. Scale humans at 15-25% of frame height max. Buildings loom.
- **Decay**: Every surface tells a story of neglect. Peeling, sagging, waterlogged. Nothing is clean.
- **Wrongness**: Something should be subtly off — an angle that doesn't quite make sense, a shadow that falls wrong, proportions that feel dreamlike.

## Composition

- **Eye flow**: Lead the eye to the narrative anchor first (the door they'll enter, the figure watching them, the object they'll examine). Secondary elements support, don't compete.
- **Negative space**: Use emptiness as dread. Innsmouth is underpopulated. Silence has weight.
- **Depth layering**: Foreground (immediate decay/obstruction) → Midground (action zone) → Background (the town's mass, the sea, the sky). Each layer distinct.

## Character Staging

- **Off-center**: Protagonist rarely centered. They're intruders in this space.
- **Ground line respect**: Feet meet floor believably. No floating.
- **Scale consistency**: A character at the back of the scene is smaller than one at the front. Perspective is law.
- **Belonging test**: Does this character's palette and rendering style match the scene, or do they look pasted in?

## Color

- **Palette constraint**: Muted. Greens of rot, grays of stone and fog, browns of old wood. Splashes of color are rare and meaningful (the gold of a forbidden artifact, the red of a wound).
- **Lighting coherence**: One dominant light source implied. Shadows agree on its direction.

## The Innsmouth Look

- **Locals**: Something wrong with their proportions. Wide mouths, bulging eyes, necks too thick or too thin. Not monsters — almost human. That's worse.
- **The sea's presence**: Even inland scenes should feel the ocean's influence. Humidity, salt-rot, the sound of gulls, distant fog.

---

## Evaluation Schema

Each check returns:
- `pass` / `fail` / `warn`
- `score` (1-5 where applicable)
- `reason` (why it failed, what to fix)

Pipeline rejects scenes with any `fail`. Warnings accumulate for human review.
