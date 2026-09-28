"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { deleteExercise, setExerciseArchived } from "@/app/actions/exercises";
import {
  EQUIPMENT_OPTIONS,
  attentionFlags,
  equipmentLabel,
  formatDuration,
  formatPace,
  levelsLabel,
  paceSeconds,
  rolesFor,
  slotFor,
  thumbnailUrl,
  type AdminExercise,
  type ExerciseTag,
} from "@/lib/exercises/shared";
import { ClipPreview } from "@/components/admin/exercises/clip-preview";
import { ManageTags } from "@/components/admin/exercises/manage-tags";
import { CheckIcon, Flag, Pill } from "@/components/admin/exercises/ui";

type Tab = "exercise" | "warmup" | "archived";
type Sort = "name" | "new";

// The live loop (or warm-up video) that stands for the exercise in the list.
function mainClip(e: AdminExercise) {
  const role = e.kind === "warmup" ? "warmup" : e.sided ? "loop_right" : "loop";
  return slotFor(e.videos, role).current;
}

function countedBy(e: AdminExercise): string {
  if (e.kind === "warmup") return `Plays once · ${formatDuration(mainClip(e)?.durationSeconds ?? null)}`;
  if (e.timedOnly) return "Timed only";
  const clip = mainClip(e);
  const pace = clip ? paceSeconds(clip) : null;
  return pace ? `Reps · ${Number(pace.toFixed(1))}s/rep` : "Reps · pace not set";
}

