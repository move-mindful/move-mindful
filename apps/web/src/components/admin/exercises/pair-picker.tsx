"use client";

import { useState } from "react";
import Image from "next/image";
import { thumbnailUrl, type ExerciseOption } from "@/lib/exercises/shared";
import { Flag } from "@/components/admin/exercises/ui";

/**
 * "Pairs well with" in the exercise form: a search box that adds exercises
 * (focus it to browse), with the picks listed beneath it. Pairings go both
 * ways — the other exercise shows this one as a pair too.
 */
export function PairPicker({
  options,
  selected,
  onChange,
  selfId,
}: {
  options: ExerciseOption[];
  selected: string[];
  onChange: (ids: string[]) => void;
  /** The exercise being edited, never offered as its own pair. */
  selfId?: string;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const byId = new Map(options.map((o) => [o.id, o]));
  const q = query.trim().toLowerCase();
  const matches = options
    .filter((o) => o.id !== selfId && !o.archived && !selected.includes(o.id) && (!q || o.name.toLowerCase().includes(q)))
    .slice(0, 8);
  const picked = selected.map((id) => byId.get(id)).filter((o): o is ExerciseOption => !!o);

  function add(o: ExerciseOption) {
    onChange([...selected, o.id]);
    setQuery("");
  }

  return (
    <div className="space-y-2">
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
            if (e.key === "Enter") {
              e.preventDefault();
              if (matches[0]) add(matches[0]);
            }
            if (e.key === "Escape") setOpen(false);
          }}
          placeholder="Search exercises to add"
          aria-label="Search exercises to pair with this one"
          className="h-10 w-full rounded-lg border border-zinc-300 px-3 text-sm focus:border-zinc-500 focus:outline-none"
        />
        {open && (
          <ul className="absolute inset-x-0 top-full z-20 mt-1 max-h-72 overflow-auto rounded-xl border border-zinc-200 bg-white p-1 shadow-xl">
            {matches.length === 0 ? (
              <li className="px-3 py-2 text-sm text-zinc-500">
                {q ? `No exercises match “${query.trim()}”.` : "No other exercises to add."}
              </li>
            ) : (
              matches.map((o) => (
                <li key={o.id}>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => add(o)}
                    className="flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left hover:bg-zinc-50"
                  >
                    <Thumb playbackId={o.thumbPlaybackId} />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{o.name}</span>
                    <span className="text-xs font-semibold text-zinc-400">Add</span>
                  </button>
                </li>
              ))
            )}
          </ul>
        )}
      </div>
      {picked.length > 0 && (
        <ul className="divide-y divide-zinc-100 rounded-lg border border-zinc-200">
          {picked.map((o) => (
            <li key={o.id} className="flex items-center gap-3 px-2.5 py-1.5">
              <Thumb playbackId={o.thumbPlaybackId} />
              <span className="min-w-0 flex-1 truncate text-sm font-medium">{o.name}</span>
              {o.archived && <Flag>Archived</Flag>}
              <button
                type="button"
                aria-label={`Remove ${o.name}`}
                onClick={() => onChange(selected.filter((x) => x !== o.id))}
                className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Thumb({ playbackId }: { playbackId: string | null }) {
  return (
    <span className="relative h-10 w-7 shrink-0 overflow-hidden rounded bg-zinc-200">
      {playbackId && <Image src={thumbnailUrl(playbackId, 56, 80)} alt="" fill unoptimized className="object-cover" />}
    </span>
  );
}
