import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import {
  aboutMinutes,
  estimateWorkout,
  groupLabels,
  type EstimateExercise,
  type WorkoutBlock,
  type WorkoutMove,
} from "@move-mindful/core";
import { createAdminClient } from "@/lib/supabase/admin";
import { getExercises, getExerciseTags } from "@/lib/exercises/server";
import { DUMBBELL_LEVELS, EQUIPMENT_OPTIONS, equipmentLabel, formatDuration } from "@/lib/exercises/shared";
import { cleanBlocks, type ExerciseInfo } from "@/lib/workouts/clean";
import { toCatalog, toWorkout, type BlockRow, type WorkoutRow } from "@/lib/workouts/server";
import {
  BODYWEIGHT_ONLY,
  GENERATE_STYLES,
  LEVELS,
  type AdminWorkout,
  type CatalogExercise,
  type GenerateCriteria,
  type GenerateResult,
  type GeneratedWorkout,
  type WorkoutLevel,
} from "@/lib/workouts/shared";

/**
 * "Generate with AI" in the workout builder. Claude gets the exercise library
 * (only finished, unarchived exercises that fit the equipment on hand), the
 * published workouts as the house style, and the admin's criteria, and answers
 * in a JSON schema that mirrors the builder's sequence — with exercises named
 * by short keys from an enum, so it can only pick ones that exist. The reply
 * goes through the same cleaning as a save, and if it misses the target length
 * by much, Claude gets one chance to adjust it. Nothing is saved here: the
 * builder fills in and the admin reviews it.
 *
 * Needs ANTHROPIC_API_KEY (server-only). The builder pages allow 60 s
 * (`maxDuration`), which bounds the timeouts below.
 */

const MODEL = "claude-opus-5-5";
/** How many published workouts Claude sees as examples, newest first. */
const EXAMPLE_LIMIT = 20;
const FIRST_TIMEOUT_MS = 45_000;
/** A second pass to fix the length only runs if the first came back this fast. */
const RETRY_IF_UNDER_MS = 25_000;
const DEADLINE_MS = 55_000;

const SYSTEM = `You program follow-along workouts for Move Mindful, an on-demand video fitness platform. An instructor has asked you to draft a workout. They'll review it in the workout builder, adjust it and publish it themselves.

## How the player runs a workout
- The sequence plays top to bottom. Each block is one of:
  - exercise: one exercise for a number of sets, with restBetweenSets seconds of rest after every set but the last.
  - group: a superset (two exercises) or circuit (three or more). Members do each exercise once per round, for \`rounds\` rounds, with restBetweenExercises after each exercise except a round's last, and restBetweenRounds after every round but the final one. A group needs at least two exercises.
  - rest: a countdown of \`seconds\`.
- Rests only happen where you put them. Moving on to the next block has no rest of its own, so add a rest block (or use an exercise's or group's rest settings) wherever members need a breather.
- Each exercise is counted in reps or timed in seconds. Exercises marked "timed only" (holds, stretches) must be timed.
- For an exercise marked "each side", the amount is per side: members do all of it on one side, then all of it on the other. firstSide says which comes first; use "right" unless there's a reason not to.
- Members follow a looping demo video of each exercise and may watch its tutorial first. The warm-up is an optional video members can take before the workout; it isn't part of the sequence.

## Timing
The builder estimates a workout's length like this. When there's a target length, use the same arithmetic and check your total before you answer:
- A set counted in reps lasts reps × the exercise's pace (seconds per rep, listed with each exercise; assume 3 s when it's unknown). A timed set lasts its seconds. An "each side" exercise takes twice as long, since the amount is per side.
- Every set, and every exercise in every round of a group, adds 5 s to get into position, plus 3 s more for an "each side" exercise.
- Add every rest: restBetweenSets × (sets − 1), each rest block, and in a group restBetweenExercises × (exercises − 1) × rounds + restBetweenRounds × (rounds − 1).
- The warm-up and tutorials aren't counted.
Land within a minute of the target.

## House style
You'll be shown the workouts already published. They're the standard: study their titles and descriptions, how many exercises they use, their sets, reps, hold times and rests, how they order and group exercises, and where they place rests. Make the new workout feel like it belongs alongside them, unless the brief asks for something different, without copying any one of them.

## Programming
- Use only exercises from the library, by key. Every one listed is available.
- Build a sensible flow: a balance of movements across the workout, no hammering the same area back to back unless that's the point, and a calm finish (a stretch or hold, if the library has one) where it suits.
- Pitch the volume, difficulty and rests to the level. Beginners need fewer and simpler exercises, moderate reps and more rest.
- Most exercises have an intensity from 1 (gentle) to 4 (intense). Use it to give the workout a varied rhythm rather than a flat one: ease in, build, and ease off at the end; alternate harder and easier exercises, or pair a harder one with an easier one in a superset; and put more rest after the hardest stretches. Match the overall intensity to the level: mostly 1–2 for beginners, with the odd 3; more 3s and 4s for advanced. Where an exercise's intensity isn't set, judge it from its name.
- Anything in the brief marked "your call" is yours to decide: choose what best suits the rest of the brief and the house style.
- Follow the instructor's notes under "Anything else".

## What to write
- title: short (two to five words), like the published titles.
- description: one or two sentences for members, in the published workouts' voice.
- notes: one to three plain sentences for the instructor: the idea behind the workout and anything worth checking. Members never see it.`;

