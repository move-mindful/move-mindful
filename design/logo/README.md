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

`apps/web/src/app/apple-icon.png` is this master scaled to 180px. The browser
tab icon and the Android/desktop install icons still use the old white logo.
A final logo should be drawn as a vector (SVG or PDF), so it's sharp at every
size and can be layered for the iOS app's icon.
