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

export const metadata: Metadata = {
  title: "MoveMindful",
  description: "A video fitness platform — on-demand classes, livestreaming, and community.",
  appleWebApp: {
    capable: true,
    title: "MoveMindful",
    statusBarStyle: "default",
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