// ── The reply's shape ─────────────────────────────────

type RawMove = { exercise: string; measure: string; amount: number; firstSide: string };
type RawBlock =
  | ({ kind: "exercise"; sets: number; restBetweenSets: number } & RawMove)
  | { kind: "group"; rounds: number; restBetweenExercises: number; restBetweenRounds: number; moves: RawMove[] }
  | { kind: "rest"; seconds: number };
type RawWorkout = { notes: string; title: string; description: string; level: string; warmup: string; blocks: RawBlock[] };

function outputSchema(exerciseKeys: string[], warmupKeys: string[]) {
  const moveProps = {
    exercise: { type: "string", enum: exerciseKeys, description: "An exercise's key from the library, like e3." },
    measure: { type: "string", enum: ["reps", "time"], description: "Counted in reps, or timed. Timed-only exercises must be time." },
    amount: { type: "integer", description: "Reps, or seconds when timed. Per side for an each-side exercise." },
    firstSide: { type: "string", enum: ["right", "left"], description: "Which side goes first on an each-side exercise; right otherwise." },
  };
  const move = Object.keys(moveProps);
  const int = (description: string) => ({ type: "integer", description });
  return {
    type: "object",
    properties: {
      notes: { type: "string", description: "One to three plain sentences for the instructor. Members never see it." },
      title: { type: "string" },
      description: { type: "string" },
      level: { type: "string", enum: LEVELS.map((l) => l.id) },
      warmup: { type: "string", enum: [...warmupKeys, "none"], description: "A warm-up's key, or none." },
      blocks: {
        type: "array",
        description: "The sequence, top to bottom.",
        items: {
          anyOf: [
            {
              type: "object",
              properties: {
                kind: { type: "string", enum: ["exercise"] },
                ...moveProps,
                sets: int("How many sets."),
                restBetweenSets: int("Seconds of rest after every set but the last (0 for one set)."),
              },
              required: ["kind", ...move, "sets", "restBetweenSets"],
              additionalProperties: false,
            },
            {
              type: "object",
              properties: {
                kind: { type: "string", enum: ["group"] },
                rounds: int("How many rounds."),
                restBetweenExercises: int("Seconds of rest after each exercise except a round's last."),
                restBetweenRounds: int("Seconds of rest after every round but the final one."),
                moves: {
                  type: "array",
                  description: "Two exercises for a superset, three or more for a circuit.",
                  items: { type: "object", properties: moveProps, required: move, additionalProperties: false },
                },
              },
              required: ["kind", "rounds", "restBetweenExercises", "restBetweenRounds", "moves"],
              additionalProperties: false,
            },
            {
              type: "object",
              properties: { kind: { type: "string", enum: ["rest"] }, seconds: int("Seconds.") },
              required: ["kind", "seconds"],
              additionalProperties: false,
            },
          ],
        },
      },
    },
    required: ["notes", "title", "description", "level", "warmup", "blocks"],
    additionalProperties: false,
  };
}

