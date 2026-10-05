import sys
import numpy as np
from PIL import Image

master, out = sys.argv[1], sys.argv[2]
N = 1024
cov = Image.open(master).convert("L")                                   # the figure's coverage, white on black
fig = np.asarray(cov).astype(np.float32) / 255
big = np.asarray(cov.resize((N * 2, N * 2), Image.BICUBIC)) > 127       # 2x, for smooth edges

def erode(mask, r):
    """Shrink the shape by r px in every direction (a round brush)."""
    h, w = mask.shape
    inv = np.pad(~mask, r, constant_values=True)
    grown = np.zeros_like(inv)
    for dy in range(-r, r + 1):
        for dx in range(-r, r + 1):
            if dx * dx + dy * dy <= r * r:
                grown[r + dy:r + dy + h, r + dx:r + dx + w] |= inv[r:r + h, r:r + w]
    return ~grown[r:r + h, r:r + w]

# The gradients run over the figure itself, from the top of its head to the bottom of its legs.
rows = np.nonzero((fig > 0.5).any(axis=1))[0]
top, bottom = rows[0], rows[-1]
y = np.clip((np.arange(N, dtype=np.float32) - top) / (bottom - top), 0, 1)[:, None] * np.ones((1, N))
def lerp(a, b, t):
    return np.array(a, np.float32)[None, None] * (1 - t[..., None]) + np.array(b, np.float32)[None, None] * t[..., None]

def icon(rim_px, fill_top, fill_bottom, rim_top, rim_bottom, bg_top=(0, 0, 0), bg_bottom=(0, 0, 0)):
    inner = np.asarray(Image.fromarray((erode(big, rim_px * 2) * 255).astype(np.uint8)).resize((N, N), Image.LANCZOS)).astype(np.float32) / 255
    inner = np.minimum(inner, fig)
    img = lerp(bg_top, bg_bottom, y)
    # The whole line in the rim's white, then its inside over it: no seam between them.
    img = img * (1 - fig[..., None]) + lerp(rim_top, rim_bottom, y) * fig[..., None]
    img = img * (1 - inner[..., None]) + lerp(fill_top, fill_bottom, y) * inner[..., None]
    return Image.fromarray(img.clip(0, 255).astype(np.uint8))

variants = {
    # The look chosen 2026-10-04: black background; each line's white rim, its inside graded from near-white to a light grey.
    "final": icon(6, (246, 246, 250), (212, 212, 222), (255, 255, 255), (248, 248, 252)),
    # Glass lines: a bright white rim round each line, the inside a touch softer and greying slightly toward the bottom.
    "lines": icon(6, (244, 244, 248), (220, 220, 228), (255, 255, 255), (248, 248, 251)),
    # The same, with the background's faint lift at the top.
    "lines-bg": icon(6, (244, 244, 248), (220, 220, 228), (255, 255, 255), (248, 248, 251), (30, 30, 34), (0, 0, 0)),
}
for k, im in variants.items():
    im.save(f"{out}/glass-{k}-1024.png", optimize=True)
print("ok")
