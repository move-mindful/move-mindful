// The recurring weekly live-class schedule. Times are in Arizona (America/Phoenix,
// fixed MST — Arizona does not observe DST). Weekday uses the Luxon/ISO convention:
// 1 = Monday … 7 = Sunday.

export const ARIZONA_ZONE = "America/Phoenix";

export interface ScheduleEntry {
  /** ISO weekday: 1 = Monday … 7 = Sunday */
  weekday: number;
  /** Hour in Arizona time, 0–23 */
  hour: number;
  /** Minute in Arizona time, 0–59 */
  minute: number;
  /** Class length in minutes */
  duration: number;
  title: string;
}

export const LIVE_SCHEDULE: ScheduleEntry[] = [
  { weekday: 7, hour: 9, minute: 0, duration: 60, title: "Relax & Restore" }, // Sunday

  { weekday: 1, hour: 9, minute: 0, duration: 60, title: "Yoga with Weights" }, // Monday
  { weekday: 1, hour: 11, minute: 0, duration: 60, title: "Relax & Restore" }, // Monday

  { weekday: 4, hour: 9, minute: 0, duration: 60, title: "Yoga with Weights" }, // Thursday
  { weekday: 4, hour: 11, minute: 0, duration: 60, title: "Relax & Restore" }, // Thursday

  { weekday: 5, hour: 9, minute: 0, duration: 60, title: "Mobility & Balance" }, // Friday
  { weekday: 5, hour: 10, minute: 30, duration: 30, title: "Legs Up the Wall Meditation" }, // Friday

  { weekday: 6, hour: 9, minute: 0, duration: 60, title: "Relax & Restore" }, // Saturday
  { weekday: 6, hour: 10, minute: 30, duration: 30, title: "Strength & Sculpt Express" }, // Saturday
];

// Soft badge colors per class title, in the same style as the intensity badges
// used elsewhere in the app. Falls back to zinc for any unrecognized title.
export const classColor: Record<string, string> = {
  "Relax & Restore": "bg-emerald-100 text-emerald-700",
  "Yoga with Weights": "bg-violet-100 text-violet-700",
  "Mobility & Balance": "bg-sky-100 text-sky-700",
  "Legs Up the Wall Meditation": "bg-teal-100 text-teal-700",
  "Strength & Sculpt Express": "bg-amber-100 text-amber-700",
};
