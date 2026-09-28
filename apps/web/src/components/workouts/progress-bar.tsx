import type { WorkoutStep } from "@move-mindful/core";

export const ACCENT = "#A99CFF";

/** How the current segment is filled: a set in progress, or its tutorial (striped). */
export type SegmentFill = { kind: "set" | "tutorial"; fraction: number };

/**
 * The story-style bar across the top of the player: one segment per set, all
 * evenly spaced like Instagram's; a sided set's segment is split in two for
 * its sides. Rests aren't segments.
 *
 * `current` is the step on screen: segments before it are white, its own is
 * filled per `fill`, and `complete` fills them all.
 */
export function ProgressBar({
  steps,
  current,
  fill,
  complete = false,
}: {
  steps: WorkoutStep[];
  current: number | null;
  fill: SegmentFill | null;
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
              fill={fill}
              radius={parts.length === 1 ? "2px" : j === 0 ? "2px 0 0 2px" : "0 2px 2px 0"}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

function Segment({ state, fill, radius }: { state: "done" | "now" | "todo"; fill: SegmentFill | null; radius: string }) {
  let inner: React.CSSProperties = { width: "0%" };
  if (state === "done") inner = { width: "100%", background: "#ffffff" };
  if (state === "now" && fill) {
    inner = {
      width: `${Math.round(Math.min(1, Math.max(0, fill.fraction)) * 1000) / 10}%`,
      background:
        fill.kind === "tutorial"
          ? `repeating-linear-gradient(-45deg, ${ACCENT} 0px 3px, rgba(169,156,255,0.35) 3px 6px)`
          : ACCENT,
      transition: "width 250ms linear",
    };
  }
  return (
    <div className="h-1 min-w-0 flex-1 overflow-hidden bg-white/30" style={{ borderRadius: radius }}>
      <div className="h-full" style={inner} />
    </div>
  );
}
