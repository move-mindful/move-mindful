"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  aboutMinutes,
  estimateWorkout,
  groupLabels,
  type EstimateExercise,
  type Measure,
  type Side,
  type WorkoutBlock,
  type WorkoutMove,
} from "@move-mindful/core";
import { deleteWorkout, saveWorkout, setWorkoutPublished } from "@/app/actions/workouts";
import { equipmentLabel, formatDuration, levelsLabel } from "@/lib/exercises/shared";
import {
  LEVELS,
  publishProblems,
  type AdminWorkout,
  type CatalogExercise,
  type WorkoutLevel,
} from "@/lib/workouts/shared";
import { ClipPreview } from "@/components/admin/exercises/clip-preview";
import { Flag, Section } from "@/components/admin/exercises/ui";
import { DurationInput, ExerciseSearch, Segmented, Stepper, Thumb } from "@/components/admin/workouts/fields";

// The builder keeps a stable key on every block and move so React can track
// rows as they're reordered; keys are stripped before saving.
type KMove = WorkoutMove & { key: string };
type KBlock =
  | { key: string; kind: "exercise"; move: KMove; sets: number }
  | { key: string; kind: "rest"; seconds: number }
  | { key: string; kind: "group"; rounds: number; restBetweenExercises: number; restBetweenRounds: number; moves: KMove[] };

let keySeed = 0;
const newKey = () => `k${++keySeed}`;

function withKeys(blocks: WorkoutBlock[]): KBlock[] {
  return blocks.map((b): KBlock => {
    if (b.kind === "exercise") return { ...b, key: newKey(), move: { ...b.move, key: newKey() } };
    if (b.kind === "group") return { ...b, key: newKey(), moves: b.moves.map((m) => ({ ...m, key: newKey() })) };
    return { ...b, key: newKey() };
  });
}

function stripKeys(blocks: KBlock[]): WorkoutBlock[] {
  const move = ({ exerciseId, measure, amount, firstSide }: KMove): WorkoutMove => ({ exerciseId, measure, amount, firstSide });
  return blocks.map((b): WorkoutBlock => {
    if (b.kind === "exercise") return { kind: "exercise", move: move(b.move), sets: b.sets };
    if (b.kind === "group") {
      return { kind: "group", rounds: b.rounds, restBetweenExercises: b.restBetweenExercises, restBetweenRounds: b.restBetweenRounds, moves: b.moves.map(move) };
    }
    return { kind: "rest", seconds: b.seconds };
  });
}

function newMove(e: CatalogExercise): KMove {
  return { key: newKey(), exerciseId: e.id, measure: e.timedOnly ? "time" : "reps", amount: e.timedOnly ? 30 : 10, firstSide: "right" };
}

function move<T>(list: T[], from: number, to: number): T[] {
  if (to < 0 || to >= list.length) return list;
  const copy = [...list];
  const [item] = copy.splice(from, 1);
  copy.splice(to, 0, item);
  return copy;
}

const iconBtn = "flex h-7 w-7 items-center justify-center rounded-md text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 disabled:opacity-30";

