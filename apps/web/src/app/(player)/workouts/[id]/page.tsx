import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { requireSectionUnlocked } from "@/lib/auth/locked-sections";
import { getViewerAccess } from "@/lib/auth/viewer";
import { getPlayerWorkout } from "@/lib/workouts/member";
import { getPlayerPreferences } from "@/lib/member/preferences-server";
import { WorkoutPlayer } from "@/components/workouts/workout-player";

export const viewport: Viewport = {
  themeColor: "#14142B",
  colorScheme: "dark",
};

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const viewer = await getViewerAccess();
  const workout = await getPlayerWorkout(id, viewer.isAdmin);
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
  const [viewer, { userId }] = await Promise.all([getViewerAccess(), auth()]);
  const [workout, preferences] = await Promise.all([
    getPlayerWorkout(id, viewer.isAdmin),
    userId ? getPlayerPreferences(userId) : null,
  ]);
  if (!workout) notFound();
  return <WorkoutPlayer workout={workout} backHref="/workouts" preferences={preferences} signedIn={!!userId} />;
}
