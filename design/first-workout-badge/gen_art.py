"""Lay out the 1st Workout badge's raised gold artwork on a high-res mask,
then trace it into polygons (outer ring + holes) in coin units: radius 1, y up.
See README.md for how to run it.

    python gen_art.py <mark.png> <Outfit font> <out.json> ["1ST WORKOUT"]

Output: [[outer, hole, hole...], ...], each ring a flat [x,y,x,y...]. Also
writes layout.png beside this script: the flat artwork, for checking by eye.
"""
import json, math, sys
import cv2
import numpy as np
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer
from fontTools.pens.basePen import BasePen

HERE = sys.path[0]
LOGO = sys.argv[1]
FONT = sys.argv[2]
OUT = sys.argv[3]
TEXT = sys.argv[4] if len(sys.argv) > 4 else "1ST WORKOUT"

N = 4096                      # mask size in px
S = N / 2 * 0.985             # px per coin unit (leave a hair of margin)
C = N / 2


def to_px(x, y):
    return (C + x * S, C - y * S)


mask = np.zeros((N, N), np.uint8)


# --- rings ---------------------------------------------------------------
def ring(r_mid, w):
    cv2.circle(mask, (int(C * 16), int(C * 16)), int(round((r_mid) * S * 16)),
               255, thickness=max(1, int(round(w * S))), lineType=cv2.LINE_8, shift=4)


R_OUT, R_IN = 0.872, 0.655    # outer and inner thin rings
RING_W = 0.018
ring(R_OUT, RING_W)
ring(R_IN, RING_W)


# --- logo ----------------------------------------------------------------
im = cv2.imread(LOGO, cv2.IMREAD_UNCHANGED).astype(np.float32) / 255
if im.shape[2] == 4:
    a = im[..., 3:4]
    im = im[..., :3] * a + (1 - a)
ink = 1 - im.mean(axis=2)                      # 1 = logo
ys, xs = np.where(ink > 0.5)
cx = (xs.min() + xs.max()) / 2
cy = (ys.min() + ys.max()) / 2
# fit by the furthest logo pixel from the bbox centre, so the curvy
# silhouette (not its bounding box) sits inside the inner ring
reach = np.sqrt((xs - cx) ** 2 + (ys - cy) ** 2).max()
LOGO_REACH = 0.545                              # coin units
LOGO_DY = 0.012                                 # nudge up for optical centre
k = LOGO_REACH * S / reach                      # src px -> mask px
M = np.float32([[k, 0, C - cx * k], [0, k, C - LOGO_DY * S - cy * k]])
warped = cv2.warpAffine(ink, M, (N, N), flags=cv2.INTER_CUBIC)
warped = cv2.GaussianBlur(warped, (0, 0), 1.2)
mask[warped > 0.5] = 255
print("logo stroke ~", round(34 * k / S, 4), "units")


# --- lettering on the bottom arc ------------------------------------------
font = TTFont(FONT)
font = instancer.instantiateVariableFont(font, {"wght": 700},
                                         overlap=instancer.OverlapMode.REMOVE)
upm = font["head"].unitsPerEm
cap = font["OS/2"].sCapHeight
gs = font.getGlyphSet()
cmap = font.getBestCmap()
hmtx = font["hmtx"]


class FlatPen(BasePen):
    def __init__(self, gs, steps=10):
        super().__init__(gs)
        self.contours, self.cur, self.steps = [], None, steps

    def _moveTo(self, p):
        self.cur = [p]

    def _lineTo(self, p):
        self.cur.append(p)

    def _curveToOne(self, p1, p2, p3):
        p0 = self.cur[-1]
        for i in range(1, self.steps + 1):
            t = i / self.steps
            mt = 1 - t
            self.cur.append(tuple(mt**3 * a + 3 * mt * mt * t * b + 3 * mt * t * t * c + t**3 * d
                                  for a, b, c, d in zip(p0, p1, p2, p3)))

    def _qCurveToOne(self, p1, p2):
        p0 = self.cur[-1]
        for i in range(1, self.steps + 1):
            t = i / self.steps
            mt = 1 - t
            self.cur.append(tuple(mt * mt * a + 2 * mt * t * b + t * t * c
                                  for a, b, c in zip(p0, p1, p2)))

    def _closePath(self):
        self.contours.append(self.cur)
        self.cur = None

    _endPath = _closePath


CAP_H = 0.112                     # cap height in coin units
em = CAP_H * upm / cap            # coin units per em
TRACK = 0.16 * em                 # letter spacing
R_CAP_MID = (R_OUT + R_IN) / 2 + 0.002
R_BASE = R_CAP_MID + CAP_H / 2    # baseline on the outer side; tops face the centre

