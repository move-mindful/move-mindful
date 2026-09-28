import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { getViewerAccess } from "@/lib/auth/viewer";
import { getPlayerWorkout } from "@/lib/workouts/member";
import { WorkoutPlayer } from "@/components/workouts/workout-player";

/**
 * /demo1 — a public sample of the exercise-by-exercise workout player, for
 * showing people before workouts open to members (plan.md, Phase 4.5).
 *
 * Unlike /workouts/[id] it needs no account: it's listed in proxy.ts's public
 * routes and skips the admin-only section lock. It only ever plays the one
 * workout below, and only while that workout is published — unpublish it in
 * the builder to take the demo down (admins still see a draft, badged).
 * Kept out of search results.
 */
const DEMO_WORKOUT_ID = "8ec0a458-29d2-465c-95d6-8bf61037736c"; // "Demo Workout"

export const metadata: Metadata = {
  title: "Demo workout · MoveMindful",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#14142B",
  colorScheme: "dark",
};

export default async function DemoWorkoutPage() {
  const viewer = await getViewerAccess();
  const workout = await getPlayerWorkout(DEMO_WORKOUT_ID, viewer.isAdmin);
  if (!workout) notFound();
  return <WorkoutPlayer workout={workout} backHref="/" />;
}
