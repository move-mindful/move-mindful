import { Outfit } from "next/font/google";

/**
 * The player's typeface (the design canvas's Outfit): the member player's
 * layout, the builder's preview of the workout overview, and the cards on
 * /workouts (their titles in 800). Made once, here — the bundler turns away
 * the same font set up twice.
 */
export const outfit = Outfit({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});
