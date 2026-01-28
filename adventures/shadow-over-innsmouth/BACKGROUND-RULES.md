# Background Generation Rules — Shadow over Innsmouth

*Lessons learned from pipeline testing. This is the contract for generating playable game backgrounds.*

---

## Core Principle

**We're making a 2D point-and-click adventure game, not an art book.**

Every background must be:
- Playable (sprites can walk across it naturally)
- Compositable (layers work with engine)
- Consistent (matches established art style)

---

## Perspective & Composition

### DO:
- **Flat or slight 3/4 view** — like classic LucasArts (Monkey Island, Day of the Tentacle)
- **Clear horizontal ground plane** — characters walk left-to-right
- **Side-view dominant** — minimal depth perspective
- **Hotspots at accessible positions** — interactive elements clearly visible and reachable

### DON'T:
- Deep perspective with vanishing points
- Dramatic camera angles
- "Illustration" compositions that look pretty but aren't playable
- Characters that would need to walk "into" the screen

### Reference:
```
GOOD: ══════════════════════════════
      │  bg elements  │  mid  │ fg │
      │_______________│_______│____|
      ════════ ground plane ════════
      
BAD:  Perspective depth, 3D feel
          ╲         ╱
           ╲   ▓   ╱
            ╲_____╱  ← vanishing point
```

---

## Canvas & Resolution

- **Target:** 2752 × 1536 (16:9 cinematic)
- **Internal game canvas:** ~700 × 450 (scaled)
- **Hotspot coordinates** are relative to internal canvas, not full resolution

---

## Style Requirements

Per ART-STYLE.md, but with gameplay constraints:

### Visual Style:
- Painterly gouache feel with visible brushwork
- Clean cartoon lines, hand-drawn quality
- Saturated colors (NOT washed out)
- Gravity Falls × Edward Gorey influence

### Playability Constraints:
- **Flat color areas** where characters will walk
- **No busy textures** on ground plane (makes sprites hard to read)
- **Clear silhouettes** for all interactive elements
- **Consistent lighting** that won't clash with character sprites

---

## Location-Specific Palettes

### Arkham (Normal World):
- Warm amber/honey tones
- Clean, well-maintained
- Morning light
- Normal humans, no "Look"

### Innsmouth:
- Sickly greens, teals, decay
- Water damage, peeling paint
- Fog, haze, atmospheric
- Fish motifs everywhere

The **contrast** between these sells the horror. Arkham = safe. Innsmouth = wrong.

---

## Character Integration

### Option A: Characters in Background (for establishing shots / trailers)
- Feed character sheets as image reference to Nano Banana
- Characters must match established designs EXACTLY:
  - **Hermes:** Brown messy hair, round glasses, tweed jacket, green sweater, leather satchel
  - **Kat:** Black messy hair with pencil clip, olive jacket, "ANDI" tee, ripped jeans, combat boots, patched backpack, headphones

### Option B: Character-Free Backgrounds (for gameplay)
- Generate backgrounds WITHOUT characters
- Characters composited by engine from sprite sheets
- This is the preferred approach for playable scenes

---

## Layer Architecture

For engine compositing:

| Depth | Content | Notes |
|-------|---------|-------|
| 0-9 | Far background | Walls, sky, distant elements |
| 10-49 | Mid elements | Furniture, objects at character level |
| 50 | Characters | Sprites, engine-controlled |
| 100+ | Foreground | Elements characters walk BEHIND |

### Example — Bus Depot:
```
Depth 0:   Back wall, windows, vending machine
Depth 10:  Schedule board, bench
Depth 50:  Hermes, Kat, Clerk (sprites)
Depth 100: Ticket booth front panel
```

---

## Generation Workflow

1. **Full scene with characters** — Composition proof, validates layout
2. **Background without characters** — For engine use
3. **Foreground elements** — Separate PNGs with transparency
4. **Validate hotspots** — Check interactive areas match positions

---

## Hotspot Placement

When generating, prompt should include hotspot positions:

```
COMPOSITION (matching hotspot coordinates):
- [50, 300]: Vending machine (far left)
- [120, 200]: Ticket window (left-center)
- [300, 100]: Schedule board (upper-center)
- [400, 300]: Bench (center-right)
- [600, 250]: Exit (far right)
```

The generated image MUST have these elements at approximately these positions.

---

## What to Avoid

- ❌ Deep 3D perspective
- ❌ Dramatic/cinematic angles
- ❌ Overly rendered/painterly (more illustration than game)
- ❌ Busy ground textures
- ❌ Characters not matching reference sheets
- ❌ Improvised character designs
- ❌ Decorative borders or frames
- ❌ Generic AI "smoothness"

---

## Quality Checklist

Before approving a background:

- [ ] Perspective is flat/side-view (playable)
- [ ] Ground plane is clear (sprites can walk)
- [ ] Hotspots are at correct positions
- [ ] Style matches ART-STYLE.md
- [ ] No characters OR characters match sheets exactly
- [ ] Layers can be separated if needed
- [ ] Edge-to-edge (no borders)

---

---

## Prompt Template

```
SCENE: [Name from StoryScript]
STYLE: 2D point-and-click adventure game background
- Flat side-view perspective
- Painterly but FLAT (not 3D rendered)
- Clear ground plane for character movement
- LucasArts / Gravity Falls reference

LOCATION TYPE: [Arkham = warm/clean | Innsmouth = sickly/decayed]

COMPOSITION (left to right):
[List hotspots with rough positions]

CHARACTERS (from reference sheets):
- Feed character sheets as image reference
- Hermes: art/characters/2026-01-18-hermes-character-sheet.png
- Kat: art/characters/2026-01-18-kat-character-design.png

STAGING:
- Arkham: Kat is OUTSIDE (glimpsed through windows/doors)
- Innsmouth: Characters can share space

OUTPUT: 2752×1536, edge-to-edge, no borders
```

---

*This document should be read by any agent generating backgrounds for this adventure.*
