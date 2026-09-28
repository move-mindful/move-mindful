"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createUpload } from "@mux/upchunk";
import {
  deleteExercise,
  discardExerciseVideo,
  finishExerciseVideoUpload,
  saveExercise,
  setExerciseArchived,
  startExerciseVideoUpload,
} from "@/app/actions/exercises";
import {
  DUMBBELL_LEVELS,
  EQUIPMENT_OPTIONS,
  ROLE_HINTS,
  ROLE_LABELS,
  formatDuration,
  formatPace,
  isLoopRole,
  rolesFor,
  slotFor,
  thumbnailUrl,
  type AdminExercise,
  type ExerciseInput,
  type ExerciseKind,
  type ExerciseTag,
  type VideoRole,
  type VideoSlot,
} from "@/lib/exercises/shared";
import { ClipPreview } from "@/components/admin/exercises/clip-preview";
import { TagPicker } from "@/components/admin/exercises/tag-picker";
import { CheckIcon, Pill, Section } from "@/components/admin/exercises/ui";

/** A file picked in this browser: waiting for Save (new exercise) or uploading. */
interface LocalUpload {
  file: File;
  phase: "waiting" | "uploading" | "failed";
  progress: number;
  error?: string;
  videoId?: string;
  abort?: () => void;
}

const inputCls =
  "w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none";