/** The reply as builder blocks, before the same cleaning a save gets. */
function toBlocks(raw: RawBlock[], byKey: Map<string, CatalogExercise>): WorkoutBlock[] {
  const toMove = (m: RawMove): WorkoutMove | null => {
    const e = byKey.get(m?.exercise);
    if (!e) return null;
    // A timed-only exercise asked for in reps: time it, rather than read the rep count as seconds.
    const repsOnTimed = e.timedOnly && m.measure !== "time";
    return {
      exerciseId: e.id,
      measure: e.timedOnly || m.measure === "time" ? "time" : "reps",
      amount: repsOnTimed ? 30 : m.amount,
      firstSide: m.firstSide === "left" ? "left" : "right",
    };
  };
  const out: WorkoutBlock[] = [];
  for (const b of raw ?? []) {
    if (b?.kind === "rest") {
      out.push({ kind: "rest", seconds: b.seconds });
    } else if (b?.kind === "exercise") {
      const move = toMove(b);
      if (move) out.push({ kind: "exercise", move, sets: b.sets, restBetweenSets: b.sets > 1 ? b.restBetweenSets : 0 });
    } else if (b?.kind === "group") {
      const moves = (b.moves ?? []).map(toMove).filter((m): m is WorkoutMove => !!m);
      // A "group" of one is just an exercise done for that many sets.
      if (moves.length === 1) {
        out.push({ kind: "exercise", move: moves[0], sets: b.rounds, restBetweenSets: b.rounds > 1 ? b.restBetweenRounds : 0 });
      } else if (moves.length > 1) {
        out.push({
          kind: "group",
          rounds: b.rounds,
          restBetweenExercises: b.restBetweenExercises,
          restBetweenRounds: b.restBetweenRounds,
          moves,
        });
      }
    }
  }
  // A rest at either end is just dead time.
  while (out[0]?.kind === "rest") out.shift();
  while (out.at(-1)?.kind === "rest") out.pop();
  return out;
}

// ── The brief ─────────────────────────────────────────

function cleanCriteria(c: GenerateCriteria, tagIds: Set<string>, warmupIds: Set<string>): GenerateCriteria {
  const minutes = Math.round(Number(c?.minutes));
  const equipment = (c?.equipment ?? []).filter(
    (e) => e === BODYWEIGHT_ONLY || EQUIPMENT_OPTIONS.some((o) => o.id === e),
  );
  return {
    minutes: Number.isFinite(minutes) && minutes > 0 ? Math.min(minutes, 120) : null,
    level: LEVELS.some((l) => l.id === c?.level) ? c.level : null,
    focusTagIds: (c?.focusTagIds ?? []).filter((id) => tagIds.has(id)),
    equipment: equipment.includes(BODYWEIGHT_ONLY) ? [BODYWEIGHT_ONLY] : equipment,
    dumbbellLevels: equipment.includes("dumbbells")
      ? (c?.dumbbellLevels ?? []).filter((l) => DUMBBELL_LEVELS.some((d) => d.id === l))
      : [],
    style: GENERATE_STYLES.some((s) => s.id === c?.style) ? c.style : null,
    warmup: c?.warmup === "none" || warmupIds.has(c?.warmup) ? c.warmup : "auto",
    prompt: String(c?.prompt ?? "").trim().slice(0, 1500),
  };
}

/** Whether an exercise can be done with the equipment on hand (any, when none was given). */
function fitsEquipment(e: CatalogExercise, c: GenerateCriteria): boolean {
  if (!c.equipment.length) return true;
  if (!e.equipment.every((x) => c.equipment.includes(x))) return false;
  // Dumbbell exercises need one of the weights on hand, when the admin said which.
  if (e.equipment.includes("dumbbells") && c.dumbbellLevels.length && e.dumbbellLevels.length) {
    return e.dumbbellLevels.some((l) => c.dumbbellLevels.includes(l));
  }
  return true;
}

function equipmentText(equipment: string[], dumbbellLevels: string[]): string {
  if (!equipment.length) return "none";
  return equipment
    .map((x) =>
      x === "dumbbells" && dumbbellLevels.length ? `dumbbells (${dumbbellLevels.join("/")})` : equipmentLabel(x).toLowerCase(),
    )
    .join(", ");
}

