import "server-only";

import type { Side, WorkoutBlock, WorkoutMove } from "@move-mindful/core";

// The server's own check on a sequence, whoever wrote it — the builder on
// save, or Claude via "Generate with AI": known exercises only, sane numbers,
// and a timed-only exercise can't be counted in reps.

export type ExerciseInfo = { kind: string; timed_only: boolean };

function int(value: unknown, min: number, max: number, fallback: number): number {
  const n = Math.round(Number(value));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}

function cleanMove(m: WorkoutMove, info: Map<string, ExerciseInfo>): WorkoutMove | null {
  const ex = info.get(m?.exerciseId);
  if (!ex || ex.kind !== "exercise") return null;
  const measure = ex.timed_only || m.measure === "time" ? "time" : "reps";
  return {
    exerciseId: m.exerciseId,
    measure,
    amount: measure === "time" ? int(m.amount, 1, 3600, 30) : int(m.amount, 1, 999, 10),
    firstSide: (m.firstSide === "left" ? "left" : "right") as Side,
  };
}

export function cleanBlocks(blocks: WorkoutBlock[], info: Map<string, ExerciseInfo>): WorkoutBlock[] {
  const out: WorkoutBlock[] = [];
  for (const b of blocks ?? []) {
    if (b?.kind === "rest") {
      out.push({ kind: "rest", seconds: int(b.seconds, 1, 3600, 60) });
    } else if (b?.kind === "exercise") {
      const move = cleanMove(b.move, info);
      if (move) {
        out.push({ kind: "exercise", move, sets: int(b.sets, 1, 20, 1), restBetweenSets: int(b.restBetweenSets, 0, 600, 0) });
      }
    } else if (b?.kind === "group") {
      out.push({
        kind: "group",
        rounds: int(b.rounds, 1, 20, 3),
        restBetweenExercises: int(b.restBetweenExercises, 0, 600, 0),
        restBetweenRounds: int(b.restBetweenRounds, 0, 600, 0),
        moves: (b.moves ?? []).map((m) => cleanMove(m, info)).filter((m): m is WorkoutMove => !!m),
      });
    }
  }
  return out;
}
