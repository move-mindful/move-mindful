import type { WorkoutStep } from "@move-mindful/core";

export const ACCENT = "#A99CFF";

/**
 * The story-style bar across the top of the player: one segment per set, all
 * evenly spaced like Instagram's; a sided set's segment is split in two for
 * its sides. Rests aren't segments.
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
  // One entry per set, holding the step index of each of its sides.
  const sets: number[][] = [];
  steps.forEach((s, i) => {
    if (s.kind === "set") (sets[s.setIndex] ??= []).push(i);
  });

  return (
    <div className="flex h-1 gap-1" role="presentation">
      {sets.map((parts, k) => (
        <div key={k} className="flex min-w-0 gap-[1.5px]" style={{ flex: `${parts.length} 1 0px` }}>
          {parts.map((step, j) => (
            <Segment
              key={step}
              state={complete || (current !== null && step < current) ? "done" : step === current ? "now" : "todo"}
              fraction={fraction}
              radius={parts.length === 1 ? "2px" : j === 0 ? "2px 0 0 2px" : "0 2px 2px 0"}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

function Segment({ state, fraction, radius }: { state: "done" | "now" | "todo"; fraction: number | null; radius: string }) {
  // How far the segment on screen has filled, as a percentage (null otherwise).
  const percent =
    state === "now" && fraction !== null ? Math.round(Math.min(1, Math.max(0, fraction)) * 1000) / 10 : null;
  let inner: React.CSSProperties = { width: "0%" };
  if (state === "done") inner = { width: "100%", background: "#ffffff" };
  // White like the finished segments: it reads better over the video than the accent did.
  if (percent !== null) inner = { width: `${percent}%`, background: "#ffffff", transition: "width 250ms linear" };
  return (
    <div className="h-1 min-w-0 flex-1 overflow-hidden bg-white/30" style={{ borderRadius: radius }}>
      <div className="h-full" style={inner} />
    </div>
  );
}
