import type { Metadata, Viewport } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { Geist, Geist_Mono } from "next/font/google";
import { APPEARANCE_SCRIPT } from "@/lib/appearance";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/**
 * The installed iPhone app's launch screens: the white logo on the dark
 * ground with a faint violet glow in two corners, shown from the tap until
 * the page draws (otherwise iOS shows a blank screen). iOS uses one only if
 * it matches the screen exactly, so there's one per iPhone size, made by
 * design/splash/splash.py — keep this list in step with its SIZES.
 */
const SPLASH_SIZES: Array<[width: number, height: number, ratio: number]> = [
  [440, 956, 3],
  [402, 874, 3],
  [420, 912, 3],
  [430, 932, 3],
  [393, 852, 3],
  [428, 926, 3],
  [390, 844, 3],
  [375, 812, 3],
  [414, 896, 3],
  [414, 896, 2],
  [414, 736, 3],
  [375, 667, 2],
];

export const metadata: Metadata = {
  title: "MoveMindful",
  description: "A video fitness platform — on-demand classes, livestreaming, and community.",
  appleWebApp: {
    capable: true,
    title: "MoveMindful",
    statusBarStyle: "default",
    startupImage: SPLASH_SIZES.map(([w, h, ratio]) => ({
      url: `/splash/splash-${w * ratio}x${h * ratio}.png`,
      media: `(device-width: ${w}px) and (device-height: ${h}px) and (-webkit-device-pixel-ratio: ${ratio}) and (orientation: portrait)`,
    })),
  },
  formatDetection: {
    email: false,
    telephone: false,
    address: false,
  },
  other: {
    // Next emits the standardized `mobile-web-app-capable`; older iOS Safari
    // only honors the `apple-` prefixed variant, so set it explicitly too.
    "apple-mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
  colorScheme: "light",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // suppressHydrationWarning: APPEARANCE_SCRIPT may add `dark` to the class
    // list before React hydrates. The light color-scheme default lives in
    // globals.css, where the signed-in shell's dark mode can override it.
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        {/* Light or dark before the first paint — see lib/appearance.ts. */}
        <script dangerouslySetInnerHTML={{ __html: APPEARANCE_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col">
        <ClerkProvider>
          {children}
        </ClerkProvider>
      </body>
    </html>
  );
}