function parseReps(value: string | undefined): number | null {
  const n = Math.round(Number(value));
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Upload / edit screen for one exercise or warm-up. `exercise` is null when creating. */
export function ExerciseForm({ exercise, tags: initialTags }: { exercise: AdminExercise | null; tags: ExerciseTag[] }) {
  const router = useRouter();
  const editing = !!exercise;
  const videos = exercise?.videos ?? [];

  const [kind, setKind] = useState<ExerciseKind>(exercise?.kind ?? "exercise");
  const [name, setName] = useState(exercise?.name ?? "");
  const [sided, setSided] = useState(exercise?.sided ?? false);
  const [timedOnly, setTimedOnly] = useState(exercise?.timedOnly ?? false);
  const [equipment, setEquipment] = useState<string[]>(exercise?.equipment ?? []);
  const [levels, setLevels] = useState<string[]>(exercise?.dumbbellLevels ?? []);
  const [tags, setTags] = useState(initialTags);
  const [tagIds, setTagIds] = useState<string[]>(exercise?.tagIds ?? []);
  const [reps, setReps] = useState<Partial<Record<VideoRole, string>>>(() => {
    const initial: Partial<Record<VideoRole, string>> = {};
    for (const role of ["loop", "loop_right", "loop_left"] as VideoRole[]) {
      const slot = slotFor(videos, role);
      const value = (slot.pending ?? slot.current)?.repsInClip;
      if (value) initial[role] = String(value);
    }
    return initial;
  });
  const [uploads, setUploads] = useState<Partial<Record<VideoRole, LocalUpload>>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(new Set<Promise<boolean>>());

  const roles = rolesFor(kind, sided);
  const slots = roles.map((role) => slotFor(videos, role));
  const noun = kind === "warmup" ? "warm-up" : "exercise";

  // Clips that saving would delete, because "done on each side" changed.
  const savedRoles = exercise ? rolesFor(exercise.kind, exercise.sided) : [];
  const droppedWithClips = savedRoles.filter(
    (r) => !roles.includes(r) && videos.some((v) => v.role === r),
  );

  // While Mux processes a clip, keep checking (the page syncs with Mux on load).
  const processing = slots.some(
    (s) => s.pending && s.pending.status !== "errored" && !uploads[s.role],
  );
  useEffect(() => {
    if (!processing) return;
    const id = window.setInterval(() => router.refresh(), 5000);
    return () => window.clearInterval(id);
  }, [processing, router]);

  function setUpload(role: VideoRole, next: LocalUpload | null) {
    setUploads((prev) => {
      const copy = { ...prev };
      if (next) copy[role] = next;
      else delete copy[role];
      return copy;
    });
  }

  function formInput(): ExerciseInput {
    const repsById: Record<string, number | null> = {};
    for (const slot of slots) {
      const row = slot.pending ?? slot.current;
      if (row && isLoopRole(slot.role)) repsById[row.id] = parseReps(reps[slot.role]);
    }
    return {
      id: exercise?.id,
      kind,
      name,
      sided,
      timedOnly,
      equipment,
      dumbbellLevels: levels,
      tagIds,
      reps: repsById,
    };
  }

  async function upload(exerciseId: string, role: VideoRole, file: File): Promise<boolean> {
    setUpload(role, { file, phase: "uploading", progress: 0 });
    const res = await startExerciseVideoUpload({
      exerciseId,
      role,
      filename: file.name,
      repsInClip: parseReps(reps[role]),
    });
    if (res.error || !res.url || !res.videoId) {
      setUpload(role, { file, phase: "failed", progress: 0, error: res.error ?? "Couldn't start the upload." });
      return false;
    }
    const videoId = res.videoId;
    return new Promise<boolean>((resolve) => {
      const chunked = createUpload({ endpoint: res.url!, file });
      setUpload(role, { file, phase: "uploading", progress: 0, videoId, abort: () => chunked.abort() });
      chunked.on("progress", (e) => {
        const progress = Math.round((e.detail as number) ?? 0);
        setUploads((prev) => (prev[role] ? { ...prev, [role]: { ...prev[role]!, progress } } : prev));
      });
      chunked.on("success", async () => {
        await finishExerciseVideoUpload(videoId);
        setUpload(role, null);
        router.refresh();
        resolve(true);
      });
      chunked.on("error", async (e) => {
        await discardExerciseVideo(videoId);
        const message = (e.detail && (e.detail.message as string)) || "Upload failed.";
        setUpload(role, { file, phase: "failed", progress: 0, error: message });
        resolve(false);
      });
    });
  }

  function track(p: Promise<boolean>) {
    inFlight.current.add(p);
    p.finally(() => inFlight.current.delete(p));
  }

  async function pickFile(role: VideoRole, file: File) {
    setError(null);
    if (!exercise) {
      setUpload(role, { file, phase: "waiting", progress: 0 });
      return;
    }
    // Save first, so the clip lands on the exercise as it's set up on screen.
    const res = await saveExercise(formInput());
    if (res.error) {
      setError(res.error);
      return;
    }
    track(upload(exercise.id, role, file));
  }

  async function cancelUpload(role: VideoRole) {
    const local = uploads[role];
    local?.abort?.();
    if (local?.videoId) await discardExerciseVideo(local.videoId);
    setUpload(role, null);
    router.refresh();
  }

  async function save() {
    setSaving(true);
    setError(null);
    const res = await saveExercise(formInput());
    if (res.error || !res.id) {
      setError(res.error ?? "Couldn't save it.");
      setSaving(false);
      return;
    }
    if (!editing) {
      // Upload the clips picked before saving, then open the saved exercise,
      // which shows them processing.
      const picked = roles.filter((r) => uploads[r]?.phase === "waiting");
      await Promise.all(picked.map((r) => upload(res.id!, r, uploads[r]!.file)));
      router.push(`/admin/exercises/${res.id}`);
      return;
    }
    // Leaving mid-upload would cancel it, so wait for anything still sending.
    await Promise.all([...inFlight.current]);
    router.push("/admin/exercises");
  }

  async function archive(archived: boolean) {
    if (!exercise) return;
    await setExerciseArchived(exercise.id, archived);
    router.push("/admin/exercises");
  }

  async function remove() {
    if (!exercise) return;
    if (!window.confirm(`Delete “${exercise.name}” and its videos? This can’t be undone.`)) return;
    const res = await deleteExercise(exercise.id);
    if (res.error) setError(res.error);
    else router.push("/admin/exercises");
  }

  const uploading = Object.values(uploads).some((u) => u?.phase === "uploading");
  const hasDumbbells = equipment.includes("dumbbells");

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-zinc-500">
            <Link href="/admin/exercises" className="hover:text-zinc-800">
              Exercises
            </Link>{" "}
            / {editing ? exercise.name : `New ${noun}`}
          </p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">
            {editing ? `Edit ${noun}` : `New ${noun}`}
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/admin/exercises"
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium transition hover:bg-zinc-50"
          >
            Cancel
          </Link>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-700 disabled:opacity-60"
          >
            {saving ? (uploading ? "Uploading…" : "Saving…") : editing ? "Save changes" : `Save ${noun}`}
          </button>
        </div>
      </div>

      {error && <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      {exercise?.archivedAt && (
        <p className="mt-4 rounded-lg bg-zinc-100 px-4 py-3 text-sm text-zinc-700">
          Archived — hidden from the library and the builder search. Workouts that already use it keep working.
        </p>
      )}

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          {!editing && (
            <div className="grid gap-4 sm:grid-cols-2">
              {(
                [
                  ["exercise", "Exercise", "Tutorial plus a looping clip. Counted by reps or time."],
                  ["warmup", "Warm-up", "One video that plays once, start to finish."],
                ] as const
              ).map(([id, title, text]) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={kind === id}
                  onClick={() => setKind(id)}
                  className={`flex items-center gap-3 rounded-xl border p-4 text-left transition ${
                    kind === id ? "border-zinc-900 ring-2 ring-zinc-900/10" : "border-zinc-200 hover:border-zinc-300"
                  }`}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">{title}</span>
                    <span className="block text-sm text-zinc-500">{text}</span>
                  </span>
                  <span
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                      kind === id ? "border-zinc-900" : "border-zinc-300"
                    }`}
                  >
                    {kind === id && <span className="h-2.5 w-2.5 rounded-full bg-zinc-900" />}
                  </span>
                </button>
              ))}
            </div>
          )}

          <Section title="Details">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-1.5">
                <span className="text-sm font-medium text-zinc-600">Name</span>
                <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
              </label>
              <div className="space-y-1.5">
                <span className="text-sm font-medium text-zinc-600">Tags</span>
                <TagPicker
                  tags={tags}
                  selected={tagIds}
                  onChange={setTagIds}
                  onTagCreated={(t) => setTags((prev) => [...prev, t])}
                />
              </div>
            </div>

            {kind === "exercise" && (
              <div className="flex items-start gap-3">
                <button
                  type="button"
                  role="switch"
                  aria-checked={sided}
                  aria-label="Done on each side"
                  onClick={() => setSided(!sided)}
                  className={`mt-0.5 flex h-6 w-10 shrink-0 items-center rounded-full p-0.5 transition ${
                    sided ? "justify-end bg-zinc-900" : "justify-start bg-zinc-300"
                  }`}
                >
                  <span className="h-5 w-5 rounded-full bg-white shadow" />
                </button>
                <div>
                  <p className="font-semibold">Done on each side</p>
                  <p className="text-sm text-zinc-500">
                    Upload a separate loop for the right and the left side. Which side goes first is set in each workout.
                  </p>
                  {droppedWithClips.length > 0 && (
                    <p className="mt-1 text-sm font-medium text-amber-700">
                      Saving removes the {droppedWithClips.map((r) => ROLE_LABELS[r].toLowerCase()).join(" and ")} clip
                      {droppedWithClips.length > 1 ? "s" : ""}.
                    </p>
                  )}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <span className="text-sm font-medium text-zinc-600">Equipment</span>
              <div className="flex flex-wrap gap-2">
                {EQUIPMENT_OPTIONS.map((o) => {
                  const on = equipment.includes(o.id);
                  return (
                    <Pill
                      key={o.id}
                      on={on}
                      onClick={() => setEquipment(on ? equipment.filter((x) => x !== o.id) : [...equipment, o.id])}
                    >
                      {on && <CheckIcon />}
                      {o.label}
                    </Pill>
                  );
                })}
              </div>
            </div>

            {hasDumbbells && (
              <div className="space-y-2">
                <span className="text-sm font-medium text-zinc-600">Dumbbell weight</span>
                <div className="flex flex-wrap gap-2">
                  {DUMBBELL_LEVELS.map((l) => {
                    const on = levels.includes(l.id);
                    return (
                      <Pill
                        key={l.id}
                        on={on}
                        onClick={() => setLevels(on ? levels.filter((x) => x !== l.id) : [...levels, l.id])}
                      >
                        {on && <CheckIcon />}
                        {l.label}
                      </Pill>
                    );
                  })}
                </div>
                <p className="text-sm text-zinc-500">Select every weight that works for this {noun}.</p>
              </div>
            )}
          </Section>

          <Section title="Videos" aside="Vertical 9:16 · MP4 or MOV">
            <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
              {slots.map((slot) => (
                <VideoSlotCard
                  key={slot.role}
                  slot={slot}
                  local={uploads[slot.role]}
                  reps={reps[slot.role] ?? ""}
                  onReps={(value) => setReps((prev) => ({ ...prev, [slot.role]: value }))}
                  showReps={isLoopRole(slot.role) && !timedOnly}
                  timedOnly={isLoopRole(slot.role) && timedOnly}
                  onPick={(file) => pickFile(slot.role, file)}
                  onCancel={() => cancelUpload(slot.role)}
                  onDiscard={async (videoId) => {
                    await discardExerciseVideo(videoId);
                    router.refresh();
                  }}
                />
              ))}
            </div>
            {kind === "exercise" && (
              <label className="flex items-start gap-3 border-t border-zinc-100 pt-4">
                <input
                  type="checkbox"
                  checked={timedOnly}
                  onChange={(e) => setTimedOnly(e.target.checked)}
                  className="mt-1 h-4 w-4"
                />
                <span>
                  <span className="block font-semibold">No reps — timed only</span>
                  <span className="block text-sm text-zinc-500">
                    For holds and stretches. The builder will only offer Time for this exercise.
                  </span>
                </span>
              </label>
            )}
          </Section>
        </div>

        <aside className="space-y-6">
          <Section title="Preview">
            <ClipPreview kind={kind} sided={sided} videos={videos} />
          </Section>
          <p className="rounded-xl border border-zinc-200 bg-white p-4 text-sm text-zinc-600">
            {editing
              ? "Replacing a clip keeps the current one live until the new one finishes processing. This page updates on its own while Mux works."
              : "Clips upload when you save. Mux then takes a minute or two to process them; the next page updates on its own."}
          </p>
          {exercise && (
            <section className="space-y-3 rounded-xl border border-zinc-200 bg-white p-4">
              {exercise.archivedAt ? (
                <>
                  <p className="text-sm text-zinc-600">Restore it to show it in the library and the builder search again.</p>
                  <button
                    type="button"
                    onClick={() => archive(false)}
                    className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium hover:bg-zinc-50"
                  >
                    Restore {noun}
                  </button>
                </>
              ) : (
                <>
                  <p className="text-sm text-zinc-600">
                    Archiving hides it from the library and the builder search. Workouts that use it keep working, and
                    you can restore it anytime.
                  </p>
                  <button
                    type="button"
                    onClick={() => archive(true)}
                    className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium hover:bg-zinc-50"
                  >
                    Archive {noun}
                  </button>
                </>
              )}
              <div className="flex items-center justify-between gap-3 border-t border-zinc-100 pt-3">
                <span className="text-xs text-zinc-500">Deletes it and its videos for good.</span>
                <button
                  type="button"
                  onClick={remove}
                  className="rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50"
                >
                  Delete
                </button>
              </div>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}

function VideoSlotCard({
  slot,
  local,
  reps,
  onReps,
  showReps,
  timedOnly,
  onPick,
  onCancel,
  onDiscard,
}: {
  slot: VideoSlot;
  local: LocalUpload | undefined;
  reps: string;
  onReps: (value: string) => void;
  showReps: boolean;
  timedOnly: boolean;
  onPick: (file: File) => void;
  onCancel: () => void;
  onDiscard: (videoId: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { current, pending } = slot;

  let status: { text: string; tone: "ready" | "busy" | "bad" | "idle" };
  if (local?.phase === "uploading") status = { text: `Uploading · ${local.progress}%`, tone: "busy" };
  else if (local?.phase === "waiting") status = { text: "Uploads when you save", tone: "idle" };
  else if (local?.phase === "failed") status = { text: "Upload failed", tone: "bad" };
  else if (pending?.status === "errored") status = { text: "Processing failed", tone: "bad" };
  else if (pending) status = { text: current ? "Replacing · processing" : "Processing", tone: "busy" };
  else if (current) status = { text: "Ready", tone: "ready" };
  else status = { text: "No clip yet", tone: "idle" };

  const toneCls = {
    ready: "bg-emerald-100 text-emerald-800",
    busy: "bg-violet-100 text-violet-700",
    bad: "bg-red-100 text-red-700",
    idle: "bg-zinc-100 text-zinc-600",
  }[status.tone];

  const filename = local?.file.name ?? pending?.originalFilename ?? current?.originalFilename ?? null;
  const pace = current?.durationSeconds && Number(reps) > 0 ? current.durationSeconds / Number(reps) : null;
  const busy = local?.phase === "uploading" || (!!pending && pending.status !== "errored");

  return (
    <div className="min-w-0 space-y-2.5">
      <div>
        <p className="text-sm font-semibold">{ROLE_LABELS[slot.role]}</p>
        <p className="text-xs text-zinc-500">{ROLE_HINTS[slot.role]}</p>
      </div>
      <div className="flex gap-3.5">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          aria-label={`Choose a video for ${ROLE_LABELS[slot.role]}`}
          className="relative h-48 w-[108px] shrink-0 overflow-hidden rounded-lg border border-dashed border-zinc-300 bg-zinc-50 text-zinc-500 disabled:cursor-default"
        >
          {current?.playbackId && (
            <Image
              src={thumbnailUrl(current.playbackId, 216, 384)}
              alt=""
              fill
              unoptimized
              className={`object-cover ${busy ? "opacity-40" : ""}`}
            />
          )}
          {current && !busy && (
            <span className="absolute left-1.5 top-1.5 rounded-full bg-zinc-900/75 px-1.5 py-0.5 text-[10px] font-semibold text-white">
              {formatDuration(current.durationSeconds)}
            </span>
          )}
          {local?.phase === "uploading" ? (
            <span className="absolute inset-x-3 top-1/2 -translate-y-1/2 space-y-1.5 text-center">
              <span className="block text-sm font-semibold text-zinc-900">{local.progress}%</span>
              <span className="block h-1 overflow-hidden rounded bg-zinc-300">
                <span className="block h-1 bg-zinc-900" style={{ width: `${local.progress}%` }} />
              </span>
            </span>
          ) : busy ? (
            <span className="absolute inset-0 flex items-center justify-center text-xs font-semibold text-zinc-700">
              Processing…
            </span>
          ) : !current ? (
            <span className="absolute inset-0 flex items-center justify-center px-2 text-xs font-medium">
              {local?.phase === "waiting" ? "Ready to upload" : "Choose file"}
            </span>
          ) : null}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="video/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) onPick(file);
          }}
        />
        <div className="flex min-w-0 flex-1 flex-col items-start gap-2">
          {filename && <span className="max-w-full truncate text-xs font-medium text-zinc-700">{filename}</span>}
          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${toneCls}`}>{status.text}</span>
          {(local?.error || pending?.error) && (
            <span className="text-xs text-red-600">{local?.error ?? pending?.error}</span>
          )}
          {showReps && (
            <label className="space-y-1">
              <span className="block text-xs text-zinc-500">Reps in clip</span>
              <input
                inputMode="numeric"
                value={reps}
                onChange={(e) => onReps(e.target.value.replace(/[^0-9]/g, ""))}
                className="h-8 w-16 rounded-md border border-zinc-300 px-2 text-sm font-semibold"
              />
            </label>
          )}
          {showReps && pace && <span className="text-xs text-zinc-500">Pace {formatPace(pace)}</span>}
          {timedOnly && <span className="text-xs text-zinc-500">Timed only</span>}
          <div className="mt-auto flex gap-2">
            {local?.phase === "uploading" ? (
              <button type="button" onClick={onCancel} className="text-xs font-semibold text-zinc-600 hover:underline">
                Cancel
              </button>
            ) : pending?.status === "errored" ? (
              <button
                type="button"
                onClick={() => onDiscard(pending.id)}
                className="text-xs font-semibold text-zinc-600 hover:underline"
              >
                Clear
              </button>
            ) : !busy ? (
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="rounded-md border border-zinc-300 px-2.5 py-1 text-xs font-semibold hover:bg-zinc-50"
              >
                {local?.phase === "waiting" ? "Change" : current ? "Replace" : "Choose file"}
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