function libraryLine(key: string, e: CatalogExercise, tags: string[]): string {
  const parts = [`${key}: ${e.name}`];
  if (tags.length) parts.push(`tags: ${tags.join(", ")}`);
  parts.push(`equipment: ${equipmentText(e.equipment, e.dumbbellLevels)}`);
  if (e.intensity) parts.push(`intensity ${e.intensity}`);
  if (e.sided) parts.push("each side");
  const pace = e.estimate.paceSeconds;
  parts.push(e.timedOnly ? "timed only" : `pace ${pace ? `${pace.toFixed(1)} s` : "unknown"} per rep`);
  return parts.join(" · ");
}

/** A published workout, written out the way the builder shows it. */
function describeWorkout(
  w: AdminWorkout,
  byId: Map<string, CatalogExercise>,
  estimates: Record<string, EstimateExercise>,
): string {
  const name = (id: string) => byId.get(id)?.name ?? "(a removed exercise)";
  // An exercise in the sequence, with its intensity so Claude can see the rhythm.
  const named = (id: string) => {
    const intensity = byId.get(id)?.intensity;
    return intensity ? `${name(id)} (intensity ${intensity})` : name(id);
  };
  const amount = (m: WorkoutMove) =>
    `${m.amount}${m.measure === "reps" ? " reps" : " s"}${byId.get(m.exerciseId)?.sided ? " each side" : ""}`;
  const labels = groupLabels(w.blocks);
  const minutes = aboutMinutes(estimateWorkout(w.blocks, estimates).totalSeconds);
  const lines = [
    `### ${w.title}`,
    `Level: ${w.level ?? "not set"} · about ${minutes} min · warm-up: ${w.warmupExerciseId ? name(w.warmupExerciseId) : "none"}`,
  ];
  if (w.description) lines.push(`Description: ${w.description}`);
  w.blocks.forEach((b, i) => {
    const n = `${i + 1}.`;
    if (b.kind === "rest") {
      lines.push(`${n} Rest ${b.seconds} s`);
    } else if (b.kind === "exercise") {
      const rest = b.sets > 1 ? `, ${b.restBetweenSets} s rest between sets` : "";
      lines.push(`${n} ${named(b.move.exerciseId)} — ${b.sets} × ${amount(b.move)}${rest}`);
    } else {
      lines.push(
        `${n} ${labels[i]}, ${b.rounds} rounds — ${b.restBetweenExercises} s rest between exercises, ${b.restBetweenRounds} s between rounds:`,
      );
      b.moves.forEach((m, j) => lines.push(`   ${String.fromCharCode(65 + j)}. ${named(m.exerciseId)} — ${amount(m)}`));
    }
  });
  return lines.join("\n");
}

async function publishedWorkouts(excludeId: string | null): Promise<AdminWorkout[]> {
  const supabase = createAdminClient();
  let query = supabase
    .from("workouts")
    .select("*")
    .not("published_at", "is", null)
    .order("published_at", { ascending: false })
    .limit(EXAMPLE_LIMIT);
  if (excludeId && /^[0-9a-f-]{36}$/i.test(excludeId)) query = query.neq("id", excludeId);
  const { data: workouts } = await query;
  const rows = (workouts ?? []) as WorkoutRow[];
  if (!rows.length) return [];
  const { data: blocks } = await supabase
    .from("workout_blocks")
    .select("*")
    .in("workout_id", rows.map((w) => w.id));
  return rows.map((w) => toWorkout(w, ((blocks ?? []) as BlockRow[]).filter((b) => b.workout_id === w.id)));
}

const STYLE_TEXT: Record<string, string> = {
  straight: "straight sets: single exercises for a few sets each, no supersets or circuits",
  supersets: "supersets: exercises in pairs",
  circuit: "a circuit: groups of three or more exercises, done for a few rounds",
  mix: "a mix of straight sets and supersets or circuits",
};

// ── Asking Claude ─────────────────────────────────────

class GenerateError extends Error {}

