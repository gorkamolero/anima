# Image & Pose Generation Reference

## The Problem

API models (FLUX, Ideogram, Stable Diffusion) **change character style** when generating new poses. They generate generic faces instead of preserving the exact character.

## The Solution: ChatGPT "Describe First" Technique

By having ChatGPT analyze and describe the character first, it anchors the visual details in context before generating new poses.

## Step-by-Step Process

### 1. Start Fresh Chat
- Use ChatGPT Developer mode (no memory contamination)
- Fresh chat for each session

### 2. Upload Reference Image
Ask:
```
Describe this character in detail.
```

### 3. Wait for Full Description
ChatGPT will analyze:
- Face and expression (eyes, smile, features)
- Hair style and color
- Body type and proportions
- Clothing details
- Art style (painterly, cartoon, etc.)
- Overall impression/personality

### 4. Request New Pose
```
Generate this exact character standing in a relaxed idle pose.
Arms loosely at her sides, weight slightly on one leg.
Keep everything identical - same face, same proportions,
same art style, same clothing, same colors.
Plain gray background.
```

## Why This Works

- Forces the model to **internalize specific features** before generating
- Creates a **stronger style anchor** than direct pose requests
- The description acts as an **implicit prompt** for the generation
- Reduces the model's tendency to "genericize" the character

## Prompt Tips

### Be Specific About Preservation
```
"same face, same proportions, same art style"
```

### Keep Pose Requests Minimal
```
"standing idle"  # Good
"standing with left arm raised at 45 degrees, right leg forward..."  # Too complex
```

### Use Plain Backgrounds
- Gray works best
- Makes background removal easier
- Avoid complex scenes

### Common Poses for Sprites

**Idle/Standing:**
```
Standing in a relaxed idle pose, arms loosely at sides,
weight slightly on one leg, facing [left/right/forward]
```

**Walking:**
```
Mid-stride walking pose, one leg forward, arms swinging naturally,
facing [left/right], dynamic pose showing movement
```

**Running:**
```
Running pose, one foot off ground, arms pumping,
dynamic action pose, facing [left/right]
```

## Guardrails

Always work with **clothed characters** for pose generation:
1. Create clothed version first
2. Generate poses freely
3. Avoids content moderation triggers

## Alternative: API Models

For cases where ChatGPT isn't available:

### FLUX Kontext (Image Editing)
```python
# Replicate: black-forest-labs/flux-kontext-dev
# Best for style changes on existing images
```

### FLUX Redux (Style Variations)
```python
# Replicate: black-forest-labs/flux-redux-dev
# No prompt, just generates variations
```

### Limitations
- Less character preservation than ChatGPT
- May need multiple attempts
- Better for style transfer than pose changes

## File Organization

```
sources/
├── raw/              # Original references from AI generation
├── valid/            # Approved, ready-to-use images
│   ├── character-standing.png
│   ├── character-walking.png
│   └── character-idle.png
└── wip/              # Work in progress, needs cleanup
```
