# 1st Workout badge

The spinning 3D medal on the player's **Workout complete** screen, in place of
the check: a frosted enamel face, a gold rim, and the Move Mindful mark with
"1ST WORKOUT" (Outfit Bold) raised in gold. It shows on every finish for now;
it's meant in the end for a member's first (the `badge` prop on
`CompleteScreen`, set in `workout-player.tsx`).

- **Design preview** (private, claude.ai): https://claude.ai/artifact/MddU1uCJAuNbEYsLg3RYdS:
  the same badge on its own, with drag-to-turn and a Gold / Brand finish
  toggle (Brand is the mark's purple-to-cyan; the app uses gold). It was
  styled after a reference video of a turning enamel-and-gold coin.
- **In the app:** `apps/web/src/components/workouts/first-workout-badge-scene.ts`
  (Three.js, loaded on demand) and `first-workout-badge.tsx` (the React
  wrapper, which falls back to the check if 3D can't run).

## What's here

- `gen_art.py`: lays the gold artwork out flat (two rings, the mark, the
  lettering on its arc, the crown star and dots, the sparkles at either end
  of the lettering) on a 4096px mask, then traces it into polygons for the
  3D extrusion.
- `mark-black.png`: the mark, black on transparent, that it traces.
- `layout.png`: the flat artwork it last produced, for checking by eye.

## Regenerating the artwork

Edit the layout in `gen_art.py` (ring radii, lettering size and spacing,
`LOGO_REACH` for the mark's size), or pass different lettering, then:

```bash
python3 -m venv /tmp/badge-venv && /tmp/badge-venv/bin/pip install opencv-python-headless numpy fonttools brotli skia-pathops
/tmp/badge-venv/bin/python design/first-workout-badge/gen_art.py design/first-workout-badge/mark-black.png <Outfit font> apps/web/src/components/workouts/first-workout-badge-art.json
```

The font is Outfit's variable font, set to weight 700 by the script. Either
download `Outfit[wght].ttf` from Google Fonts, or use the copy `next build`
leaves in `apps/web/.next/static/media/` (the `.woff2` whose name table
says Outfit). The script prints the lettering's span; around 100° fits the
band between the rings.
