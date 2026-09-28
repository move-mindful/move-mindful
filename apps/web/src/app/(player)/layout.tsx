import { Outfit } from "next/font/google";

/**
 * Full-screen member experiences with no site header — the workout preview and
 * player. Dark, in the player's own typeface (the design canvas's Outfit).
 */
const outfit = Outfit({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export default function PlayerLayout({ children }: { children: React.ReactNode }) {
  // `data-dark-page` darkens the whole page behind it (see globals.css), which
  // is what iOS Safari colours its status-bar area from.
  return (
    <div data-dark-page className={`${outfit.className} flex flex-1 flex-col bg-[#14142B] text-white`}>
      {children}
    </div>
  );
}
