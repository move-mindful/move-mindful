import { DateTime } from "luxon";

/** Render a YYYY-MM-DD class date for display, e.g. "Jun 4, 2026". */
export function formatClassDate(iso: string): string {
  const dt = DateTime.fromISO(iso);
  return dt.isValid ? dt.toFormat("LLL d, yyyy") : iso;
}
