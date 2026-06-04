"use client";

import { useActionState, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { createClass, updateClass, createTrimmedClass } from "@/app/actions/classes";
import { TrimControls } from "@/components/admin/trim-controls";
import { MuxPlayer } from "@/components/mux-player";
import type { ClassFormState } from "@/lib/admin/types";
import type { TagPickerData, InstructorOption, CollectionOption } from "@/lib/admin/queries";

const SINGLE_SELECT_GROUPS = ["discipline", "intensity"];

// Today's date as YYYY-MM-DD in the admin's local zone — the default for new
// classes (built from local parts so it doesn't drift a day near UTC midnight).
function todayLocalISO(): string {
  const d = new Date();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${month}-${day}`;
}

const inputCls =
  "w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none";

export interface ClassFormInitial {
  id?: string;
  title?: string;
  instructorId?: string;
  description?: string;
  durationMinutes?: number | string;
  muxPlaybackId?: string;
  muxAssetId?: string;
  /** Admin display date as YYYY-MM-DD. Defaults to today on create/trim. */
  classDate?: string;
  tagIds?: string[];
  /**
   * Manual collections this class belongs to. Provided on edit to pre-check the
   * picker; omit on create/trim to fall back to the auto-add collections.
   */
  collectionIds?: string[];
}

export interface TrimSource {
  /** Raw (untrimmed) Mux asset to clip from. */
  sourceAssetId: string;
  /** Public playback id of the raw asset, for the admin-only preview player. */
  rawPlaybackId: string;
  /** Raw asset duration in seconds, to clamp the end marker. 0 if unknown. */
  rawDurationSeconds: number;
}

export function ClassForm({
  mode,
  tagData,
  instructors,
  collections,
  initial = {},
  trim,
}: {
  mode: "create" | "edit" | "trim";
  tagData: TagPickerData;
  instructors: InstructorOption[];
  collections: CollectionOption[];
  initial?: ClassFormInitial;
  trim?: TrimSource;
}) {
  const action =
    mode === "create" ? createClass : mode === "edit" ? updateClass : createTrimmedClass;
  const [state, formAction, pending] = useActionState<ClassFormState, FormData>(
    action,
    {},
  );
  const [playbackId, setPlaybackId] = useState(initial.muxPlaybackId ?? "");
  const isTrim = mode === "trim";

  const selected = new Set(initial.tagIds ?? []);
  // Edit passes the class's current memberships; create/trim default to the
  // auto-add collections (the behavior new classes used to get silently).
  const selectedCollections = new Set(
    initial.collectionIds ?? collections.filter((c) => c.autoAddNew).map((c) => c.id),
  );
  const singleGroups = tagData.groups.filter((g) =>
    SINGLE_SELECT_GROUPS.includes(g.slug),
  );
  const multiGroups = tagData.groups.filter(
    (g) => !SINGLE_SELECT_GROUPS.includes(g.slug),
  );

  const initialSingle = (groupSlug: string) => {
    const grp = tagData.groups.find((g) => g.slug === groupSlug);
    return grp?.tags.find((t) => selected.has(t.id))?.id ?? "";
  };

  return (
    <form action={formAction} className="max-w-2xl space-y-6">
      {mode === "edit" && <input type="hidden" name="id" defaultValue={initial.id} />}
      {!isTrim && (
        <input type="hidden" name="muxAssetId" defaultValue={initial.muxAssetId ?? ""} />
      )}

      {isTrim && trim ? (
        <TrimControls
          playbackId={trim.rawPlaybackId}
          sourceAssetId={trim.sourceAssetId}
          durationSeconds={trim.rawDurationSeconds}
        />
      ) : mode === "edit" && playbackId ? (
        // Full player on the edit page so the video can be reviewed in place.
        <MuxPlayer playbackId={playbackId} title={initial.title ?? ""} />
      ) : (
        playbackId && (
          <Image
            src={`https://image.mux.com/${playbackId}/thumbnail.webp?width=640&height=360&fit_mode=smartcrop`}
            alt="Thumbnail preview"
            width={400}
            height={225}
            unoptimized
            className="aspect-video w-full max-w-sm rounded-lg border border-zinc-200 object-cover"
          />
        )
      )}

      <Labeled label="Title" required>
        <input name="title" defaultValue={initial.title ?? ""} required className={inputCls} />
      </Labeled>

      <div>
        <Labeled label="Instructor">
          <select
            name="instructorId"
            defaultValue={initial.instructorId ?? ""}
            className={inputCls}
          >
            <option value="">— none —</option>
            {instructors.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name}
              </option>
            ))}
          </select>
        </Labeled>
        <p className="mt-1 text-xs text-zinc-400">
          Add teachers and their photos in{" "}
          <Link href="/admin/instructors" className="underline hover:text-zinc-600">
            Instructors
          </Link>
          .
        </p>
      </div>

      <Labeled label="Description">
        <textarea
          name="description"
          rows={4}
          defaultValue={initial.description ?? ""}
          className={inputCls}
        />
      </Labeled>

      <Labeled label="Date" required>
        <input
          name="classDate"
          type="date"
          defaultValue={initial.classDate ?? todayLocalISO()}
          required
          className={inputCls}
        />
      </Labeled>

      {!isTrim && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Labeled label="Duration (minutes)" required>
            <input
              name="durationMinutes"
              type="number"
              min={1}
              defaultValue={initial.durationMinutes ?? ""}
              required
              className={inputCls}
            />
          </Labeled>
          <Labeled label="Mux playback ID" required>
            <input
              name="muxPlaybackId"
              value={playbackId}
              onChange={(e) => setPlaybackId(e.target.value)}
              required
              className={inputCls}
            />
          </Labeled>
        </div>
      )}

      {singleGroups.map((g) => (
        <Labeled key={g.id} label={g.name}>
          <select
            name={`${g.slug}TagId`}
            defaultValue={initialSingle(g.slug)}
            className={inputCls}
          >
            <option value="">— none —</option>
            {g.tags.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </Labeled>
      ))}

      {(multiGroups.length > 0 || tagData.ungrouped.length > 0) && (
        <div className="space-y-4">
          {multiGroups.map((g) => (
            <CheckboxGroup
              key={g.id}
              legend={g.name}
              tags={g.tags}
              selected={selected}
            />
          ))}
          {tagData.ungrouped.length > 0 && (
            <CheckboxGroup
              legend="Other tags"
              tags={tagData.ungrouped}
              selected={selected}
            />
          )}
        </div>
      )}

      {collections.length > 0 && (
        <fieldset>
          <legend className="text-sm font-medium text-zinc-700">Collections</legend>
          <p className="mt-0.5 text-xs text-zinc-400">
            Rows this class appears in on the browse page. The{" "}
            <span className="font-medium">Auto</span> collection is pre-selected —
            uncheck to leave this class out.
          </p>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {collections.map((c) => (
              <label
                key={c.id}
                className="flex items-center gap-1.5 rounded-full border border-zinc-300 px-3 py-1 text-sm"
              >
                <input
                  type="checkbox"
                  name="collectionIds"
                  value={c.id}
                  defaultChecked={selectedCollections.has(c.id)}
                />
                {c.title}
                {c.autoAddNew && (
                  <span className="rounded-full bg-zinc-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                    Auto
                  </span>
                )}
                {!c.published && (
                  <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
                    Draft
                  </span>
                )}
              </label>
            ))}
          </div>
        </fieldset>
      )}

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-700 disabled:opacity-50"
      >
        {pending
          ? isTrim
            ? "Creating clip…"
            : "Saving…"
          : mode === "create"
            ? "Create class"
            : isTrim
              ? "Create clip & class"
              : "Save changes"}
      </button>
    </form>
  );
}

function Labeled({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-zinc-700">
        {label} {required && <span className="text-red-500">*</span>}
      </span>
      {children}
    </label>
  );
}

function CheckboxGroup({
  legend,
  tags,
  selected,
}: {
  legend: string;
  tags: { id: string; name: string }[];
  selected: Set<string>;
}) {
  return (
    <fieldset>
      <legend className="text-sm font-medium text-zinc-700">{legend}</legend>
      <div className="mt-1.5 flex flex-wrap gap-2">
        {tags.map((t) => (
          <label
            key={t.id}
            className="flex items-center gap-1.5 rounded-full border border-zinc-300 px-3 py-1 text-sm"
          >
            <input
              type="checkbox"
              name="tagIds"
              value={t.id}
              defaultChecked={selected.has(t.id)}
            />
            {t.name}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
