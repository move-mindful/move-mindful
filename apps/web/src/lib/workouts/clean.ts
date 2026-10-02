import "server-only";

import { VOICE_LEVELS_PER_SECOND, type Side, type TipMap, type WorkoutBlock, type WorkoutMove } from "@move-mindful/core";
import { TIP_MAX_SECONDS } from "@/lib/workouts/shared";

// The server's own check on a sequence, whoever wrote it — the builder on
// save, or Claude via "Generate with AI": known exercises only, sane numbers,
// and a timed-only exercise can't be counted in reps. Audio tips are kept
// only when they're this workout's own recordings (`tipFolder`); without one
// (a generated draft), none are.

export type ExerciseInfo = { kind: string; timed_only: boolean };

function int(value: unknown, min: number, max: number, fallback: number): number {
  const n = Math.round(Number(value));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}

// Slot keys (TipMap in core): "rest", "2", "2:left", "2:1".
const TIP_KEY = /^(rest|\d{1,2}(:(right|left|\d{1,2}))?)$/;
const TIP_FILE = /^[0-9a-f-]{36}\/[0-9a-f-]{36}\.m4a$/;
// One character per reading (encodeVoiceLevels in core): up to TIP_MAX_SECONDS and then some.
const TIP_LEVELS = new RegExp(`^[0-9a-z]{1,${(TIP_MAX_SECONDS + 10) * VOICE_LEVELS_PER_SECOND}}$`);

/**
 * Tips as stored or sent: well-formed ones only (and, with `folder`, only
 * that workout's files). Undefined when none are left.
 */
export function readTips(value: unknown, folder?: string): TipMap | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const out: TipMap = {};
  for (const [key, tip] of Object.entries(value as Record<string, unknown>)) {
    const t = tip as { id?: unknown; seconds?: unknown } | null;
    const seconds = Number(t?.seconds);
    if (!TIP_KEY.test(key) || typeof t?.id !== "string" || !TIP_FILE.test(t.id) || !Number.isFinite(seconds)) continue;
    if (folder !== undefined && !t.id.startsWith(`${folder}/`)) continue;
    out[key] = { id: t.id, seconds: Math.min(600, Math.max(0, Math.round(seconds * 10) / 10)) };
    // The speech within the file, when it's been trimmed.
    const start = Number((tip as { start?: unknown }).start);
    const end = Number((tip as { end?: unknown }).end);
    if (Number.isFinite(start) && Number.isFinite(end) && start >= 0 && end > start && end <= 600) {
      out[key].start = Math.round(start * 100) / 100;
      out[key].end = Math.round(end * 100) / 100;
    }
    // The voice's loudness through the file, for the player's equalizer bars.
    const levels = (tip as { levels?: unknown }).levels;
    if (typeof levels === "string" && TIP_LEVELS.test(levels)) out[key].levels = levels;
  }
  return Object.keys(out).length ? out : undefined;
}

function cleanMove(m: WorkoutMove, info: Map<string, ExerciseInfo>, tipFolder: string | null): WorkoutMove | null {
  const ex = info.get(m?.exerciseId);
  if (!ex || ex.kind !== "exercise") return null;
  const measure = ex.timed_only || m.measure === "time" ? "time" : "reps";
  const tips = tipFolder ? readTips(m.tips, tipFolder) : undefined;
  return {
    exerciseId: m.exerciseId,
    measure,
    amount: measure === "time" ? int(m.amount, 1, 3600, 30) : int(m.amount, 1, 999, 10),
    firstSide: (m.firstSide === "left" ? "left" : "right") as Side,
    ...(tips && { tips }),
  };
}

export function cleanBlocks(
  blocks: WorkoutBlock[],
  info: Map<string, ExerciseInfo>,
  { tipFolder = null }: { tipFolder?: string | null } = {},
): WorkoutBlock[] {
  const out: WorkoutBlock[] = [];
  for (const b of blocks ?? []) {
    const restTips = tipFolder ? readTips(b?.restTips, tipFolder) : undefined;
    const withRestTips = restTips ? { restTips } : {};
    if (b?.kind === "rest") {
      out.push({ kind: "rest", seconds: int(b.seconds, 1, 3600, 60), ...withRestTips });
    } else if (b?.kind === "exercise") {
      const move = cleanMove(b.move, info, tipFolder);
      if (move) {
        out.push({
          kind: "exercise",
          move,
          sets: int(b.sets, 1, 20, 1),
          restBetweenSets: int(b.restBetweenSets, 0, 600, 0),
          ...withRestTips,
        });
      }
    } else if (b?.kind === "group") {
      out.push({
        kind: "group",
        rounds: int(b.rounds, 1, 20, 3),
        restBetweenExercises: int(b.restBetweenExercises, 0, 600, 0),
        restBetweenRounds: int(b.restBetweenRounds, 0, 600, 0),
        moves: (b.moves ?? []).map((m) => cleanMove(m, info, tipFolder)).filter((m): m is WorkoutMove => !!m),
        ...withRestTips,
      });
    }
  }
  return out;
}
