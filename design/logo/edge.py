"""
Option "2: Gradient + edge light" (2026-10-04 review), the web app's iPhone
Home Screen icon from 2026-10-09: "1: Gradient" (the background lifting from a
very dark grey to black, the figure from white to a cool off-white) plus a soft
light along the icon's edge, brightest along the top, like iOS 26's glass rim.

A website can only give iOS one flat image, so the edge light is painted in.
The iPhone app's icon shouldn't do this: there, iOS adds its own highlight to
flat Icon Composer layers (see README).

    python3 edge.py app-icon-1024.png <out dir> [<apple-icon path>]

Writes app-icon-edge-1024.png and, given a path, the 180px apple-touch-icon,
each rendered and dithered at its own size so the dark gradient doesn't band.
"""
import sys
import numpy as np
from PIL import Image

master, out = sys.argv[1], sys.argv[2]
apple_icon = sys.argv[3] if len(sys.argv) > 3 else None
N = 1024
fig = np.asarray(Image.open(master).convert("L")).astype(np.float64) / 255
y = np.linspace(0, 1, N)[:, None] * np.ones((1, N))

def lerp(a, b):
    a, b = np.array(a, np.float64), np.array(b, np.float64)
    return a[None, None] * (1 - y[..., None]) + b[None, None] * y[..., None]

img = lerp((30, 30, 34), (0, 0, 0)) * (1 - fig[..., None]) + lerp((255, 255, 255), (226, 226, 232)) * fig[..., None]

# The edge light: brightest at the edge of the rounded square (a superellipse, n = 5),
# fading inward over WIDTH px, and from 32% along the top to 6% along the bottom.
WIDTH, TOP, BOTTOM = 14, 0.32, 0.06
c = (N - 1) / 2
yy, xx = np.mgrid[0:N, 0:N].astype(np.float64)
r = ((np.abs(xx - c) / c) ** 5 + (np.abs(yy - c) / c) ** 5) ** (1 / 5)
glow = np.clip(1 - (1 - r) * c / WIDTH, 0, 1) ** 2
alpha = (glow * (TOP * (1 - y) + BOTTOM * y))[..., None]
img = img * (1 - alpha) + 255 * alpha

def save(size, path, seed):
    """Scale the float image to `size`, then dither (triangular, ±1 level, the same on every channel) and save."""
    if size == N:
        a = img
    else:
        a = np.stack([np.asarray(Image.fromarray(img[..., k].astype(np.float32), "F").resize((size, size), Image.LANCZOS))
                      for k in range(3)], -1).astype(np.float64)
    rng = np.random.default_rng(seed)
    noise = rng.random(a.shape[:2]) - rng.random(a.shape[:2])
    Image.fromarray(np.clip(np.round(a + noise[..., None]), 0, 255).astype(np.uint8)).save(path, optimize=True)

save(N, f"{out}/app-icon-edge-1024.png", 7)
if apple_icon:
    save(180, apple_icon, 8)
print("ok")
