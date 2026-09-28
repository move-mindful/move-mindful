"use server";

import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { cleanSessionSave, type SessionSave } from "@/lib/member/sessions";

/**
 * Save the signed-in member's place in a workout — called by the player as
 * the workout begins, at every new set, when it's finished, and when they
 * discard their progress. The member comes from the Clerk session, never from
 * the request; signed out, it does nothing.
 *
 * The player makes the session's id when the workout begins. The first save
 * creates the row, replacing any progress saved on that workout before (Start
 * over); later saves update it while it's in progress. A finished or
 * discarded session is never changed again.
 */
export async function saveWorkoutSession(input: SessionSave): Promise<{ saved: boolean }> {
  const { userId, sessionClaims } = await auth();
  if (!userId) return { saved: false };
  const save = cleanSessionSave(input);
  if (!save) return { saved: false };

  const supabase = createAdminClient();
  const now = new Date().toISOString();
  const status = save.event === "complete" ? "completed" : save.event === "discard" ? "discarded" : "in_progress";
  const fields = {
    status,
    resume_step: save.step,
    sets_done: status === "completed" ? save.setsTotal : save.setsDone,
    sets_total: save.setsTotal,
    percent_complete: status === "completed" ? 100 : Math.min(save.percent, 99),
    active_seconds: save.activeSeconds,
    sequence_key: save.sequenceKey,
    updated_at: now,
    completed_at: status === "completed" ? now : null,
  };

  const { data: updated, error } = await supabase
    .from("workout_sessions")
    .update(fields)
    .eq("id", save.sessionId)
    .eq("clerk_user_id", userId)
    .eq("status", "in_progress")
    .select("id");
  if (error) return { saved: false };
  if (updated.length) return { saved: true };
  if (save.event === "discard") return { saved: true };

  // A new session — only for a workout they can see (drafts just for admins).
  const { data: workout } = await supabase
    .from("workouts")
    .select("published_at")
    .eq("id", save.workoutId)
    .maybeSingle();
  const isAdmin = sessionClaims?.metadata?.role === "admin";
  if (!workout || (!workout.published_at && !isAdmin)) return { saved: false };

  await supabase
    .from("workout_sessions")
    .update({ status: "discarded", updated_at: now })
    .eq("clerk_user_id", userId)
    .eq("workout_id", save.workoutId)
    .eq("status", "in_progress");
  // An id that's already taken (someone else's, or this session once it's
  // finished) fails here rather than overwriting anything.
  const { error: insertError } = await supabase.from("workout_sessions").insert({
    id: save.sessionId,
    clerk_user_id: userId,
    workout_id: save.workoutId,
    with_warmup: save.withWarmup,
    started_at: now,
    ...fields,
  });
  return { saved: !insertError };
}
