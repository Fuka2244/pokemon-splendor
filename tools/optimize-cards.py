"""Generate lightweight browser images from the original card scans.

Requires Pillow. The generated WebP files are committed so the server build
does not need an image-processing dependency.
"""

from pathlib import Path

from PIL import Image


root = Path(__file__).resolve().parents[1]
source = root / "assets" / "source-cards"
destination = root / "assets" / "web-cards"

for path in sorted(source.rglob("*.png")):
    relative = path.relative_to(source)
    output = (destination / relative).with_suffix(".webp")
    output.parent.mkdir(parents=True, exist_ok=True)
    with Image.open(path) as image:
        image.thumbnail((128, 128) if relative.parts[0] == "icons" else (540, 720), Image.Resampling.LANCZOS)
        image.save(output, "WEBP", quality=84, method=6)
