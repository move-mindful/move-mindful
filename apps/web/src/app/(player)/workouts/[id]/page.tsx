import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { requireSectionUnlocked } from "@/lib/auth/locked-sections";
import { isAdmin } from "@/lib/auth/admin";
import { getPlayerWorkout } from "@/lib/workouts/member";
import { getPlayerPreferences } from "@/lib/member/preferences-server";
import { getLastCompleted, getSavedProgress } from "@/lib/member/sessions-server";
import { WorkoutPlayer } from "@/components/workouts/workout-player";

export const viewport: Viewport = {
  themeColor: "#14142B",
  colorScheme: "dark",
};

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const workout = await getPlayerWorkout(id, await isAdmin());
  return { title: workout ? `${workout.title} · MoveMindful` : "Workout · MoveMindful" };
}

/**
 * A workout: its preview, then the player (plan.md, Phase 4.5 step 4).
 *
 * Admin-only for now, like Classes and Live — which entitlement unlocks
 * workouts is still to be decided (step 6). The gate runs before anything is
 * read, so the clips' playback ids never reach a browser that isn't allowed
 * them (they're public Mux assets; keeping the ids off the wire is the gate).
 */
export default async function WorkoutPage({ params }: Props) {
  await requireSectionUnlocked();
  const { id } = await params;
  const [admin, { userId }] = await Promise.all([isAdmin(), auth()]);
  const [workout, preferences, progress, lastDone] = await Promise.all([
    getPlayerWorkout(id, admin),
    userId ? getPlayerPreferences(userId) : null,
    userId ? getSavedProgress(userId, id) : null,
    userId ? getLastCompleted(userId, id) : null,
  ]);
  if (!workout) notFound();
  return (
    <WorkoutPlayer
      workout={workout}
      backHref="/workouts"
      preferences={preferences}
      progress={progress}
      lastDone={lastDone}
      signedIn={!!userId}
    />
  );
}
