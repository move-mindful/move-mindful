"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Rate a workout out of five stars, from its "Workout complete" screen. The
 * member comes from the Clerk session, never the request; rating again changes
 * their rating. Only for a workout they can see (drafts just for admins).
 */
export async function rateWorkout(workoutId: string, stars: number): Promise<{ saved: boolean }> {
  const { userId, sessionClaims } = await auth();
  if (!userId) return { saved: false };
  const value = Math.round(Number(stars));
  if (!(value >= 1 && value <= 5) || typeof workoutId !== "string") return { saved: false };

  const supabase = createAdminClient();
  const { data: workout } = await supabase.from("workouts").select("published_at").eq("id", workoutId).maybeSingle();
  const isAdmin = sessionClaims?.metadata?.role === "admin";
  if (!workout || (!workout.published_at && !isAdmin)) return { saved: false };

  const { error } = await supabase
    .from("workout_ratings")
    .upsert({ clerk_user_id: userId, workout_id: workoutId, stars: value, updated_at: new Date().toISOString() });
  if (error) {
    console.error("[workout-ratings]", error);
    return { saved: false };
  }
  // The admin's list and builder show the averages.
  revalidatePath("/admin/workouts");
  revalidatePath(`/admin/workouts/${workoutId}`);
  return { saved: true };
}
