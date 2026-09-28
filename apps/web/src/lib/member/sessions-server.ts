import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type { SavedProgress, WorkoutStatus } from "@/lib/member/sessions";

// Reads of a member's workout sessions. `userId` must come from the Clerk
// session. Saving is the server action in app/actions/workout-sessions.ts.

/** The member's saved spot in a workout, if they have one (the player checks it still fits). */
export async function getSavedProgress(userId: string, workoutId: string): Promise<SavedProgress | null> {
  const { data } = await createAdminClient()
    .from("workout_sessions")
    .select("id, resume_step, active_seconds, sequence_key, with_warmup")
    .eq("clerk_user_id", userId)
    .eq("workout_id", workoutId)
    .eq("status", "in_progress")
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

/**
 * What each workout card says: "Resume · N%" for progress that still fits the
 * workout (its sequence key matches and it's past the first set), otherwise
 * "Done · when" if they've finished it, otherwise nothing.
 */
export async function getWorkoutStatuses(
  userId: string,
  workouts: Array<{ id: string; sequenceKey: string }>,
): Promise<Map<string, WorkoutStatus>> {
  const statuses = new Map<string, WorkoutStatus>();
  if (!workouts.length) return statuses;
  const supabase = createAdminClient();
  const ids = workouts.map((w) => w.id);
  const [{ data: inProgress }, { data: done }] = await Promise.all([
    supabase
      .from("workout_sessions")
      .select("workout_id, resume_step, percent_complete, sequence_key")
      .eq("clerk_user_id", userId)
      .eq("status", "in_progress")
      .in("workout_id", ids),
    supabase
      .from("workout_sessions")
      .select("workout_id, completed_at")
      .eq("clerk_user_id", userId)
      .eq("status", "completed")
      .in("workout_id", ids)
      .order("completed_at", { ascending: false })
      .limit(500),
  ]);

  for (const w of workouts) {
    const saved = inProgress?.find((s) => s.workout_id === w.id);
    if (saved && saved.sequence_key === w.sequenceKey && saved.resume_step > 0) {
      statuses.set(w.id, { kind: "resume", percent: saved.percent_complete });
      continue;
    }
    const last = done?.find((s) => s.workout_id === w.id);
    if (last?.completed_at) statuses.set(w.id, { kind: "done", at: last.completed_at });
  }
  return statuses;
}
