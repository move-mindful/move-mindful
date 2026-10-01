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
  // Keep the page and bottom browser area purple. On touch-screen WebKit,
  // the separate black top edge gives Safari its status-bar background.
  return (
    <div data-dark-page className={`${outfit.className} flex flex-1 flex-col bg-[#14142B] text-white`}>
      <div aria-hidden="true" className="player-status-bar" />
      {children}
    </div>
  );
}
