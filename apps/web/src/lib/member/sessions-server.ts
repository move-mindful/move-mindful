import "server-only";

import { RESUME_WINDOW_MS } from "@move-mindful/core";
import { createAdminClient } from "@/lib/supabase/admin";
import type { SavedProgress, WorkoutStatus } from "@/lib/member/sessions";

// Reads of a member's workout sessions. `userId` must come from the Clerk
// session. Saving is the server action in app/actions/workout-sessions.ts.

/** Progress saved before this can't be resumed any more (see RESUME_WINDOW_MS). */
const resumeCutoff = () => new Date(Date.now() - RESUME_WINDOW_MS).toISOString();

/**
 * The member's saved spot in a workout, if they have one from the last week
 * (the player checks it still fits the workout).
 */
export async function getSavedProgress(userId: string, workoutId: string): Promise<SavedProgress | null> {
  const { data } = await createAdminClient()
    .from("workout_sessions")
    .select("id, resume_step, active_seconds, sequence_key, with_warmup")
    .eq("clerk_user_id", userId)
    .eq("workout_id", workoutId)
    .eq("status", "in_progress")
    .gte("updated_at", resumeCutoff())
    .maybeSingle();
  if (!data) return null;
  return {
    sessionId: data.id,
    step: data.resume_step,
    activeSeconds: data.active_seconds,
    sequenceKey: data.sequence_key,
    withWarmup: data.with_warmup,
  };
}

/** When the member last finished this workout (an ISO time), or null — for the preview's "Done" pill. */
export async function getLastCompleted(userId: string, workoutId: string): Promise<string | null> {
  const { data } = await createAdminClient()
    .from("workout_sessions")
    .select("completed_at")
    .eq("clerk_user_id", userId)
    .eq("workout_id", workoutId)
    .eq("status", "completed")
    .not("completed_at", "is", null)
    .order("completed_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data?.completed_at as string | undefined) ?? null;
}

/** A member's resumable and finished sessions, for their workout cards (see workoutStatuses). */
export interface SessionSummaries {
  inProgress: Array<{ workout_id: string | null; resume_step: number; percent_complete: number; sequence_key: string }>;
  done: Array<{ workout_id: string | null; completed_at: string | null }>;
}

/**
 * The member's sessions that show on workout cards: in progress within the
 * last week, and their latest finishes. Needs nothing from the workouts, so it
 * runs alongside loading them.
 */
export async function getSessionSummaries(userId: string): Promise<SessionSummaries> {
  const supabase = createAdminClient();
  const [{ data: inProgress }, { data: done }] = await Promise.all([
    supabase
      .from("workout_sessions")
      .select("workout_id, resume_step, percent_complete, sequence_key")
      .eq("clerk_user_id", userId)
      .eq("status", "in_progress")
      .gte("updated_at", resumeCutoff()),
    supabase
      .from("workout_sessions")
      .select("workout_id, completed_at")
      .eq("clerk_user_id", userId)
      .eq("status", "completed")
      .order("completed_at", { ascending: false })
      .limit(500),
  ]);
  return { inProgress: inProgress ?? [], done: done ?? [] };
}

/**
 * What each workout card says: "Resume · N%" for progress that can still be
 * resumed (saved in the last week, its sequence key matches the workout and
 * it's past the first set), otherwise "Done · when" if they've finished it,
 * otherwise nothing.
 */
export function workoutStatuses(
  workouts: Array<{ id: string; sequenceKey: string }>,
  { inProgress, done }: SessionSummaries,
): Map<string, WorkoutStatus> {
  const statuses = new Map<string, WorkoutStatus>();
  for (const w of workouts) {
    const saved = inProgress.find((s) => s.workout_id === w.id);
    if (saved && saved.sequence_key === w.sequenceKey && saved.resume_step > 0) {
      statuses.set(w.id, { kind: "resume", percent: saved.percent_complete });
      continue;
    }
    const last = done.find((s) => s.workout_id === w.id);
    if (last?.completed_at) statuses.set(w.id, { kind: "done", at: last.completed_at });
  }
  return statuses;
}
