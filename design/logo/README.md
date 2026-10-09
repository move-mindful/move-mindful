# Logo: the app icon (interim)

The meditation figure in white on black, with its lines thickened. This is what
the iPhone Home Screen icon uses until the new logo is ready before launch
(plan.md, Phase 5: "New logo before launch").

- `source-black.png`: the owner's black version of the logo (a white figure in
  a black disc, 1623px).
- `app-icon-1024.png`: the icon master, 1024px, with no transparency. The
  figure is the same size and position as in the source, spanning about 66% of
  the width (about 17% margin a side, well inside iOS's safe area). Its lines
  are 1.5× as thick (option "B", 2026-10-04), in pure white on solid black.
- `thicken.py`: how the master was made. It grows the figure's lines evenly in
  every direction at 2× resolution, then scales down.
  Run `python3 thicken.py source-black.png <out dir>` (Pillow and NumPy) to
  write the original, 1.3× ("A") and 1.5× ("B") versions.

- `app-icon-glass-1024.png`: the icon now in use (2026-10-04). It's the master
  above with glass lines, inspired by iOS 26's Liquid Glass. Each line has a
  thin pure-white rim, and its inside is graded from near-white at the head to
  a light cool grey at the legs. The background stays solid black.
- `glass.py`: how the glass version was made from `app-icon-1024.png`. Run
  `python3 glass.py app-icon-1024.png <out dir>`; the `final` variant is the
  one in use. The rim width and colours are its arguments.

- `app-icon-gradient-1024.png`: option "1: Gradient" from the same review (not
  in use; kept on request). The background lifts from a very dark grey
  (#1E1E22) at the top to black, and the figure goes from white to a cool
  off-white (#E2E2E8), both over the icon's full height. It's dithered: a dark
  gradient that slow only has about 30 shades, which otherwise show as bands.
- `app-icon-gradient-squircle-1024.png`: the same, in the iPhone icon shape
  (a superellipse, n = 5) with clear corners, for showing it rather than
  submitting it (Apple takes the square).
- `gradient.py`: makes both from `app-icon-1024.png`.

`apps/web/public/logo-mark.png` is the squircle scaled to 256px. It's the logo
in the site's headers (the main site, pricing and admin), from 2026-10-09. The
landing page's large logo and the signed-out pricing page still use the old
`logo.png`.

`apps/web/src/app/apple-icon.png` is the glass master scaled to 180px. The browser
tab icon and the Android/desktop install icons still use the old white logo.
A final logo should be drawn as a vector (SVG or PDF), so it's sharp at every
size and can be layered for the iOS app's icon.
