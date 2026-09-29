"use client";

import { useEffect, useState, type ReactNode } from "react";
import { DUMBBELL_LEVELS, EQUIPMENT_OPTIONS, formatDuration, type ExerciseTag } from "@/lib/exercises/shared";
import {
  BODYWEIGHT_ONLY,
  GENERATE_STYLES,
  LEVELS,
  type CatalogExercise,
  type GenerateCriteria,
} from "@/lib/workouts/shared";

const LENGTHS = [10, 15, 20, 30];

/**
 * The builder's "Generate with AI" window: a few optional choices and a box
 * for anything else. Every chip toggles, so a second tap puts a field back to
 * blank — Claude's call. Closing it while Claude is working abandons the
 * result (the builder ignores it).
 */
export function GenerateDialog({
  initial,
  tags,
  warmups,
  replacing,
  busy,
  error,
  onGenerate,
  onClose,
}: {
  initial: GenerateCriteria;
  tags: ExerciseTag[];
  warmups: CatalogExercise[];
  /** The builder already has a sequence, which this replaces. */
  replacing: boolean;
  busy: boolean;
  error: string | null;
  onGenerate: (criteria: GenerateCriteria) => void;
  onClose: () => void;
}) {
  const [c, setC] = useState(initial);
  const [otherLength, setOtherLength] = useState(
    initial.minutes && !LENGTHS.includes(initial.minutes) ? String(initial.minutes) : "",
  );
  const set = (change: Partial<GenerateCriteria>) => setC((prev) => ({ ...prev, ...change }));
  const toggle = (list: string[], id: string) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // "Bodyweight only" and the equipment are either/or.
  function toggleEquipment(id: string) {
    if (id === BODYWEIGHT_ONLY) {
      set({ equipment: c.equipment.includes(id) ? [] : [id], dumbbellLevels: [] });
    } else {
      const equipment = toggle(c.equipment.filter((x) => x !== BODYWEIGHT_ONLY), id);
      set({ equipment, dumbbellLevels: equipment.includes("dumbbells") ? c.dumbbellLevels : [] });
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/40 p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="generate-title"
        className="flex max-h-[calc(100dvh-2rem)] w-full max-w-xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
      >
        <div className="border-b border-zinc-100 px-6 py-4">
          <h2 id="generate-title" className="text-lg font-semibold">
            ✦ Generate with AI
          </h2>
          <p className="mt-0.5 text-sm text-zinc-500">
            Anything you leave blank is Claude’s call. It studies your published workouts to match their style.
          </p>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onGenerate(c);
          }}
          className="flex min-h-0 flex-1 flex-col"
        >
          <fieldset disabled={busy} className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5">
            <Row label="Length">
              {LENGTHS.map((m) => (
                <Chip
                  key={m}
                  on={c.minutes === m && !otherLength}
                  onClick={() => {
                    setOtherLength("");
                    set({ minutes: c.minutes === m && !otherLength ? null : m });
                  }}
                >
                  {m} min
                </Chip>
              ))}
              <span className="flex items-center gap-1.5 text-sm text-zinc-500">
                <input
                  aria-label="Another length, in minutes"
                  inputMode="numeric"
                  placeholder="Other"
                  value={otherLength}
                  onChange={(e) => {
                    const text = e.target.value.replace(/[^0-9]/g, "").slice(0, 3);
                    setOtherLength(text);
                    set({ minutes: text ? Number(text) : null });
                  }}
                  className="h-8 w-16 rounded-full border border-zinc-300 px-3 text-sm tabular-nums focus:border-zinc-500 focus:outline-none"
                />
                min
              </span>
            </Row>

            <Row label="Level">
              {LEVELS.map((l) => (
                <Chip key={l.id} on={c.level === l.id} onClick={() => set({ level: c.level === l.id ? null : l.id })}>
                  {l.label}
                </Chip>
              ))}
            </Row>

            {tags.length > 0 && (
              <Row label="Focus">
                {tags.map((t) => (
                  <Chip
                    key={t.id}
                    on={c.focusTagIds.includes(t.id)}
                    onClick={() => set({ focusTagIds: toggle(c.focusTagIds, t.id) })}
                  >
                    {t.name}
                  </Chip>
                ))}
              </Row>
            )}

            <Row label="Equipment">
              <Chip on={c.equipment.includes(BODYWEIGHT_ONLY)} onClick={() => toggleEquipment(BODYWEIGHT_ONLY)}>
                Bodyweight only
              </Chip>
              {EQUIPMENT_OPTIONS.map((o) => (
                <Chip key={o.id} on={c.equipment.includes(o.id)} onClick={() => toggleEquipment(o.id)}>
                  {o.label}
                </Chip>
              ))}
            </Row>
            {c.equipment.includes("dumbbells") && (
              <Row label="Weights">
                {DUMBBELL_LEVELS.map((l) => (
                  <Chip
                    key={l.id}
                    on={c.dumbbellLevels.includes(l.id)}
                    onClick={() => set({ dumbbellLevels: toggle(c.dumbbellLevels, l.id) })}
                  >
                    {l.label}
                  </Chip>
                ))}
              </Row>
            )}

            <Row label="Style">
              {GENERATE_STYLES.map((s) => (
                <Chip key={s.id} on={c.style === s.id} onClick={() => set({ style: c.style === s.id ? null : s.id })}>
                  {s.label}
                </Chip>
              ))}
            </Row>

            <Row label="Warm-up">
              <select
                aria-label="Warm-up"
                value={c.warmup}
                onChange={(e) => set({ warmup: e.target.value })}
                className="h-9 min-w-48 rounded-lg border border-zinc-300 bg-white px-2.5 text-sm"
              >
                <option value="auto">Claude’s call</option>
                <option value="none">No warm-up</option>
                {warmups.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name} · {formatDuration(w.durationSeconds)}
                  </option>
                ))}
              </select>
            </Row>

            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-zinc-600">Anything else?</span>
              <textarea
                value={c.prompt}
                onChange={(e) => set({ prompt: e.target.value })}
                rows={3}
                maxLength={1500}
                placeholder="e.g. gentle on the knees, end with a stretch, for people who sit at a desk all day"
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
              />
            </label>
          </fieldset>

          <div className="space-y-3 border-t border-zinc-100 px-6 py-4">
            {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
            {busy ? (
              <p className="text-sm text-zinc-500">Building your workout. This usually takes 20–40 seconds.</p>
            ) : (
              replacing && <p className="text-sm text-amber-700">This replaces the current sequence. You can undo it after.</p>
            )}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={busy}
                className="flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-60"
              >
                {busy && <span className="size-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden="true" />}
                {busy ? "Building…" : replacing ? "Generate and replace" : "Generate"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-2 sm:grid-cols-[88px_minmax(0,1fr)] sm:items-start">
      <span className="pt-1.5 text-sm font-medium text-zinc-600">{label}</span>
      <div className="flex flex-wrap items-center gap-1.5">{children}</div>
    </div>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`h-8 rounded-full border px-3 text-sm transition disabled:opacity-50 ${
        on ? "border-zinc-900 bg-zinc-900 font-medium text-white" : "border-zinc-300 text-zinc-700 hover:border-zinc-400 hover:bg-zinc-50"
      }`}
    >
      {children}
    </button>
  );
}
