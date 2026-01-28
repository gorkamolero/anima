#!/usr/bin/env python3
"""
Sprite QC Viewer - Generate visual QC report without AI tokens.

Creates:
1. Face grid on magenta background (spots artifacts instantly)
2. Full frames on magenta for detailed review
3. HTML gallery for easy browsing

Usage:
  python qc_viewer.py <frames_dir> [--output <qc_dir>] [--face-region X Y W H]

Examples:
  python qc_viewer.py ./transparent --output ./qc
  python qc_viewer.py ./transparent --face-region 200 50 320 350
"""

import argparse
from pathlib import Path
from PIL import Image
import os

DEFAULT_FACE_REGION = (200, 50, 520, 400)  # x, y, x2, y2


def create_magenta_composite(img: Image.Image) -> Image.Image:
    """Composite image on magenta background."""
    if img.mode != 'RGBA':
        return img
    bg = Image.new('RGBA', img.size, (255, 0, 255, 255))
    bg.paste(img, mask=img.split()[3])
    return bg.convert('RGB')


def create_face_grid(frames_dir: Path, output_path: Path, face_region: tuple, thumb_size: int = 160):
    """Create grid of face crops on magenta for QC."""
    frames = sorted(frames_dir.glob("*.png"))
    if not frames:
        print("No frames found")
        return
    
    cols = min(10, len(frames))
    rows = (len(frames) + cols - 1) // cols
    
    grid = Image.new('RGB', (cols * thumb_size, rows * thumb_size), (255, 0, 255))
    
    for idx, f in enumerate(frames):
        img = Image.open(f)
        # Composite on magenta
        img_mag = create_magenta_composite(img)
        # Crop face region
        x1, y1, x2, y2 = face_region
        face = img_mag.crop((x1, y1, x2, y2))
        face = face.resize((thumb_size, thumb_size), Image.LANCZOS)
        
        col, row = idx % cols, idx // cols
        grid.paste(face, (col * thumb_size, row * thumb_size))
    
    grid.save(output_path)
    print(f"Face grid: {output_path}")


def create_full_frames_magenta(frames_dir: Path, output_dir: Path):
    """Create all frames on magenta for detailed review."""
    output_dir.mkdir(parents=True, exist_ok=True)
    frames = sorted(frames_dir.glob("*.png"))
    
    for f in frames:
        img = Image.open(f)
        img_mag = create_magenta_composite(img)
        img_mag.save(output_dir / f.name)
    
    print(f"Full frames on magenta: {output_dir}")


def create_html_gallery(frames_dir: Path, output_path: Path, title: str = "Sprite QC"):
    """Create HTML gallery for easy browsing."""
    frames = sorted(frames_dir.glob("*.png"))
    
    html = f"""<!DOCTYPE html>
<html>
<head>
    <title>{title}</title>
    <style>
        body {{ background: #1a1a1a; color: white; font-family: sans-serif; padding: 20px; }}
        h1 {{ color: #ff00ff; }}
        .gallery {{ display: flex; flex-wrap: wrap; gap: 10px; }}
        .frame {{ 
            border: 2px solid #333; 
            cursor: pointer;
            transition: border-color 0.2s;
        }}
        .frame:hover {{ border-color: #ff00ff; }}
        .frame img {{ display: block; height: 200px; width: auto; }}
        .frame-name {{ 
            background: #333; 
            padding: 5px; 
            text-align: center; 
            font-size: 12px; 
        }}
        .modal {{
            display: none;
            position: fixed;
            top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0,0,0,0.9);
            justify-content: center;
            align-items: center;
            z-index: 1000;
        }}
        .modal.active {{ display: flex; }}
        .modal img {{ max-height: 90vh; max-width: 90vw; }}
        .modal-close {{
            position: absolute;
            top: 20px; right: 30px;
            color: white;
            font-size: 40px;
            cursor: pointer;
        }}
        .nav {{ margin-bottom: 20px; }}
        .nav a {{ color: #ff00ff; margin-right: 20px; }}
    </style>
</head>
<body>
    <h1>{title}</h1>
    <div class="nav">
        <a href="#" onclick="showAll()">All Frames</a>
        <a href="#" onclick="showFlagged()">Flagged Only</a>
    </div>
    <div class="gallery">
"""
    
    for f in frames:
        html += f"""
        <div class="frame" onclick="openModal('{f.name}')">
            <img src="{f.name}" loading="lazy">
            <div class="frame-name">{f.stem}</div>
        </div>
"""
    
    html += """
    </div>
    <div class="modal" id="modal" onclick="closeModal()">
        <span class="modal-close">&times;</span>
        <img id="modal-img" src="">
    </div>
    <script>
        function openModal(src) {
            document.getElementById('modal-img').src = src;
            document.getElementById('modal').classList.add('active');
        }
        function closeModal() {
            document.getElementById('modal').classList.remove('active');
        }
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') closeModal();
        });
        function showAll() { document.querySelectorAll('.frame').forEach(f => f.style.display = ''); }
        function showFlagged() { /* TODO: implement flagging */ }
    </script>
</body>
</html>
"""
    
    with open(output_path, 'w') as f:
        f.write(html)
    print(f"HTML gallery: {output_path}")


def main(args):
    frames_dir = Path(args.frames_dir)
    output_dir = Path(args.output) if args.output else frames_dir.parent / "qc"
    output_dir.mkdir(parents=True, exist_ok=True)
    
    face_region = tuple(args.face_region) if args.face_region else DEFAULT_FACE_REGION
    
    print(f"QC for: {frames_dir}")
    print(f"Output: {output_dir}")
    print()
    
    # 1. Face grid
    create_face_grid(frames_dir, output_dir / "faces-grid.png", face_region)
    
    # 2. Full frames on magenta
    magenta_dir = output_dir / "magenta"
    create_full_frames_magenta(frames_dir, magenta_dir)
    
    # 3. HTML gallery
    create_html_gallery(magenta_dir, output_dir / "gallery.html", f"QC: {frames_dir.name}")
    
    print(f"\n✓ QC complete!")
    print(f"  Open: {output_dir / 'gallery.html'}")
    print(f"  Or view: {output_dir / 'faces-grid.png'}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Sprite QC Viewer")
    parser.add_argument("frames_dir", help="Directory of transparent PNG frames")
    parser.add_argument("--output", "-o", help="Output directory for QC files")
    parser.add_argument("--face-region", nargs=4, type=int, metavar=("X1", "Y1", "X2", "Y2"),
                        help="Face crop region (default: 200 50 520 400)")
    
    args = parser.parse_args()
    main(args)