export function WorkoutBuilder({
  workout,
  catalog,
  instructors,
}: {
  workout: AdminWorkout | null;
  catalog: CatalogExercise[];
  instructors: Array<{ id: string; name: string }>;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(workout?.title ?? "");
  const [description, setDescription] = useState(workout?.description ?? "");
  const [level, setLevel] = useState<WorkoutLevel | null>(workout?.level ?? null);
  const [instructorId, setInstructorId] = useState<string | null>(workout?.instructorId ?? null);
  const [warmupId, setWarmupId] = useState<string | null>(workout?.warmupExerciseId ?? null);
  const [blocks, setBlocks] = useState<KBlock[]>(() => withKeys(workout?.blocks ?? []));
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [busy, setBusy] = useState<null | "save" | "publish">(null);
  const [error, setError] = useState<string | null>(null);

  const byId = new Map(catalog.map((c) => [c.id, c]));
  const estimates: Record<string, EstimateExercise> = Object.fromEntries(catalog.map((c) => [c.id, c.estimate]));
  const plain = stripKeys(blocks);
  const estimate = estimateWorkout(plain, estimates);
  const labels = groupLabels(plain);
  const problems = publishProblems(plain, byId, warmupId);
  const warmup = warmupId ? byId.get(warmupId) : undefined;
  const published = !!workout?.publishedAt;
  const preview = byId.get(previewId ?? "") ?? byId.get(firstExerciseId(plain) ?? "");

  // Equipment for "You'll need": every exercise in the sequence, plus the warm-up.
  const usedIds = new Set<string>(warmupId ? [warmupId] : []);
  for (const b of plain) {
    if (b.kind === "exercise") usedIds.add(b.move.exerciseId);
    if (b.kind === "group") b.moves.forEach((m) => usedIds.add(m.exerciseId));
  }
  const equipment = new Set<string>();
  const levels = new Set<string>();
  for (const id of usedIds) {
    byId.get(id)?.equipment.forEach((e) => equipment.add(e));
    byId.get(id)?.dumbbellLevels.forEach((l) => levels.add(l));
  }
  const needs = [...equipment].map((e) => (e === "dumbbells" && levels.size ? `Dumbbells (${levelsLabel([...levels])})` : equipmentLabel(e)));

  function update(key: string, change: (b: KBlock) => KBlock) {
    setBlocks((prev) => prev.map((b) => (b.key === key ? change(b) : b)));
  }

  function updateMove(blockKey: string, moveKey: string, change: Partial<KMove>) {
    update(blockKey, (b) => {
      if (b.kind === "exercise") return { ...b, move: { ...b.move, ...change } };
      if (b.kind === "group") return { ...b, moves: b.moves.map((m) => (m.key === moveKey ? { ...m, ...change } : m)) };
      return b;
    });
  }

  async function save(): Promise<string | null> {
    setError(null);
    const res = await saveWorkout({
      id: workout?.id,
      title,
      description,
      level,
      instructorId,
      warmupExerciseId: warmupId,
      blocks: plain,
    });
    if (res.error) setError(res.error);
    return res.error ? null : (res.id ?? null);
  }

  async function onSave() {
    setBusy("save");
    const id = await save();
    setBusy(null);
    if (!id) return;
    if (!workout) router.replace(`/admin/workouts/${id}`);
    else router.refresh();
  }

  async function onPublish(publish: boolean) {
    setBusy("publish");
    const id = await save();
    if (id) {
      const res = await setWorkoutPublished(id, publish);
      if (res.error) setError(res.error);
      if (!workout) router.replace(`/admin/workouts/${id}`);
      else router.refresh();
    }
    setBusy(null);
  }

  async function onDelete() {
    if (!workout || !window.confirm(`Delete “${workout.title}”? This can’t be undone.`)) return;
    const res = await deleteWorkout(workout.id);
    if (res.error) setError(res.error);
    else router.push("/admin/workouts");
  }

  const moveRow = (from: number, to: number) => setBlocks((prev) => move(prev, from, to));
  const remove = (key: string) => setBlocks((prev) => prev.filter((b) => b.key !== key));

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-sm text-zinc-500">
            <Link href="/admin/workouts" className="hover:text-zinc-800">
              Workouts
            </Link>{" "}
            / {workout ? workout.title : "New workout"}
          </p>
          <div className="mt-1 flex items-center gap-3">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Workout title"
              aria-label="Workout title"
              className="w-full max-w-md border-b border-dashed border-zinc-300 bg-transparent py-0.5 text-3xl font-bold tracking-tight focus:border-zinc-500 focus:outline-none"
            />
            <span
              className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                published ? "bg-emerald-100 text-emerald-700" : "bg-zinc-100 text-zinc-600"
              }`}
            >
              {published ? "Published" : "Draft"}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onSave}
            disabled={!!busy}
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium transition hover:bg-zinc-50 disabled:opacity-60"
          >
            {busy === "save" ? "Saving…" : published ? "Save changes" : "Save draft"}
          </button>
          <button
            type="button"
            onClick={() => onPublish(!published)}
            disabled={!!busy}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-700 disabled:opacity-60"
          >
            {busy === "publish" ? "Saving…" : published ? "Unpublish" : "Publish"}
          </button>
        </div>
      </div>

      {error && <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-6">
          <Section title="Details">
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-zinc-600">Description</span>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
              />
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-1.5">
                <span className="text-sm font-medium text-zinc-600">Level</span>
                <select
                  value={level ?? ""}
                  onChange={(e) => setLevel((e.target.value || null) as WorkoutLevel | null)}
                  className="h-10 w-full rounded-lg border border-zinc-300 bg-white px-2.5 text-sm"
                >
                  <option value="">Not set</option>
                  {LEVELS.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-medium text-zinc-600">Instructor</span>
                <select
                  value={instructorId ?? ""}
                  onChange={(e) => setInstructorId(e.target.value || null)}
                  className="h-10 w-full rounded-lg border border-zinc-300 bg-white px-2.5 text-sm"
                >
                  <option value="">Not set</option>
                  {instructors.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </Section>

          <Section title="Sequence" aside="Rests only happen where you add them">
            {/* Warm-up: optional, pinned first */}
            <div className="flex flex-wrap items-center gap-3 rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-3">
              <Flag>Warm-up</Flag>
              <select
                aria-label="Warm-up"
                value={warmupId ?? ""}
                onChange={(e) => setWarmupId(e.target.value || null)}
                className="h-9 min-w-48 flex-1 rounded-lg border border-zinc-300 bg-white px-2.5 text-sm"
              >
                <option value="">No warm-up</option>
                {catalog
                  .filter((c) => c.kind === "warmup" && (!c.archived || c.id === warmupId))
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} · {formatDuration(c.durationSeconds)}
                    </option>
                  ))}
              </select>
              <span className="text-xs text-zinc-500">Optional for members · not counted in the workout time</span>
            </div>

            {blocks.length === 0 && (
              <p className="rounded-lg border border-zinc-200 px-4 py-8 text-center text-sm text-zinc-500">
                Search below to add the first exercise.
              </p>
            )}

            <ol className="space-y-2">
              {blocks.map((b, i) => (
                <li key={b.key}>
                  <BlockFrame
                    tone={b.kind}
                    onUp={() => moveRow(i, i - 1)}
                    onDown={() => moveRow(i, i + 1)}
                    onRemove={() => remove(b.key)}
                    first={i === 0}
                    last={i === blocks.length - 1}
                    seconds={estimateWorkout([plain[i]], estimates).totalSeconds}
                  >
                    {b.kind === "rest" ? (
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-semibold">Rest</span>
                        <DurationInput
                          label="Rest length"
                          seconds={b.seconds}
                          onChange={(seconds) => update(b.key, (x) => ({ ...x, seconds }) as KBlock)}
                        />
                        <span className="text-xs text-zinc-500">Countdown with Pause and Continue</span>
                      </div>
                    ) : b.kind === "exercise" ? (
                      <MoveFields
                        move={b.move}
                        exercise={byId.get(b.move.exerciseId)}
                        onPreview={() => setPreviewId(b.move.exerciseId)}
                        onChange={(change) => updateMove(b.key, b.move.key, change)}
                        sets={{ value: b.sets, onChange: (sets) => update(b.key, (x) => ({ ...x, sets }) as KBlock) }}
                      />
                    ) : (
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                          <span className="font-semibold">{labels[i]}</span>
                          <Labelled label="Rounds">
                            <Stepper
                              label="Rounds"
                              value={b.rounds}
                              onChange={(rounds) => update(b.key, (x) => ({ ...x, rounds }) as KBlock)}
                            />
                          </Labelled>
                          <Labelled label="Between exercises">
                            <DurationInput
                              label="Rest between exercises"
                              seconds={b.restBetweenExercises}
                              onChange={(s) => update(b.key, (x) => ({ ...x, restBetweenExercises: s }) as KBlock)}
                            />
                          </Labelled>
                          <Labelled label="Between rounds">
                            <DurationInput
                              label="Rest between rounds"
                              seconds={b.restBetweenRounds}
                              onChange={(s) => update(b.key, (x) => ({ ...x, restBetweenRounds: s }) as KBlock)}
                            />
                          </Labelled>
                        </div>
                        <ol className="space-y-1.5 border-l-2 border-zinc-200 pl-3">
                          {b.moves.map((m, j) => (
                            <li key={m.key} className="flex items-center gap-2">
                              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-zinc-100 text-xs font-bold">
                                {String.fromCharCode(65 + j)}
                              </span>
                              <div className="min-w-0 flex-1">
                                <MoveFields
                                  move={m}
                                  exercise={byId.get(m.exerciseId)}
                                  onPreview={() => setPreviewId(m.exerciseId)}
                                  onChange={(change) => updateMove(b.key, m.key, change)}
                                />
                              </div>
                              <span className="flex shrink-0">
                                <button type="button" aria-label="Move up" disabled={j === 0} className={iconBtn}
                                  onClick={() => update(b.key, (x) => (x.kind === "group" ? { ...x, moves: move(x.moves, j, j - 1) } : x))}>↑</button>
                                <button type="button" aria-label="Move down" disabled={j === b.moves.length - 1} className={iconBtn}
                                  onClick={() => update(b.key, (x) => (x.kind === "group" ? { ...x, moves: move(x.moves, j, j + 1) } : x))}>↓</button>
                                <button type="button" aria-label="Remove from group" className={iconBtn}
                                  onClick={() => update(b.key, (x) => (x.kind === "group" ? { ...x, moves: x.moves.filter((y) => y.key !== m.key) } : x))}>×</button>
                              </span>
                            </li>
                          ))}
                          <li className="max-w-sm">
                            <ExerciseSearch
                              compact
                              catalog={catalog}
                              placeholder={b.moves.length < 2 ? "Add an exercise to this group…" : "Add another exercise…"}
                              onPick={(e) => update(b.key, (x) => (x.kind === "group" ? { ...x, moves: [...x.moves, newMove(e)] } : x))}
                            />
                          </li>
                        </ol>
                      </div>
                    )}
                  </BlockFrame>
                </li>
              ))}
            </ol>

            <div className="flex flex-wrap gap-2 border-t border-zinc-100 pt-4">
              <div className="min-w-64 flex-1">
                <ExerciseSearch
                  catalog={catalog}
                  placeholder="Add an exercise — type to search"
                  onPick={(e) => setBlocks((prev) => [...prev, { key: newKey(), kind: "exercise", move: newMove(e), sets: 1 }])}
                />
              </div>
              <button
                type="button"
                onClick={() => setBlocks((prev) => [...prev, { key: newKey(), kind: "rest", seconds: 60 }])}
                className="h-11 rounded-lg border border-zinc-300 px-4 text-sm font-medium hover:bg-zinc-50"
              >
                + Rest
              </button>
              <button
                type="button"
                onClick={() =>
                  setBlocks((prev) => [
                    ...prev,
                    { key: newKey(), kind: "group", rounds: 3, restBetweenExercises: 15, restBetweenRounds: 45, moves: [] },
                  ])
                }
                className="h-11 rounded-lg border border-zinc-300 px-4 text-sm font-medium hover:bg-zinc-50"
              >
                + Superset / circuit
              </button>
            </div>
          </Section>

          {workout && (
            <div className="flex items-center justify-between rounded-xl border border-zinc-200 p-4">
              <span className="text-sm text-zinc-600">Deleting removes the workout for good. The exercises stay in the library.</span>
              <button
                type="button"
                onClick={onDelete}
                className="rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50"
              >
                Delete workout
              </button>
            </div>
          )}
        </div>

        <aside className="space-y-6">
          <Section title="Estimated time">
            <div>
              <p className="text-4xl font-semibold tracking-tight">
                {estimate.totalSeconds ? `${aboutMinutes(estimate.totalSeconds)} min` : "—"}
              </p>
              {estimate.tutorialSeconds > 0 && (
                <p className="text-sm text-zinc-500">+{aboutMinutes(estimate.tutorialSeconds)} min with tutorials</p>
              )}
              {warmup && (
                <p className="text-sm text-zinc-500">+{formatDuration(warmup.durationSeconds)} if members take the warm-up</p>
              )}
            </div>
            <dl className="space-y-1.5 text-sm">
              {(
                [
                  ["Exercise", estimate.exerciseSeconds],
                  ["Rest", estimate.restSeconds],
                  ["Transitions", estimate.transitionSeconds],
                ] as const
              ).map(([k, v]) => (
                <div key={k} className="flex justify-between">
                  <dt className="text-zinc-600">{k}</dt>
                  <dd className="tabular-nums">{formatDuration(v)}</dd>
                </div>
              ))}
              <div className="flex justify-between border-t border-zinc-100 pt-1.5 font-semibold">
                <dt>Total</dt>
                <dd className="tabular-nums">{formatDuration(estimate.totalSeconds)}</dd>
              </div>
            </dl>
            {needs.length > 0 && <p className="text-sm text-zinc-600">You’ll need: {needs.join(", ")}</p>}
            <p className="text-xs text-zinc-500">Transitions add 5 s per set and 3 s per side switch.</p>
            {estimate.missingPace.length > 0 && (
              <p className="text-xs text-amber-700">
                No pace yet for {estimate.missingPace.map((id) => byId.get(id)?.name ?? "an exercise").join(", ")} — using 3 s per
                rep. Add its reps in clip in the exercise library.
              </p>
            )}
          </Section>

          {!published && problems.length > 0 && (
            <section className="space-y-1.5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <p className="font-semibold">Before you can publish</p>
              <ul className="list-disc space-y-0.5 pl-5">
                {problems.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </section>
          )}

          {preview && (
            <Section title="Preview">
              <p className="-mt-2 text-sm font-semibold">{preview.name}</p>
              <ClipPreview key={preview.id} kind={preview.kind} sided={preview.sided} videos={preview.videos} />
              <Link href={`/admin/exercises/${preview.id}`} className="block text-sm font-semibold text-zinc-700 hover:underline">
                Edit in the exercise library →
              </Link>
            </Section>
          )}
        </aside>
      </div>
    </div>
  );
}

function firstExerciseId(blocks: WorkoutBlock[]): string | null {
  for (const b of blocks) {
    if (b.kind === "exercise") return b.move.exerciseId;
    if (b.kind === "group" && b.moves[0]) return b.moves[0].exerciseId;
  }
  return null;
}

function Labelled({ label, children }: { label: string; children: ReactNode }) {
  return (
    <span className="flex items-center gap-1.5 text-xs text-zinc-500">
      {label}
      {children}
    </span>
  );
}

function BlockFrame({
  tone,
  children,
  onUp,
  onDown,
  onRemove,
  first,
  last,
  seconds,
}: {
  tone: KBlock["kind"];
  children: ReactNode;
  onUp: () => void;
  onDown: () => void;
  onRemove: () => void;
  first: boolean;
  last: boolean;
  seconds: number;
}) {
  const toneCls = {
    exercise: "border-zinc-200 bg-white",
    rest: "border-dashed border-zinc-300 bg-zinc-50",
    group: "border-zinc-300 bg-white ring-1 ring-zinc-900/5",
  }[tone];
  return (
    <div className={`flex items-start gap-2 rounded-xl border p-2.5 ${toneCls}`}>
      <span className="flex flex-col">
        <button type="button" aria-label="Move up" disabled={first} onClick={onUp} className={iconBtn}>
          ↑
        </button>
        <button type="button" aria-label="Move down" disabled={last} onClick={onDown} className={iconBtn}>
          ↓
        </button>
      </span>
      <div className="min-w-0 flex-1 py-1">{children}</div>
      <span className="w-12 shrink-0 pt-2 text-right text-sm tabular-nums text-zinc-500">{formatDuration(seconds)}</span>
      <button type="button" aria-label="Remove" onClick={onRemove} className={`${iconBtn} mt-1`}>
        ×
      </button>
    </div>
  );
}

function MoveFields({
  move: m,
  exercise,
  onPreview,
  onChange,
  sets,
}: {
  move: KMove;
  exercise: CatalogExercise | undefined;
  onPreview: () => void;
  onChange: (change: Partial<KMove>) => void;
  sets?: { value: number; onChange: (value: number) => void };
}) {
  const sided = !!exercise?.sided;
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <Thumb exercise={exercise} onClick={onPreview} />
      <span className="min-w-32 flex-1">
        <span className="flex items-center gap-1.5">
          <button type="button" onClick={onPreview} className="truncate text-left font-semibold hover:underline">
            {exercise?.name ?? "Missing exercise"}
          </button>
          {sided && <Flag>R + L</Flag>}
          {exercise && !exercise.playable && <Flag>Missing clip</Flag>}
          {exercise?.archived && <Flag>Archived</Flag>}
        </span>
      </span>
      {sets && (
        <span className="flex items-center gap-1.5 text-xs text-zinc-500">
          Sets
          <Stepper label="Sets" value={sets.value} onChange={sets.onChange} />
        </span>
      )}
      <Segmented<Measure>
        label="Counted by"
        value={m.measure}
        onChange={(measure) => onChange({ measure, amount: measure === "time" ? 30 : 10 })}
        options={[
          { id: "reps", label: "Reps", disabled: exercise?.timedOnly },
          { id: "time", label: "Time" },
        ]}
      />
      <span className="flex items-center gap-1.5 text-xs text-zinc-500">
        {m.measure === "reps" ? (
          <input
            aria-label="Reps"
            inputMode="numeric"
            value={m.amount}
            onChange={(e) => onChange({ amount: Math.max(1, Number(e.target.value.replace(/[^0-9]/g, "")) || 1) })}
            className="h-8 w-12 rounded-md border border-zinc-300 px-2 text-sm font-semibold tabular-nums"
          />
        ) : (
          <DurationInput label="Time" seconds={m.amount} onChange={(amount) => onChange({ amount: Math.max(1, amount) })} className="w-14" />
        )}
        {m.measure === "reps" ? "reps" : ""}
        {sided ? " each side" : ""}
      </span>
      {sided && (
        <Segmented<Side>
          label="First side"
          value={m.firstSide}
          onChange={(firstSide) => onChange({ firstSide })}
          options={[
            { id: "right", label: "Right first" },
            { id: "left", label: "Left first" },
          ]}
        />
      )}
    </div>
  );
}