async function ask(
  client: Anthropic,
  messages: Anthropic.MessageParam[],
  schema: Record<string, unknown>,
  timeout: number,
): Promise<{ raw: RawWorkout; text: string }> {
  const res = await client.messages.create(
    {
      model: MODEL,
      max_tokens: 8000,
      system: SYSTEM,
      messages,
      output_config: { format: { type: "json_schema", schema } },
    },
    { timeout, maxRetries: 0 },
  );
  if (res.stop_reason === "refusal") throw new GenerateError("Claude wouldn't draft that one. Try rewording the brief.");
  if (res.stop_reason === "max_tokens") {
    throw new GenerateError("The workout came out too long to finish. Try a shorter length.");
  }
  const text = res.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
  try {
    return { raw: JSON.parse(text) as RawWorkout, text };
  } catch {
    throw new GenerateError("Claude's answer didn't come through properly. Try again.");
  }
}

function friendly(err: unknown): string {
  if (err instanceof GenerateError) return err.message;
  if (err instanceof Anthropic.APIConnectionTimeoutError) {
    return "Claude took too long to answer. Try again, or ask for something shorter.";
  }
  if (err instanceof Anthropic.APIError) {
    if (err.status === 401 || err.status === 403) return "The Anthropic API key was turned down. Check ANTHROPIC_API_KEY.";
    if (err.status === 429) return "Too many requests to Claude just now. Try again in a minute.";
    if (err.status === 529 || (err.status ?? 0) >= 500) return "Claude is busy right now. Try again in a moment.";
    return `Claude couldn't draft a workout: ${err.message}`;
  }
  return "Something went wrong drafting the workout. Try again.";
}

const clip = (s: unknown, max: number) => String(s ?? "").trim().slice(0, max);

