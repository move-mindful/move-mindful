import type { WorkoutStep } from "@move-mindful/core";

/**
 * The player's accent where it's set in code rather than a class: violet-400,
 * the lighter of the profile ring's violets, so it reads on the dark screens
 * (Oct 2026; it was a lavender, #A99CFF). Fills use violet-500.
 */
export const ACCENT = "var(--color-violet-400, #A684FF)";

/**
 * The story-style bar across the top of the player: one segment per set, all
 * evenly spaced like Instagram's; each side of a sided set is a segment of its
 * own. Rests aren't segments.
 *
 * `current` is the step on screen: segments before it are white, its own is
 * filled to `fraction` (the set itself only — tutorials and Get ready leave it
 * empty, so it never runs backwards), and `complete` fills them all.
 */
export function ProgressBar({
  steps,
  current,
  fraction,
  complete = false,
}: {
  steps: WorkoutStep[];
  current: number | null;
  fraction: number | null;
  complete?: boolean;
}) {
  // The step index of every set (and of each side).
  const sets = steps.flatMap((s, i) => (s.kind === "set" ? [i] : []));

  return (
    <div className="flex h-1 gap-1" role="presentation">
      {sets.map((step) => (
        <Segment
          key={step}
          state={complete || (current !== null && step < current) ? "done" : step === current ? "now" : "todo"}
          fraction={fraction}
        />
      ))}
    </div>
  );
}

function Segment({ state, fraction }: { state: "done" | "now" | "todo"; fraction: number | null }) {
  // How far the segment on screen has filled, as a percentage (null otherwise).
  const percent =
    state === "now" && fraction !== null ? Math.round(Math.min(1, Math.max(0, fraction)) * 1000) / 10 : null;
  let inner: React.CSSProperties = { width: "0%" };
  if (state === "done") inner = { width: "100%", background: "#ffffff" };
  // White like the finished segments: it reads better over the video than the accent did.
  if (percent !== null) inner = { width: `${percent}%`, background: "#ffffff", transition: "width 250ms linear" };
  return (
    <div className="h-1 min-w-0 flex-1 overflow-hidden rounded-[2px] bg-white/30">
      <div className="h-full" style={inner} />
    </div>
  );
}
