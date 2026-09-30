import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type { RatingSummary } from "@/lib/workouts/shared";

// Workout ratings (017_workout_ratings.sql): one per member per workout, 1–5
// stars. Saving is the server action in app/actions/workout-ratings.ts. Before
// the migration has run the reads come back empty.

/** The member's own rating of this workout, or null. `userId` must come from the Clerk session. */
export async function getMyRating(userId: string, workoutId: string): Promise<number | null> {
  const { data } = await createAdminClient()
    .from("workout_ratings")
    .select("stars")
    .eq("clerk_user_id", userId)
    .eq("workout_id", workoutId)
    .maybeSingle();
  return (data?.stars as number | undefined) ?? null;
}

function summarise(stars: number[]): RatingSummary | null {
  if (!stars.length) return null;
  const byStars: RatingSummary["byStars"] = [0, 0, 0, 0, 0];
  for (const s of stars) if (s >= 1 && s <= 5) byStars[s - 1]++;
  return { average: stars.reduce((a, b) => a + b, 0) / stars.length, count: stars.length, byStars };
}

/** Every rated workout's summary, for the admin workouts list. */
export async function getRatingSummaries(): Promise<Map<string, RatingSummary>> {
  const { data } = await createAdminClient().from("workout_ratings").select("workout_id, stars");
  const byWorkout = new Map<string, number[]>();
  for (const r of data ?? []) {
    const id = r.workout_id as string;
    byWorkout.set(id, [...(byWorkout.get(id) ?? []), r.stars as number]);
  }
  return new Map([...byWorkout].map(([id, stars]) => [id, summarise(stars)!]));
}

/** One workout's summary, for the builder; null when it has no ratings yet. */
export async function getRatingSummary(workoutId: string): Promise<RatingSummary | null> {
  const { data } = await createAdminClient().from("workout_ratings").select("stars").eq("workout_id", workoutId);
  return summarise((data ?? []).map((r) => r.stars as number));
}
