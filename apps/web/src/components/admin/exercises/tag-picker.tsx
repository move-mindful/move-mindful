"use client";

import { useState } from "react";
import { createExerciseTag } from "@/app/actions/exercises";
import type { ExerciseTag } from "@/lib/exercises/shared";
import { CheckIcon, Pill } from "@/components/admin/exercises/ui";

/**
 * Tags field for the exercise form: the chosen tags as chips, plus an "All tags"
 * panel listing every tag so nothing relies on memory. Typing a name that
 * doesn't exist yet offers to create it.
 */
export function TagPicker({
  tags,
  selected,
  onChange,
  onTagCreated,
}: {
  tags: ExerciseTag[];
  selected: string[];
  onChange: (ids: string[]) => void;
  onTagCreated: (tag: ExerciseTag) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const toggle = (id: string) =>
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);

  const q = query.trim().toLowerCase();
  const shown = q ? tags.filter((t) => t.name.toLowerCase().includes(q)) : tags;
  const exact = tags.some((t) => t.name.toLowerCase() === q);

  async function create() {
    if (!q || exact || creating) return;
    setCreating(true);
    setError(null);
    const { tag, error } = await createExerciseTag(query);
    setCreating(false);
    if (error || !tag) {
      setError(error ?? "Couldn't add it.");
      return;
    }
    onTagCreated(tag);
    onChange([...selected, tag.id]);
    setQuery("");
  }

  return (
    <div className="relative">
      <div
        className={`flex min-h-10 flex-wrap items-center gap-1.5 rounded-lg border bg-white p-1.5 ${
          open ? "border-zinc-500" : "border-zinc-300"
        }`}
      >
        {tags
          .filter((t) => selected.includes(t.id))
          .map((t) => (
            <span
              key={t.id}
              className="flex h-7 items-center gap-1 rounded-md bg-zinc-100 pl-2.5 pr-1 text-sm font-medium"
            >
              {t.name}
              <button
                type="button"
                aria-label={`Remove ${t.name}`}
                onClick={() => toggle(t.id)}
                className="flex h-5 w-5 items-center justify-center rounded text-zinc-500 hover:bg-zinc-200"
              >
                ×
              </button>
            </span>
          ))}
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
          className="ml-auto h-7 rounded-md px-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-100"
        >
          All tags {open ? "▴" : "▾"}
        </button>
      </div>

      {open && (
        <div
          role="dialog"
          aria-label="All tags"
          className="absolute inset-x-0 top-full z-20 mt-2 space-y-3 rounded-xl border border-zinc-200 bg-white p-3 shadow-xl"
        >
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                create();
              }
            }}
            placeholder="Search or create a tag"
            aria-label="Search or create a tag"
            className="h-9 w-full rounded-lg border border-zinc-300 px-3 text-sm focus:border-zinc-500 focus:outline-none"
          />
          <div className="flex flex-wrap gap-1.5">
            {shown.map((t) => (
              <Pill key={t.id} on={selected.includes(t.id)} onClick={() => toggle(t.id)} small>
                {selected.includes(t.id) && <CheckIcon />}
                {t.name}
              </Pill>
            ))}
            {q && !exact && (
              <button
                type="button"
                onClick={create}
                disabled={creating}
                className="h-8 rounded-full border border-dashed border-zinc-400 px-3 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
              >
                {creating ? "Adding…" : `+ Create “${query.trim()}”`}
              </button>
            )}
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex items-center justify-between border-t border-zinc-100 pt-3">
            <span className="text-xs text-zinc-500">Only used to filter the exercise library</span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="h-8 rounded-lg bg-zinc-900 px-3 text-sm font-semibold text-white hover:bg-zinc-700"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
