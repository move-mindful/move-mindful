"use client";

import { useState } from "react";
import Image from "next/image";
import { formatDuration, thumbnailUrl } from "@/lib/exercises/shared";
import type { CatalogExercise } from "@/lib/workouts/shared";
import { Flag } from "@/components/admin/exercises/ui";

// Small inputs for the workout builder.

/** Seconds, typed as "45", "1:30" or "90". Shown as m:ss. */
export function DurationInput({
  seconds,
  onChange,
  label,
  className = "w-16",
}: {
  seconds: number;
  onChange: (seconds: number) => void;
  label: string;
  className?: string;
}) {
  const [text, setText] = useState<string | null>(null);

  function commit() {
    if (text === null) return;
    const [a, b] = text.split(":").map((p) => Number(p.trim()));
    const parsed = text.includes(":") ? a * 60 + (b || 0) : a;
    if (Number.isFinite(parsed) && parsed >= 0) onChange(Math.round(parsed));
    setText(null);
  }

  return (
    <input
      aria-label={label}
      value={text ?? formatDuration(seconds)}
      onFocus={() => setText(formatDuration(seconds))}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === "Enter" && (e.currentTarget as HTMLInputElement).blur()}
      className={`h-8 rounded-md border border-zinc-300 px-2 text-sm font-semibold tabular-nums ${className}`}
    />
  );
}

export function Stepper({
  value,
  onChange,
  min = 1,
  max = 20,
  label,
}: {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  label: string;
}) {
  return (
    <span className="flex h-8 items-center rounded-md border border-zinc-300" aria-label={label}>
      <button
        type="button"
        aria-label={`Fewer ${label.toLowerCase()}`}
        onClick={() => onChange(Math.max(min, value - 1))}
        className="h-full w-7 text-zinc-500 hover:text-zinc-900"
      >
        −
      </button>
      <span className="w-6 text-center text-sm font-semibold tabular-nums">{value}</span>
      <button
        type="button"
        aria-label={`More ${label.toLowerCase()}`}
        onClick={() => onChange(Math.min(max, value + 1))}
        className="h-full w-7 text-zinc-500 hover:text-zinc-900"
      >
        +
      </button>
    </span>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: Array<{ id: T; label: string; disabled?: boolean }>;
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <span role="group" aria-label={label} className="flex h-8 gap-0.5 rounded-md bg-zinc-100 p-0.5">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          aria-pressed={value === o.id}
          disabled={o.disabled}
          onClick={() => onChange(o.id)}
          className={`rounded px-2.5 text-xs transition disabled:cursor-not-allowed disabled:text-zinc-300 ${
            value === o.id ? "bg-white font-semibold text-zinc-900 shadow-sm" : "font-medium text-zinc-500"
          }`}
        >
          {o.label}
        </button>
      ))}
    </span>
  );
}

export function Thumb({ exercise, onClick }: { exercise: CatalogExercise | undefined; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={exercise ? `Preview ${exercise.name}` : "Preview"}
      className="relative h-12 w-9 shrink-0 overflow-hidden rounded-md bg-zinc-200"
    >
      {exercise?.thumbPlaybackId && (
        <Image src={thumbnailUrl(exercise.thumbPlaybackId, 72, 96)} alt="" fill unoptimized className="object-cover" />
      )}
    </button>
  );
}

/** Typeahead over the exercise library; Enter adds the top match. */
export function ExerciseSearch({
  catalog,
  onPick,
  placeholder,
  compact,
}: {
  catalog: CatalogExercise[];
  onPick: (exercise: CatalogExercise) => void;
  placeholder: string;
  compact?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const q = query.trim().toLowerCase();
  const matches = catalog
    .filter((e) => e.kind === "exercise" && !e.archived && (!q || e.name.toLowerCase().includes(q)))
    .slice(0, 8);

  function pick(e: CatalogExercise) {
    onPick(e);
    setQuery("");
  }

  return (
    <div className="relative">
      <input
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && matches[0]) {
            e.preventDefault();
            pick(matches[0]);
          }
          if (e.key === "Escape") setOpen(false);
        }}
        placeholder={placeholder}
        aria-label={placeholder}
        className={`w-full rounded-lg border border-zinc-300 px-3 text-sm focus:border-zinc-500 focus:outline-none ${
          compact ? "h-9" : "h-11"
        }`}
      />
      {open && (q || compact === undefined) && (
        <ul className="absolute inset-x-0 top-full z-20 mt-1 max-h-80 overflow-auto rounded-xl border border-zinc-200 bg-white p-1 shadow-xl">
          {matches.length === 0 ? (
            <li className="px-3 py-2 text-sm text-zinc-500">
              {q ? `No exercises match “${query.trim()}”.` : "No exercises in the library yet."}
            </li>
          ) : (
            matches.map((e) => (
              <li key={e.id}>
                <button
                  type="button"
                  onMouseDown={(ev) => ev.preventDefault()}
                  onClick={() => pick(e)}
                  className="flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left hover:bg-zinc-50"
                >
                  <span className="relative h-10 w-7 shrink-0 overflow-hidden rounded bg-zinc-200">
                    {e.thumbPlaybackId && (
                      <Image src={thumbnailUrl(e.thumbPlaybackId, 56, 80)} alt="" fill unoptimized className="object-cover" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{e.name}</span>
                  {e.sided && <Flag>R + L</Flag>}
                  {!e.playable && <Flag>Missing clip</Flag>}
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
