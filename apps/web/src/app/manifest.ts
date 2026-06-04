import type { MetadataRoute } from "next";

// Declaring an explicit manifest makes the site installable as a standalone
// home-screen app. `scope: "/"` is the important bit for iOS: it tells the
// installed app that every same-origin path belongs *inside* the app, so taps
// on links like /classes → /live stay in the standalone window instead of
// opening in an in-app browser overlay (the "modal with an X" some users see).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "MoveMindful",
    short_name: "MoveMindful",
    description:
      "A video fitness platform — on-demand classes, livestreaming, and community.",
    start_url: "/classes",
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    icons: [
      // iOS uses the apple-touch-icon (from apple-icon.png) for the home-screen
      // icon; these white-tiled entries are what Android/desktop installs use.
      // The mark sits inside an ~80% safe zone so it survives Android masking.
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
