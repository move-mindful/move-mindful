"""
Option "1: Gradient" (2026-10-04 review): the thick-line master with the
background lifting from a very dark grey at the top to black, and the figure
going from white to a cool off-white. Dithered, so the slow, dark gradient
doesn't break into visible bands.

    python3 gradient.py app-icon-1024.png <out dir>

Writes app-icon-gradient-1024.png (square, no transparency: what Apple takes)
and app-icon-gradient-squircle-1024.png (the iPhone shape, clear corners), and
the same pair for a light version (app-icon-gradient-light-*): white easing to
a soft grey, with the figure near-black, a touch lighter at the top.
"""
import sys
import numpy as np
from PIL import Image

master, out = sys.argv[1], sys.argv[2]
N = 1024
fig = np.asarray(Image.open(master).convert("L")).astype(np.float64) / 255
y = np.linspace(0, 1, N)[:, None] * np.ones((1, N))

def lerp(a, b):
    a, b = np.array(a, np.float64), np.array(b, np.float64)
    return a[None, None] * (1 - y[..., None]) + b[None, None] * y[..., None]

def render(bg_top, bg_bottom, ink_top, ink_bottom, name, seed):
    img = lerp(bg_top, bg_bottom) * (1 - fig[..., None]) + lerp(ink_top, ink_bottom) * fig[..., None]
    # Triangular dither of ±1 level, the same for all three channels (so it adds no colour speckle).
    rng = np.random.default_rng(seed)
    noise = rng.random((N, N)) - rng.random((N, N))
    rgb = np.clip(np.round(img + noise[..., None]), 0, 255).astype(np.uint8)
    Image.fromarray(rgb).save(f"{out}/{name}-1024.png", optimize=True)
    rgba = Image.fromarray(rgb).convert("RGBA")
    rgba.putalpha(mask)
    rgba.save(f"{out}/{name}-squircle-1024.png", optimize=True)

# The iPhone's icon shape: a superellipse (continuous corners), drawn at 4x and scaled down for a smooth edge.
S = N * 4
c = (S - 1) / 2
yy, xx = np.mgrid[0:S, 0:S].astype(np.float64)
inside = ((np.abs(xx - c) / c) ** 5 + (np.abs(yy - c) / c) ** 5) <= 1
mask = Image.fromarray((inside * 255).astype(np.uint8)).resize((N, N), Image.LANCZOS)

render((30, 30, 34), (0, 0, 0), (255, 255, 255), (226, 226, 232), "app-icon-gradient", 7)
render((255, 255, 255), (228, 228, 233), (44, 44, 50), (8, 8, 10), "app-icon-gradient-light", 9)
print("ok")
