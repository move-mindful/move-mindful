"""
The logo as a one-colour glyph, like the Instagram glyph: just the figure, no
tile, on a clear background. White for dark backgrounds, black for light ones.
The lines are 1.5x thick, as in the app icon (option "B").

    python3 glyph.py source-black.png <out dir>

Writes glyph-white-1024.png and glyph-black-1024.png (the figure centred in a
1024px square, a 4% margin round its widest side), plus previews of each on
its background.
"""
import sys
import numpy as np
from PIL import Image

src_path, out = sys.argv[1], sys.argv[2]
SIZE, MARGIN, UP, GROW = 1024, 0.04, 2, 13          # GROW: px (at the source's scale) added to each side of a line

im = np.asarray(Image.open(src_path).convert("RGBA")).astype(np.float32) / 255
lum = im[..., 0] * im[..., 3]                        # the white figure; the black disc and clear corners read as 0
y0, y1, x0, x1 = 200, 1320, 200, 1420                # the figure's area in the source
crop = Image.fromarray((lum[y0:y1, x0:x1] * 255).astype(np.uint8))
big = np.asarray(crop.resize(((x1 - x0) * UP, (y1 - y0) * UP), Image.BICUBIC)) > 127

def dilate(mask, r):
    h, w = mask.shape
    pad = np.zeros((h + 2 * r, w + 2 * r), bool)
    out_ = np.zeros_like(pad)
    pad[r:r + h, r:r + w] = mask
    for dy in range(-r, r + 1):
        for dx in range(-r, r + 1):
            if dx * dx + dy * dy <= r * r:
                out_[r + dy:r + dy + h, r + dx:r + dx + w] |= mask
    return out_[r:r + h, r:r + w]

mask = dilate(big, GROW * UP)
ys, xs = np.nonzero(mask)
mask = mask[ys.min():ys.max() + 1, xs.min():xs.max() + 1]  # tight round the figure
h, w = mask.shape
scale = SIZE * (1 - 2 * MARGIN) / max(w, h)
fw, fh = round(w * scale), round(h * scale)
cov = Image.fromarray((mask * 255).astype(np.uint8)).resize((fw, fh), Image.LANCZOS)
alpha = Image.new("L", (SIZE, SIZE), 0)
alpha.paste(cov, ((SIZE - fw) // 2, (SIZE - fh) // 2))

for name, ink, bg in [("white", (255, 255, 255), (13, 17, 23)), ("black", (0, 0, 0), (255, 255, 255))]:
    glyph = Image.new("RGBA", (SIZE, SIZE), ink + (0,))
    glyph.putalpha(alpha)
    glyph.save(f"{out}/glyph-{name}-1024.png", optimize=True)
    preview = Image.new("RGBA", (SIZE, SIZE), bg + (255,))
    preview.alpha_composite(glyph)
    preview.convert("RGB").save(f"{out}/glyph-{name}-preview.png", optimize=True)
print("figure", fw, "x", fh, "in", SIZE)
