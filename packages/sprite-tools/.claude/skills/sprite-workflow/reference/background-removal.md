# Background Removal Reference

## Methods Comparison

| Method | Speed | Quality | Best For |
|--------|-------|---------|----------|
| **Chroma Key** | Instant | ✅ Best | AI videos with solid bg |
| rembg | ~1 fps | Good | Variable backgrounds |
| BiRefNet | ~0.5 fps | Good | Complex scenes |

## Recommendation

**Use Chroma Key for AI-generated videos** - instant, preserves all details, no ML artifacts.

AI video generators (Veo, Kling, etc.) produce consistent solid backgrounds. Chroma key is:
- Instant (no ML inference)
- Preserves face/clothing perfectly
- No edge cutting or fringing

Only use ML-based removal (rembg) when background is complex or variable.

---

## Chroma Key (Preferred)

### When to Use
- Video has solid grey/green/blue background
- Character has dark clothing (ML models struggle with black shirts)
- Need perfect edge preservation

### Code

```python
from PIL import Image
import numpy as np

img = Image.open("frame.png")
rgb = np.array(img)
r, g, b = rgb[:,:,0], rgb[:,:,1], rgb[:,:,2]

# Sample background color from corner or known bg area
BG_COLOR = (130, 130, 130)  # Grey background

# Distance from background color
grey_dist = np.sqrt((r.astype(float) - BG_COLOR[0])**2 +
                    (g.astype(float) - BG_COLOR[1])**2 +
                    (b.astype(float) - BG_COLOR[2])**2)

# Black letterbox bars
black_dist = np.sqrt(r.astype(float)**2 + g.astype(float)**2 + b.astype(float)**2)

# Brightness (protects dark clothing)
brightness = (r.astype(float) + g.astype(float) + b.astype(float)) / 3

# Remove if: close to grey AND bright enough (not dark clothing)
# Threshold 15 is tight - avoids eating into clothing with grey highlights
is_grey_bg = (grey_dist < 15) & (brightness > 100)
is_black_bar = black_dist < 10
is_background = is_grey_bg | is_black_bar

alpha = (~is_background).astype(np.uint8) * 255
result = Image.fromarray(np.dstack([rgb, alpha]))
result.save("output.png")
```

### Key Parameters
- `grey_dist < 15` - Tight threshold prevents eating clothing
- `brightness > 100` - Protects dark pixels (black shirts)
- `black_dist < 10` - Removes letterbox bars

### Pro Tip: Eliminate Shadows at Generation
When prompting video generation, request **no shadows**:
```
"character walking, plain grey background, no shadows, no ground shadow"
```
This avoids the shadow blob under feet that complicates cropping.

---

## rembg (Fallback)

For variable/complex backgrounds where chroma key won't work.

### Installation

```bash
pip install rembg onnxruntime pillow
```

### Single Image (Python)

```python
from rembg import remove

with open("input.png", "rb") as f:
    input_data = f.read()

output_data = remove(input_data)

with open("output.png", "wb") as f:
    f.write(output_data)
```

### Batch Processing

```python
import os
import time
from rembg import remove

input_dir = "frames"
output_dir = "sprites"
os.makedirs(output_dir, exist_ok=True)

files = sorted([f for f in os.listdir(input_dir) if f.endswith('.png')])
print(f"Processing {len(files)} frames...")

for i, filename in enumerate(files):
    with open(f"{input_dir}/{filename}", "rb") as f:
        output = remove(f.read())
    with open(f"{output_dir}/{filename}", "wb") as f:
        f.write(output)

    if (i + 1) % 10 == 0:
        print(f"  {i+1}/{len(files)}")

print("Done!")
```

### Performance

- ~1 fps on M1/M2 Mac (CPU)
- ~96 frames in ~100 seconds
- Memory: ~500MB

## BiRefNet (Alternative)

For cases where rembg quality isn't sufficient.

### Installation

```bash
pip install torch torchvision transformers einops kornia timm
```

### Usage

```python
import torch
from PIL import Image
from transformers import AutoModelForImageSegmentation
from torchvision import transforms

# Load model (one-time, ~10s)
model = AutoModelForImageSegmentation.from_pretrained(
    "ZhengPeng7/BiRefNet",
    trust_remote_code=True
)
device = "mps" if torch.backends.mps.is_available() else "cpu"
model = model.to(device).eval()

# Transform
transform = transforms.Compose([
    transforms.Resize((1024, 1024)),
    transforms.ToTensor(),
    transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])
])

# Process image
image = Image.open("input.png").convert("RGB")
input_tensor = transform(image).unsqueeze(0).to(device)

with torch.no_grad():
    preds = model(input_tensor)[-1].sigmoid()

# Apply mask
mask = preds.squeeze().cpu()
mask_pil = transforms.ToPILImage()(mask)
mask_pil = mask_pil.resize(image.size, Image.LANCZOS)

image_rgba = image.convert("RGBA")
image_rgba.putalpha(mask_pil)
image_rgba.save("output.png")
```

## Cropping to Bounding Box

After removing background, crop to tight bounds:

```python
from PIL import Image

img = Image.open("sprite.png")
bbox = img.getbbox()  # Returns (left, top, right, bottom)
cropped = img.crop(bbox)
cropped.save("sprite-cropped.png")
```

## Replicate API (Fallback)

For complex images or when local processing fails:

```bash
# lucataco/remove-bg on Replicate
# Cost: ~$0.01/image
# Better at preserving extended limbs
```

Use after SeedEdit cleanup for complex backgrounds.