export async function generateWorkoutDraft(input: GenerateCriteria, workoutId: string | null): Promise<GenerateResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return { error: "Generate with AI needs an Anthropic API key: set ANTHROPIC_API_KEY on the server." };
  }
  const started = Date.now();

  const [exercises, tags, examples] = await Promise.all([getExercises(), getExerciseTags(), publishedWorkouts(workoutId)]);
  const tagNames = new Map(tags.map((t) => [t.id, t.name]));
  const entries = exercises.map((e) => ({ catalog: toCatalog(e), tags: e.tagIds.map((id) => tagNames.get(id)).filter((t): t is string => !!t) }));
  const catalog = entries.map((x) => x.catalog);
  const byId = new Map(catalog.map((c) => [c.id, c]));
  const estimates: Record<string, EstimateExercise> = Object.fromEntries(catalog.map((c) => [c.id, c.estimate]));
  const info = new Map<string, ExerciseInfo>(catalog.map((c) => [c.id, { kind: c.kind, timed_only: c.timedOnly }]));

  const warmups = catalog.filter((c) => c.kind === "warmup" && c.playable && !c.archived);
  const criteria = cleanCriteria(input, new Set(tagNames.keys()), new Set(warmups.map((w) => w.id)));
  const usable = entries.filter(
    ({ catalog: c }) => c.kind === "exercise" && c.playable && !c.archived && fitsEquipment(c, criteria),
  );
  if (!usable.length) {
    return {
      error: criteria.equipment.length
        ? "No finished exercises fit that equipment. Add more, or leave Equipment blank."
        : "There are no finished exercises in the library yet.",
    };
  }

  // Short keys instead of ids: easier for Claude to keep straight, and the
  // schema's enum means it can only name exercises that are here.
  const byKey = new Map(usable.map((x, i) => [`e${i + 1}`, x.catalog]));
  const warmupByKey = new Map(warmups.map((w, i) => [`w${i + 1}`, w]));
  const keyOfWarmup = new Map([...warmupByKey].map(([k, w]) => [w.id, k]));

  // Blank fields are left to Claude.
  const call = (hint = "") => (hint ? `your call ${hint}` : "your call");
  const chosenWarmup = keyOfWarmup.get(criteria.warmup);
  const brief = [
    "## Exercise library",
    criteria.equipment.length
      ? "Only the exercises that fit the equipment on hand are listed."
      : "Every finished exercise is listed.",
    ...usable.map((x, i) => libraryLine(`e${i + 1}`, x.catalog, x.tags)),
    "",
    "## Warm-ups",
    ...(warmups.length
      ? [...warmupByKey].map(([k, w]) => `${k}: ${w.name} (${formatDuration(w.durationSeconds)})`)
      : ["None available."]),
    "",
    "## Published workouts",
    ...(examples.length
      ? examples.map((w) => describeWorkout(w, byId, estimates) + "\n")
      : ["None published yet, so there's no house style to match: keep the tone warm and plain.", ""]),
    "## The brief",
    `- Length: ${criteria.minutes ? `about ${criteria.minutes} min, by the builder's estimate` : call()}`,
    `- Level: ${criteria.level ?? call()}`,
    `- Focus: ${
      criteria.focusTagIds.length ? criteria.focusTagIds.map((id) => tagNames.get(id)).join(", ") : call()
    }`,
    `- Equipment on hand: ${
      criteria.equipment[0] === BODYWEIGHT_ONLY
        ? "none (bodyweight only)"
        : criteria.equipment.length
          ? equipmentText(criteria.equipment, criteria.dumbbellLevels)
          : call("(anything in the library)")
    }`,
    `- Style: ${criteria.style ? STYLE_TEXT[criteria.style] : call()}`,
    `- Warm-up: ${
      criteria.warmup === "none"
        ? `none (answer "none")`
        : chosenWarmup
          ? `already chosen: ${warmupByKey.get(chosenWarmup)?.name} (answer "${chosenWarmup}")`
          : warmups.length
            ? call(`(one of the warm-ups by key, or "none")`)
            : `none available (answer "none")`
    }`,
    `- Anything else: ${criteria.prompt ? `"${criteria.prompt}"` : "nothing"}`,
  ].join("\n");

  const schema = outputSchema([...byKey.keys()], [...warmupByKey.keys()]);
  const messages: Anthropic.MessageParam[] = [{ role: "user", content: brief }];
  const client = new Anthropic();

  const finish = (raw: RawWorkout): GeneratedWorkout => {
    const level: WorkoutLevel =
      criteria.level ?? (LEVELS.find((l) => l.id === raw.level)?.id as WorkoutLevel | undefined) ?? "beginner";
    return {
      title: clip(raw.title, 120),
      description: clip(raw.description, 2000),
      level,
      warmupExerciseId:
        criteria.warmup === "none" ? null : criteria.warmup !== "auto" ? criteria.warmup : (warmupByKey.get(raw.warmup)?.id ?? null),
      blocks: cleanBlocks(toBlocks(raw.blocks, byKey), info),
      notes: clip(raw.notes, 1000),
    };
  };
  const hasExercises = (w: GeneratedWorkout) => w.blocks.some((b) => b.kind !== "rest");

  try {
    const first = await ask(client, messages, schema, FIRST_TIMEOUT_MS);
    let workout = finish(first.raw);
    if (!hasExercises(workout)) return { error: "Claude came back without any exercises. Try again." };

    // Well off the target length, and time to spare: one chance to adjust.
    if (criteria.minutes) {
      const target = criteria.minutes * 60;
      const seconds = estimateWorkout(workout.blocks, estimates).totalSeconds;
      const off = Math.abs(seconds - target);
      const elapsed = Date.now() - started;
      if (off > Math.max(120, target * 0.15) && elapsed < RETRY_IF_UNDER_MS) {
        try {
          const second = await ask(
            client,
            [
              ...messages,
              { role: "assistant", content: first.text },
              {
                role: "user",
                content: `By the builder's estimate that comes to about ${aboutMinutes(seconds)} min, but the target is ${criteria.minutes} min. Adjust the sets, rounds, reps, hold times or rests to land within a minute of it, keeping the same exercises unless you have to change them. Answer with the whole workout again.`,
              },
            ],
            schema,
            DEADLINE_MS - elapsed,
          );
          const revised = finish(second.raw);
          const revisedOff = Math.abs(estimateWorkout(revised.blocks, estimates).totalSeconds - target);
          if (hasExercises(revised) && revisedOff < off) workout = revised;
        } catch (err) {
          // Keep the first version; it's still a usable draft.
          console.error("[generate-workout] length adjustment failed:", err);
        }
      }
    }
    return { workout };
  } catch (err) {
    console.error("[generate-workout]", err);
    return { error: friendly(err) };
  }
}
