import type { WorkoutStep } from "@move-mindful/core";

export const ACCENT = "#A99CFF";

/** How the current segment is filled: a set in progress, or its tutorial (striped). */
export type SegmentFill = { kind: "set" | "tutorial"; fraction: number };

interface Part {
  step: number;
}

/**
 * The story-style bar across the top of the player: one segment per set,
 * split in two for a sided set's sides, grouped by round and by block (the
 * gaps widen at each level). Rests aren't segments.
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
  // block → round → move → parts
  const blocks: Part[][][][] = [];
  const index = new Map<string, Part[]>();
  steps.forEach((s, i) => {
    if (s.kind !== "set") return;
    const key = `${s.block}:${s.round}:${s.move}`;
    let parts = index.get(key);
    if (!parts) {
      parts = [];
      index.set(key, parts);
      const block = (blocks[s.block] ??= []);
      const round = (block[s.round - 1] ??= []);
      round.push(parts);
    }
    parts.push({ step: i });
  });
  const count = (parts: Part[][]) => parts.reduce((n, p) => n + p.length, 0);

  return (
    <div className="flex h-1 gap-2.5" role="presentation">
      {blocks.filter(Boolean).map((rounds, b) => (
        <div key={b} className="flex min-w-0 gap-[5px]" style={{ flex: `${rounds.reduce((n, r) => n + count(r), 0)} 1 0px` }}>
          {rounds.map((moves, r) => (
            <div key={r} className="flex min-w-0 gap-0.5" style={{ flex: `${count(moves)} 1 0px` }}>
              {moves.map((parts, m) => (
                <div key={m} className="flex min-w-0 gap-px" style={{ flex: `${parts.length} 1 0px` }}>
                  {parts.map((p, j) => (
                    <Segment
                      key={p.step}
                      state={complete || (current !== null && p.step < current) ? "done" : p.step === current ? "now" : "todo"}
                      fill={fill}
                      radius={parts.length === 1 ? "2px" : j === 0 ? "2px 0 0 2px" : "0 2px 2px 0"}
                    />
                  ))}
                </div>
              ))}
            </div>
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
