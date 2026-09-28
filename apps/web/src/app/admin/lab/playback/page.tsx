import { PlaybackLab } from "@/components/admin/playback-lab";

export const dynamic = "force-dynamic";

// Unlinked test bench for the exercise-workout player (plan.md, Phase 4.5 step 1).
// Admin-only through the admin layout. Delete once the player is built.
export default async function PlaybackLabPage({
  searchParams,
}: {
  searchParams: Promise<{ clips?: string }>;
}) {
  const { clips } = await searchParams;
  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="text-3xl font-bold tracking-tight">Playback test</h1>
      <p className="mt-1 text-zinc-500">
        Checks how short clips loop and hand off before any exercise video is uploaded for real.
        Run it on your iPhone in Safari, again from the Home Screen app, and on a desktop browser.
      </p>
      <ol className="mt-4 list-decimal space-y-1 pl-5 text-sm text-zinc-600">
        <li>Open the player and tap to start. Watch each clip loop a few times — look for a hitch or flash where it restarts.</li>
        <li>Tap the right side to go to the next clip, the left to go back. Look for black frames between clips.</li>
        <li>Turn Sound on, then Auto-advance and don’t touch the screen: this is the “tutorial plays with sound without a tap” case.</li>
        <li>Switch between MP4 and HLS and repeat, then Copy results and paste them into the chat.</li>
      </ol>
      <div className="mt-8">
        <PlaybackLab initialText={clips} />
      </div>
    </div>
  );
}
