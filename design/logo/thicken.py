import sys, time
import numpy as np
from PIL import Image

src_path, out_dir = sys.argv[1], sys.argv[2]
im = np.asarray(Image.open(src_path).convert("RGBA")).astype(np.float32) / 255
lum = im[..., 0] * im[..., 3]          # the white figure; the black disc and clear corners are 0
S = im.shape[1]                         # 1623: the disc spans the whole image

# Work on the figure's area at 2x, so the thickened outline stays smooth.
y0, y1, x0, x1 = 200, 1320, 200, 1420
UP = 2
crop = Image.fromarray((lum[y0:y1, x0:x1] * 255).astype(np.uint8))
big = np.asarray(crop.resize(((x1 - x0) * UP, (y1 - y0) * UP), Image.BICUBIC)) > 127

def dilate(mask, r):
    """Grow the white shape by r pixels in every direction (a round brush)."""
    if r <= 0:
        return mask.copy()
    h, w = mask.shape
    pad = np.zeros((h + 2 * r, w + 2 * r), bool)
    out = np.zeros_like(pad)
    pad[r:r + h, r:r + w] = mask
    for dy in range(-r, r + 1):
        for dx in range(-r, r + 1):
            if dx * dx + dy * dy <= r * r:
                out[r + dy:r + dy + h, r + dx:r + dx + w] |= mask
    return out[r:r + h, r:r + w]

def render(r_src, size=1024, color=(255, 255, 255)):
    grown = dilate(big, r_src * UP)
    k = size / S                                    # the disc's scale in the icon
    w, h = round((x1 - x0) * k), round((y1 - y0) * k)
    fig = Image.fromarray((grown * 255).astype(np.uint8)).resize((w, h), Image.LANCZOS)
    tile = Image.new("RGB", (size, size), (0, 0, 0))
    ink = Image.new("RGB", (w, h), color)
    tile.paste(ink, (round(x0 * k), round(y0 * k)), fig)
    return tile

stroke = 51
for name, r in [("original", 0), ("thicker-A", 8), ("thicker-B", 13)]:
    t = time.time()
    tile = render(r)
    tile.save(f"{out_dir}/app-icon-{name}-1024.png", optimize=True)
    print(name, f"stroke {stroke + 2 * r}px of 1623 ({(stroke + 2 * r) / stroke:.2f}x)", f"{time.time() - t:.1f}s")
