# Splash: the installed iPhone app's launch screens

What an iPhone shows from tapping the home-screen icon until the page draws —
without one, iOS shows a blank screen for a moment. The white line logo
(`design/logo/glyph-white-1024.png`) centred on the dark-mode ground
(#0c1014), with a very faint violet glow in the top-left and bottom-right
corners: violet-500 (#8b5cf6), the ring round the member's photo.
`preview.png` is one at a third of its size.

- `splash.py` makes them: one PNG per iPhone screen size (iOS shows a launch
  image only when it matches the device exactly) into
  `apps/web/public/splash/`. Run
  `python3 splash.py ../logo/glyph-white-1024.png ../../apps/web/public/splash`
  (Pillow and NumPy); `--only 1179x2556` makes one.
- The sizes are `SIZES` in the script, and `SPLASH_SIZES` in
  `apps/web/src/app/layout.tsx` — which writes the
  `apple-touch-startup-image` tags — must list the same ones. A new iPhone
  size needs a line in both.
- The glows are dithered and only there (the flat middle stays flat), and the
  PNGs use a palette, which keeps each to about half a megabyte.
