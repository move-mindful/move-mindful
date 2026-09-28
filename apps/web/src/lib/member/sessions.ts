// A member's workout sessions (workout_sessions,
// supabase/migrations/013_workout_sessions.sql): their saved progress and the
// workouts they've finished. Shared by the server, which reads and writes
// them, and the player, which saves as it goes. No server-only imports.

/** What happened: a workout begun, a new set reached, finished, or thrown away. */
export type SessionEvent = "start" | "progress" | "complete" | "discard";

/** One save from the player. The member comes from their session, never from this. */
export interface SessionSave {
  /** Made by the player when the workout begins (or the saved session's, resuming). */
  sessionId: string;
  workoutId: string;
  event: SessionEvent;
  /** The set to resume at. */
  step: number;
  setsDone: number;
  setsTotal: number;
  percent: number;
  activeSeconds: number;
  sequenceKey: string;
  withWarmup: boolean;
}

/** A member's saved spot in a workout, for the player to offer Resume. */
export interface SavedProgress {
  sessionId: string;
  step: number;
  activeSeconds: number;
  sequenceKey: string;
  withWarmup: boolean;
}

/** What a workout card says about the member's sessions. */
export type WorkoutStatus = { kind: "resume"; percent: number } | { kind: "done"; at: string } | null;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EVENTS: readonly SessionEvent[] = ["start", "progress", "complete", "discard"];

function count(v: unknown, max: number): number | null {
  return typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= max ? v : null;
}

/** A well-formed save from untrusted input, or null. */
export function cleanSessionSave(raw: unknown): SessionSave | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.sessionId !== "string" || !UUID.test(r.sessionId)) return null;
  if (typeof r.workoutId !== "string" || !UUID.test(r.workoutId)) return null;
  if (!EVENTS.includes(r.event as SessionEvent)) return null;
  if (typeof r.sequenceKey !== "string" || !/^[0-9a-f]{8}$/.test(r.sequenceKey)) return null;
  const step = count(r.step, 10_000);
  const setsDone = count(r.setsDone, 10_000);
  const setsTotal = count(r.setsTotal, 10_000);
  const percent = count(r.percent, 100);
  const activeSeconds = count(r.activeSeconds, 86_400);
  if (step === null || setsDone === null || setsTotal === null || percent === null || activeSeconds === null) {
    return null;
  }
  return {
    sessionId: r.sessionId,
    workoutId: r.workoutId,
    event: r.event as SessionEvent,
    step,
    setsDone: Math.min(setsDone, setsTotal),
    setsTotal,
    percent,
    activeSeconds,
    sequenceKey: r.sequenceKey,
    withWarmup: r.withWarmup === true,
  };
}

/**
 * "today", "yesterday", "3 days ago", "2 weeks ago" or a date — in the
 * viewer's own calendar days, so it's worked out in the browser.
 */
export function daysAgoLabel(at: Date, now: Date): string {
  const day = (d: Date) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86_400_000;
  const days = Math.max(0, Math.round(day(now) - day(at)));
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 14) return `${days} days ago`;
  if (days < 56) return `${Math.floor(days / 7)} weeks ago`;
  return at.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    ...(at.getFullYear() !== now.getFullYear() && { year: "numeric" }),
  });
}
