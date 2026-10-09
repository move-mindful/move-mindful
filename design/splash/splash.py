"""The installed iPhone app's launch screens (apple-touch-startup-image).

The white line logo centred on the dark-mode ground (#0c1014), with a very
soft violet glow in two opposite corners — violet-500 (#8b5cf6), the ring
round the member's photo. One PNG per iPhone screen size, since iOS shows a
launch image only when it matches the device exactly.

    python3 splash.py <glyph-white-1024.png> <out dir> [--only WxH]

Pillow and NumPy. The glows are dithered (a dark gradient that slow has only a
few dozen shades, which otherwise show as bands), and the PNGs saved with a
palette — they hold only a few hundred colours.
"""

import sys
import numpy as np
from PIL import Image

GROUND = (12, 16, 20)  # #0c1014
VIOLET = (139, 92, 246)  # #8b5cf6, Tailwind's violet-500
PEAK = 0.18  # each glow's strength right in its corner
REACH = 0.85  # how far it fades out, as a share of the screen's width
LOGO = 0.30  # the logo's width, as a share of the screen's width

# (css width, css height, pixel ratio) — portrait iPhones still in use.
SIZES = [
    (440, 956, 3),  # 16 Pro Max, 17 Pro Max
    (402, 874, 3),  # 16 Pro, 17, 17 Pro
    (420, 912, 3),  # Air
    (430, 932, 3),  # 14 Pro Max, 15 Plus/Pro Max, 16 Plus
    (393, 852, 3),  # 14 Pro, 15, 15 Pro, 16
    (428, 926, 3),  # 12/13 Pro Max, 14 Plus
    (390, 844, 3),  # 12, 12 Pro, 13, 13 Pro, 14, 16e
    (375, 812, 3),  # X, XS, 11 Pro, 12/13 mini
    (414, 896, 3),  # XS Max, 11 Pro Max
    (414, 896, 2),  # XR, 11
    (414, 736, 3),  # 6/7/8 Plus
    (375, 667, 2),  # SE (2nd/3rd), 6/7/8
]


def splash(glyph: Image.Image, w: int, h: int) -> Image.Image:
    ys, xs = np.mgrid[0:h, 0:w].astype(np.float32)
    reach = REACH * w
    img = np.empty((h, w, 3), np.float32)
    img[:] = GROUND
    glow = np.zeros((h, w), np.float32)
    for cx, cy in ((0, 0), (w, h)):
        d = np.hypot(xs - cx, ys - cy) / reach
        a = PEAK * np.clip(1 - d, 0, 1) ** 2
        glow += a
        img = img * (1 - a[..., None]) + np.array(VIOLET, np.float32) * a[..., None]
    # Grain only where there's glow (the flat middle stays flat), the same in
    # all three channels so the colours stay few.
    rng = np.random.default_rng(7)
    img += (rng.uniform(-0.5, 0.5, (h, w)) * (glow > 0.002))[..., None].astype(np.float32)
    out = Image.fromarray(np.clip(np.rint(img), 0, 255).astype(np.uint8), "RGB")

    size = round(LOGO * w)
    logo = glyph.resize((size, size), Image.LANCZOS)
    out.paste(logo, ((w - size) // 2, (h - size) // 2), logo)
    return out


def main():
    glyph = Image.open(sys.argv[1]).convert("RGBA")
    out_dir = sys.argv[2]
    only = sys.argv[4] if len(sys.argv) > 4 and sys.argv[3] == "--only" else None
    for cw, ch, dpr in SIZES:
        w, h = cw * dpr, ch * dpr
        if only and only != f"{w}x{h}":
            continue
        image = splash(glyph, w, h).quantize(256, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
        image.save(f"{out_dir}/splash-{w}x{h}.png", optimize=True)
        print(f"splash-{w}x{h}.png")


if __name__ == "__main__":
    main()
