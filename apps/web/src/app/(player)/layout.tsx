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
  return <div className={`${outfit.className} flex flex-1 flex-col bg-[#14142B] text-white`}>{children}</div>;
}