export function ExerciseLibrary({ exercises, tags }: { exercises: AdminExercise[]; tags: ExerciseTag[] }) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("exercise");
  const [query, setQuery] = useState("");
  const [equipment, setEquipment] = useState("any");
  const [sort, setSort] = useState<Sort>("name");
  const [tagFilter, setTagFilter] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [manageOpen, setManageOpen] = useState(false);

  const tagName = new Map(tags.map((t) => [t.id, t.name]));
  const inTab = (e: AdminExercise) =>
    tab === "archived" ? !!e.archivedAt : !e.archivedAt && e.kind === tab;
  const q = query.trim().toLowerCase();
  const rows = exercises
    .filter(inTab)
    .filter((e) => !q || e.name.toLowerCase().includes(q))
    .filter((e) =>
      equipment === "any" ? true : equipment === "none" ? e.equipment.length === 0 : e.equipment.includes(equipment),
    )
    .filter((e) => tagFilter.every((t) => e.tagIds.includes(t)))
    .sort((a, b) => (sort === "name" ? a.name.localeCompare(b.name) : b.createdAt.localeCompare(a.createdAt)));

  const total = exercises.filter(inTab).length;
  const count = (t: Tab) => exercises.filter((e) => (t === "archived" ? !!e.archivedAt : !e.archivedAt && e.kind === t)).length;
  const selected = rows.find((e) => e.id === selectedId) ?? rows[0] ?? null;
  const filtering = q !== "" || equipment !== "any" || tagFilter.length > 0;

  const tabs: Array<[Tab, string]> = [
    ["exercise", "Exercises"],
    ["warmup", "Warm-ups"],
    ["archived", "Archived"],
  ];

  return (
    <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="min-w-0 space-y-4">
        <div role="tablist" className="flex gap-7 border-b border-zinc-200">
          {tabs.map(([id, label]) => (
            <button
              key={id}
              role="tab"
              aria-selected={tab === id}
              onClick={() => {
                setTab(id);
                setSelectedId(null);
              }}
              className={`-mb-px flex h-10 items-center gap-2 border-b-2 text-[15px] ${id === "archived" ? "ml-auto" : ""} ${
                tab === id ? "border-zinc-900 font-semibold text-zinc-900" : "border-transparent text-zinc-500"
              }`}
            >
              {label}
              <span className="rounded-full bg-zinc-100 px-2 text-xs font-semibold text-zinc-600">{count(id)}</span>
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name"
            aria-label="Search by name"
            className="h-10 w-64 rounded-lg border border-zinc-300 px-3 text-sm focus:border-zinc-500 focus:outline-none"
          />
          <select
            aria-label="Equipment"
            value={equipment}
            onChange={(e) => setEquipment(e.target.value)}
            className="h-10 rounded-lg border border-zinc-300 bg-white px-2.5 text-sm"
          >
            <option value="any">Any equipment</option>
            {EQUIPMENT_OPTIONS.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
            <option value="none">No equipment</option>
          </select>
          <select
            aria-label="Sort"
            value={sort}
            onChange={(e) => setSort(e.target.value as Sort)}
            className="h-10 rounded-lg border border-zinc-300 bg-white px-2.5 text-sm"
          >
            <option value="name">Name A–Z</option>
            <option value="new">Recently added</option>
          </select>
          <span className="ml-auto text-sm text-zinc-500">
            {filtering ? `${rows.length} of ${total}` : total}
          </span>
        </div>

        <div className="relative flex flex-wrap items-center gap-1.5">
          {tags.map((t) => {
            const on = tagFilter.includes(t.id);
            return (
              <Pill
                key={t.id}
                small
                on={on}
                onClick={() => setTagFilter(on ? tagFilter.filter((x) => x !== t.id) : [...tagFilter, t.id])}
              >
                {on && <CheckIcon />}
                {t.name}
              </Pill>
            );
          })}
          {tagFilter.length > 0 && (
            <button onClick={() => setTagFilter([])} className="h-8 px-2 text-sm font-semibold text-zinc-600 hover:underline">
              Clear
            </button>
          )}
          <button
            onClick={() => setManageOpen(!manageOpen)}
            aria-expanded={manageOpen}
            className="ml-auto h-8 px-1 text-sm font-semibold text-zinc-600 hover:underline"
          >
            Manage tags
          </button>
          {manageOpen && (
            <ManageTags
              tags={tags}
              onClose={() => setManageOpen(false)}
              onDeleted={(id) => setTagFilter((f) => f.filter((x) => x !== id))}
            />
          )}
        </div>

        <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
          {rows.length === 0 ? (
            <p className="px-5 py-12 text-center text-sm text-zinc-500">
              {total === 0
                ? tab === "archived"
                  ? "Nothing archived."
                  : `No ${tab === "warmup" ? "warm-ups" : "exercises"} yet — upload one to get started.`
                : "Nothing matches these filters."}
            </p>
          ) : (
            <ul className="divide-y divide-zinc-100">
              {rows.map((e) => {
                const clip = mainClip(e);
                const on = selected?.id === e.id;
                const flags = [
                  ...(e.sided ? ["R + L"] : []),
                  ...(tab === "archived" && e.kind === "warmup" ? ["Warm-up"] : []),
                  ...attentionFlags(e),
                ];
                return (
                  <li key={e.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(e.id)}
                      aria-current={on}
                      className={`grid w-full grid-cols-[36px_minmax(0,1fr)_150px_140px] items-center gap-4 px-5 py-2 text-left transition ${
                        on ? "bg-zinc-50 shadow-[inset_3px_0_0_#18181b]" : "hover:bg-zinc-50"
                      }`}
                    >
                      <span className="relative h-12 w-9 overflow-hidden rounded-md bg-zinc-200">
                        {clip?.playbackId && (
                          <Image src={thumbnailUrl(clip.playbackId, 72, 96)} alt="" fill unoptimized className="object-cover" />
                        )}
                      </span>
                      <span className="min-w-0">
                        <span className="flex min-w-0 items-center gap-2">
                          <span className="truncate font-semibold">{e.name}</span>
                          {flags.map((f) => (
                            <Flag key={f}>{f}</Flag>
                          ))}
                        </span>
                        <span className="block truncate text-xs text-zinc-500">
                          {e.tagIds.map((id) => tagName.get(id)).filter(Boolean).join(" · ") || "No tags"}
                        </span>
                      </span>
                      <span className="min-w-0 text-sm">
                        <span className={`block truncate ${e.equipment.length ? "text-zinc-700" : "text-zinc-400"}`}>
                          {e.equipment.length ? e.equipment.map(equipmentLabel).join(", ") : "None"}
                        </span>
                        {e.dumbbellLevels.length > 0 && (
                          <span className="block text-xs text-zinc-500">{levelsLabel(e.dumbbellLevels)}</span>
                        )}
                      </span>
                      <span className="text-sm text-zinc-700">{countedBy(e)}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      <aside>
        {selected && (
          <section className="sticky top-6 space-y-4 rounded-xl border border-zinc-200 bg-white p-5">
            <div className="space-y-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
                  {selected.archivedAt ? "Archived " : ""}
                  {selected.kind === "warmup" ? "warm-up" : "exercise"}
                </p>
                <p className="text-lg font-semibold">{selected.name}</p>
              </div>
              {selected.tagIds.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {selected.tagIds.map((id) => (
                    <span key={id} className="rounded-md bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700">
                      {tagName.get(id)}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <ClipPreview key={selected.id} kind={selected.kind} sided={selected.sided} videos={selected.videos} />
            <PanelFacts exercise={selected} />
            {selected.archivedAt ? (
              <div className="flex gap-2">
                <button
                  onClick={async () => {
                    await setExerciseArchived(selected.id, false);
                    router.refresh();
                  }}
                  className="h-10 flex-1 rounded-lg bg-zinc-900 text-sm font-medium text-white hover:bg-zinc-700"
                >
                  Restore
                </button>
                <button
                  onClick={async () => {
                    if (!window.confirm(`Delete “${selected.name}” and its videos? This can’t be undone.`)) return;
                    await deleteExercise(selected.id);
                    router.refresh();
                  }}
                  className="h-10 flex-1 rounded-lg border border-red-200 text-sm font-medium text-red-600 hover:bg-red-50"
                >
                  Delete
                </button>
              </div>
            ) : (
              <Link
                href={`/admin/exercises/${selected.id}`}
                className="flex h-10 items-center justify-center rounded-lg bg-zinc-900 text-sm font-medium text-white hover:bg-zinc-700"
              >
                Edit or replace videos
              </Link>
            )}
          </section>
        )}
      </aside>
    </div>
  );
}

function PanelFacts({ exercise: e }: { exercise: AdminExercise }) {
  const facts: Array<[string, string]> = [];
  if (e.kind === "warmup") {
    facts.push(["Length", formatDuration(mainClip(e)?.durationSeconds ?? null)], ["Plays", "Once, start to finish"]);
  } else {
    const clip = mainClip(e);
    const pace = clip ? paceSeconds(clip) : null;
    facts.push(
      ["Counted by", e.timedOnly ? "Time only" : "Reps or time"],
      ["Pace", e.timedOnly ? "—" : pace ? formatPace(pace) : "Not set"],
    );
    const tutorial = slotFor(e.videos, "tutorial").current;
    facts.push(["Tutorial", tutorial ? formatDuration(tutorial.durationSeconds) : "Missing"]);
  }
  facts.push(["Equipment", e.equipment.length ? e.equipment.map(equipmentLabel).join(", ") : "None"]);
  if (e.dumbbellLevels.length) facts.push(["Dumbbells", levelsLabel(e.dumbbellLevels)]);
  const missing = rolesFor(e.kind, e.sided).filter((r) => !slotFor(e.videos, r).current);
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
      {facts.map(([k, v]) => (
        <div key={k}>
          <dt className="text-xs text-zinc-500">{k}</dt>
          <dd className="text-sm font-semibold">{v}</dd>
        </div>
      ))}
      {missing.length > 0 && (
        <p className="col-span-2 text-xs text-amber-700">Not ready for workouts until every clip is uploaded and processed.</p>
      )}
    </dl>
  );
}
