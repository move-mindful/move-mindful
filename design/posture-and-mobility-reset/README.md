# Posture and Mobility Reset — design canvas

Working files for the design canvas behind the live
[/posture](https://www.movemindful.com/posture) page.

**Canvas:** https://claude.ai/artifact/BNwKwzksmENNbEJWeqsbsF

This is the *original* canvas the live page was built from (see commit
`1eddd50`, "Built from the approved design canvas"). The separate
impulse-buyer explorations live in [`../posture-reset-impulse`](../posture-reset-impulse).

## Artboards

| File | Frame | Notes |
| --- | --- | --- |
| `Main.dc.html` | 1440 × 7200 | Landing page — desktop |
| `MainCopy.dc.html` | 1440 × 7200 | Duplicate of the desktop board, for hand edits |
| `Mobile.dc.html` | 390 × 9200 | Landing page — mobile |

`canvas.json` holds the frame positions and the three sticky notes.
Images live in `images/` and are referenced from the artboards by bare
filename (`<img src="practice-hero.jpg">`).

## Known drift from the live page

The canvas predates several changes that shipped to production:

- the second hero paragraph was dropped from the live page on Sep 2
- the live hero plays a video loop; the canvas shows a still
- the canvas hardcodes **$29.99**; the live page reads the price from RevenueCat
- day photos are stand-ins, not the real class frames
- the canvas has its own nav and footer, which the live page does not use
- the product has since been renamed **The Posture and Mobility Reset**

## Rebuilding the canvas

Files here are the source; the published page is generated. To change
the canvas, edit these files and re-seed a fresh copy of the payload
with the `design` skill's helper, passing every artboard, every image
and `canvas.json`, then republish to the URL above.