glyphs = []
for ch in TEXT:
    g = cmap[ord(ch)]
    adv = hmtx[g][0] / upm * em
    pen = FlatPen(gs)
    gs[g].draw(pen)
    glyphs.append((ch, adv, pen.contours))

widths = [adv for _, adv, _ in glyphs]
total = sum(widths) + TRACK * (len(widths) - 1)
span = total / R_CAP_MID                      # radians, measured at mid cap height
theta = math.radians(270) - span / 2          # start lower-left, run counter-clockwise
print("text span", round(math.degrees(span), 1), "deg")

for ch, adv, contours in glyphs:
    mid = theta + (adv / 2) / R_CAP_MID
    T = (-math.sin(mid), math.cos(mid))       # reading direction
    U = (-math.cos(mid), -math.sin(mid))      # glyph "up" -> towards centre
    O = (R_BASE * math.cos(mid), R_BASE * math.sin(mid))
    polys = []
    for c in contours:
        pts = []
        for (fx, fy) in c:
            gx = fx / upm * em - adv / 2
            gy = fy / upm * em
            x = O[0] + gx * T[0] + gy * U[0]
            y = O[1] + gx * T[1] + gy * U[1]
            pts.append(to_px(x, y))
        polys.append(np.round(np.array(pts) * 16).astype(np.int32))
    # overlaps were removed, so even-odd fill gives the right holes
    cv2.fillPoly(mask, polys, 255, lineType=cv2.LINE_8, shift=4)
    theta += (adv + TRACK) / R_CAP_MID

text_end_gap = math.radians(9.5)
end_l = math.radians(270) - span / 2 - text_end_gap
end_r = math.radians(270) + span / 2 + text_end_gap


# --- sparkles + dots -------------------------------------------------------
def sparkle(x, y, r, rot=0.0, pinch=0.16, steps=24):
    """Four-point star with concave sides."""
    pts = []
    for q in range(4):
        a0 = rot + q * math.pi / 2
        tip = (x + r * math.cos(a0), y + r * math.sin(a0))
        nxt = (x + r * math.cos(a0 + math.pi / 2), y + r * math.sin(a0 + math.pi / 2))
        ctrl = (x + pinch * r * math.cos(a0 + math.pi / 4), y + pinch * r * math.sin(a0 + math.pi / 4))
        for i in range(steps):
            t = i / steps
            mt = 1 - t
            pts.append(to_px(mt * mt * tip[0] + 2 * mt * t * ctrl[0] + t * t * nxt[0],
                             mt * mt * tip[1] + 2 * mt * t * ctrl[1] + t * t * nxt[1]))
    cv2.fillPoly(mask, [np.round(np.array(pts) * 16).astype(np.int32)], 255, shift=4)


def dot(x, y, r):
    px, py = to_px(x, y)
    cv2.circle(mask, (int(px * 16), int(py * 16)), int(r * S * 16), 255, -1, shift=4)


R_BAND = (R_OUT + R_IN) / 2
sparkle(0, R_BAND, 0.072)                                     # crown star at 12 o'clock
for side in (-1, 1):
    for i, (deg, r) in enumerate(((13.5, 0.016), (21.5, 0.012), (28.5, 0.009), (34.5, 0.0065))):
        a = math.radians(90 + side * deg)
        dot(R_BAND * math.cos(a), R_BAND * math.sin(a), r)
for a in (end_l, end_r):                                      # stars closing the lettering
    sparkle(R_BAND * math.cos(a), R_BAND * math.sin(a), 0.038, rot=a)


# --- trace -----------------------------------------------------------------
cv2.imwrite(f"{HERE}/layout.png", cv2.resize(mask, (1024, 1024), interpolation=cv2.INTER_AREA))
contours, hier = cv2.findContours(mask, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_NONE)
hier = hier[0]


def simplify(c):
    c = cv2.approxPolyDP(c, 0.9, True).reshape(-1, 2).astype(np.float64)
    out = []
    for px, py in c:
        out += [round((px - C) / S, 4), round((C - py) / S, 4)]
    return out


shapes = []
npts = 0
for i, (nxt, prv, child, parent) in enumerate(hier):
    if parent != -1:
        continue
    if cv2.contourArea(contours[i]) < 30:
        continue
    rings = [simplify(contours[i])]
    j = child
    while j != -1:
        if cv2.contourArea(contours[j]) >= 20:
            rings.append(simplify(contours[j]))
        j = hier[j][0]
    npts += sum(len(r) // 2 for r in rings)
    shapes.append(rings)

json.dump(shapes, open(OUT, "w"), separators=(",", ":"))
print(len(shapes), "shapes,", npts, "points")
