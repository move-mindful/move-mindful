import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { isAdmin } from "@/lib/auth/admin";
import { getPlayerWorkout } from "@/lib/workouts/member";
import { getPlayerPreferences } from "@/lib/member/preferences-server";
import { getLastCompleted, getSavedProgress } from "@/lib/member/sessions-server";
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
  const [admin, { userId }] = await Promise.all([isAdmin(), auth()]);
  const [workout, preferences, progress, lastDone] = await Promise.all([
    getPlayerWorkout(DEMO_WORKOUT_ID, admin),
    // Signed-out visitors keep their settings on the device only, and their
    // progress isn't saved.
    userId ? getPlayerPreferences(userId) : null,
    userId ? getSavedProgress(userId, DEMO_WORKOUT_ID) : null,
    userId ? getLastCompleted(userId, DEMO_WORKOUT_ID) : null,
  ]);
  if (!workout) notFound();
  return (
    <WorkoutPlayer
      workout={workout}
      backHref="/"
      preferences={preferences}
      progress={progress}
      lastDone={lastDone}
      signedIn={!!userId}
      // Every signed-out visitor is someone new being shown the player, so
      // the guide opens each time they begin (signed in, it's once, as usual).
      guideEveryTime={!userId}
    />
  );
}
