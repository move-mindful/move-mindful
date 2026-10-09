"use client";

import { useState, useTransition, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type Active,
  type CollisionDetection,
  type DraggableAttributes,
  type DraggableSyntheticListeners,
  type DragEndEvent,
  type DragMoveEvent,
  type DragStartEvent,
  type Over,
} from "@dnd-kit/core";
import { restrictToParentElement, restrictToVerticalAxis } from "@dnd-kit/modifiers";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { aboutMinutes } from "@move-mindful/core";
import { saveThisWeek } from "@/app/actions/workouts";
import { LEVELS, type WorkoutListRow } from "@/lib/workouts/shared";
import { GripIcon } from "@/components/admin/grip-icon";
import { DeleteWorkoutButton } from "./delete-workout-button";
import { RatingBadge } from "./rating";

// The admin workouts list, under This Week's Workouts: the ones members see on
// /workouts, in order. A published workout is dragged in by its grip (a line
// shows where it'll land), the week's rows reorder by theirs, and Remove takes
// one out — each change saved at once. One @dnd-kit context holds both lists.

/** The week's drop zone; its rows' drag ids are their workouts' ids. */
const ZONE = "this-week";
/** A row of the list below drags as "all:" + its id. */
const FROM_LIST = "all:";

export function WorkoutList({
  workouts,
  thisWeek,
  sortControl,
}: {
  workouts: WorkoutListRow[];
  thisWeek: string[];
  /** Recently edited / Highest rated, above the list. */
  sortControl: ReactNode;
}) {
  const byId = new Map(workouts.map((w) => [w.id, w]));
  // Saved ids of deleted workouts drop out here, and on the next save.
  const [week, setWeek] = useState(() => thisWeek.filter((id) => byId.has(id)));
  const [saving, startSaving] = useTransition();
  /** The list row being dragged in, and where in the week it would land. */
  const [incoming, setIncoming] = useState<WorkoutListRow | null>(null);
  const [landing, setLanding] = useState<number | null>(null);

  const shown = week.filter((id) => byId.has(id));
  const inWeek = new Set(shown);

  function save(next: string[]) {
    const before = week;
    setWeek(next); // optimistic
    startSaving(async () => {
      const res = await saveThisWeek(next);
      if (res.error) {
        setWeek(before);
        window.alert(res.error);
      }
    });
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // A row of the week reorders among the others. One dragged in from the list
  // lands only while the pointer is over the section, by its nearest row.
  const detect: CollisionDetection = (args) => {
    const rows = args.droppableContainers.filter((c) => c.id !== ZONE);
    if (!String(args.active.id).startsWith(FROM_LIST)) return closestCenter({ ...args, droppableContainers: rows });
    if (args.pointerCoordinates && !pointerWithin(args).length) return [];
    return closestCenter(rows.length ? { ...args, droppableContainers: rows } : args);
  };

  /** Where a row from the list would go: above or below the row it's over, or at the end. */
  function landingFor(active: Active, over: Over | null): number | null {
    if (!over || !String(active.id).startsWith(FROM_LIST)) return null;
    const at = shown.indexOf(String(over.id));
    if (at === -1) return shown.length;
    const r = active.rect.current.translated;
    const below = !!r && r.top + r.height / 2 > over.rect.top + over.rect.height / 2;
    return at + (below ? 1 : 0);
  }

  function onDragStart({ active }: DragStartEvent) {
    const id = String(active.id);
    if (id.startsWith(FROM_LIST)) setIncoming(byId.get(id.slice(FROM_LIST.length)) ?? null);
  }

  function onDragMove({ active, over }: DragMoveEvent) {
    setLanding(landingFor(active, over));
  }

  function onDragEnd({ active, over }: DragEndEvent) {
    const id = String(active.id);
    const at = landingFor(active, over);
    setIncoming(null);
    setLanding(null);
    if (id.startsWith(FROM_LIST)) {
      const workoutId = id.slice(FROM_LIST.length);
      if (at !== null && !inWeek.has(workoutId)) save([...shown.slice(0, at), workoutId, ...shown.slice(at)]);
      return;
    }
    if (!over || over.id === id) return;
    const from = shown.indexOf(id);
    const to = shown.indexOf(String(over.id));
    if (from !== -1 && to !== -1) save(arrayMove(shown, from, to));
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={detect}
      // The week's rows slide up and down in place; a row from the list follows the pointer.
      modifiers={incoming ? undefined : [restrictToVerticalAxis, restrictToParentElement]}
      onDragStart={onDragStart}
      onDragMove={onDragMove}
      onDragOver={onDragMove}
      onDragEnd={onDragEnd}
      onDragCancel={() => {
        setIncoming(null);
        setLanding(null);
      }}
    >
      <ThisWeek
        rows={shown.map((id) => byId.get(id)!)}
        landing={landing}
        dragging={!!incoming}
        saving={saving}
        onRemove={(id) => save(shown.filter((x) => x !== id))}
      />

      <div className="mt-10 flex justify-end">{sortControl}</div>
      <div className="mt-3 divide-y divide-zinc-200 rounded-xl border border-zinc-200">
        {workouts.map((w) => (
          <ListRow key={w.id} workout={w} inWeek={inWeek.has(w.id)} />
        ))}
      </div>

      {/* The row being dragged in; no drop animation, as it lands in the week. */}
      <DragOverlay dropAnimation={null}>
        {incoming && (
          <div className="flex cursor-grabbing items-center gap-4 rounded-xl bg-white p-4 shadow-lg ring-1 ring-zinc-200">
            <span className="flex h-8 w-7 shrink-0 items-center justify-center text-zinc-500">
              <GripIcon className="h-4 w-4" />
            </span>
            <Summary workout={incoming} />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}

function ThisWeek({
  rows,
  landing,
  dragging,
  saving,
  onRemove,
}: {
  rows: WorkoutListRow[];
  landing: number | null;
  /** A row from the list is being dragged. */
  dragging: boolean;
  saving: boolean;
  onRemove: (id: string) => void;
}) {
  const { setNodeRef } = useDroppable({ id: ZONE });
  const over = landing !== null;

  return (
    <section className="mt-8" aria-labelledby="this-week">
      <div className="flex items-baseline gap-3">
        <h2 id="this-week" className="text-lg font-semibold tracking-tight">
          This Week’s Workouts
        </h2>
        {saving && <span className="text-sm text-zinc-400">Saving…</span>}
      </div>
      <p className="text-sm text-zinc-500">Members see only these on the Workouts page, in this order.</p>
      <div
        ref={setNodeRef}
        className={`mt-3 rounded-xl border transition ${rows.length ? "" : "border-dashed"} ${
          over ? "border-violet-400 bg-violet-50/50 ring-2 ring-violet-200" : dragging ? "border-violet-300" : "border-zinc-300"
        }`}
      >
        {rows.length === 0 ? (
          <p className={`px-4 py-10 text-center text-sm ${over ? "font-medium text-violet-700" : "text-zinc-500"}`}>
            {over ? "Drop to add it" : "Drag a published workout here."}
          </p>
        ) : (
          <SortableContext items={rows.map((w) => w.id)} strategy={verticalListSortingStrategy}>
            <ol className="divide-y divide-zinc-200">
              {rows.map((w, i) => (
                <WeekRow
                  key={w.id}
                  workout={w}
                  line={landing === i ? "top" : landing === rows.length && i === rows.length - 1 ? "bottom" : null}
                  onRemove={() => onRemove(w.id)}
                />
              ))}
            </ol>
          </SortableContext>
        )}
      </div>
    </section>
  );
}

function WeekRow({
  workout: w,
  line,
  onRemove,
}: {
  workout: WorkoutListRow;
  /** Where a row dragged in from the list would land, against this one. */
  line: "top" | "bottom" | null;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: w.id,
  });
  return (
    <li
      ref={setNodeRef}
      // Translate, not Transform: a scale would stretch the row.
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={`relative flex items-center gap-4 bg-white p-4 first:rounded-t-xl last:rounded-b-xl ${
        isDragging ? "z-10 rounded-xl shadow-md ring-1 ring-zinc-200" : ""
      }`}
    >
      {line && (
        <span
          aria-hidden
          className={`pointer-events-none absolute inset-x-3 h-0.5 rounded-full bg-violet-500 ${
            line === "top" ? "-top-px" : "-bottom-px"
          }`}
        />
      )}
      <Grip handleRef={setActivatorNodeRef} attributes={attributes} listeners={listeners} label="Drag to reorder" />
      <Link href={`/admin/workouts/${w.id}`} className="flex min-w-0 flex-1 items-center gap-4">
        <Summary workout={w} week />
      </Link>
      <button
        type="button"
        onClick={onRemove}
        className="shrink-0 text-sm font-medium text-zinc-500 transition hover:text-zinc-900"
      >
        Remove
      </button>
    </li>
  );
}

function ListRow({ workout: w, inWeek }: { workout: WorkoutListRow; inWeek: boolean }) {
  // Only a published workout goes in the week, and only once.
  const addable = !!w.publishedAt && !inWeek;
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, isDragging } = useDraggable({
    id: FROM_LIST + w.id,
    disabled: !addable,
  });
  return (
    // The thumbnail and title open the builder; Preview, Edit and Delete sit on the right.
    <div
      ref={setNodeRef}
      className={`flex items-center gap-4 p-4 transition hover:bg-zinc-50 ${isDragging ? "opacity-40" : ""}`}
    >
      {addable ? (
        <Grip
          handleRef={setActivatorNodeRef}
          attributes={attributes}
          listeners={listeners}
          label="Drag into This Week’s Workouts"
        />
      ) : (
        <span className="w-7 shrink-0" />
      )}
      <Link href={`/admin/workouts/${w.id}`} className="flex min-w-0 flex-1 items-center gap-4">
        <Summary workout={w} inWeek={inWeek} />
      </Link>
      <div className="w-28 shrink-0">
        <RatingBadge rating={w.rating} />
      </div>
      <div className="flex shrink-0 items-center gap-5 text-sm font-medium">
        {/* The member view of the saved version (drafts show to admins only). */}
        <a href={`/workouts/${w.id}`} target="_blank" rel="noreferrer" className="text-zinc-500 transition hover:text-zinc-900">
          Preview ↗
        </a>
        <Link href={`/admin/workouts/${w.id}`} className="text-zinc-500 transition hover:text-zinc-900">
          Edit
        </Link>
        <DeleteWorkoutButton id={w.id} title={w.title} />
      </div>
    </div>
  );
}

/**
 * Thumbnail, title, status and the line under it. In the week (`week`) only a
 * draft is flagged, as members don't see it; in the list, "This week" too.
 */
function Summary({ workout: w, week = false, inWeek = false }: { workout: WorkoutListRow; week?: boolean; inWeek?: boolean }) {
  const badge = "shrink-0 rounded-full px-2 py-0.5 text-xs font-medium";
  return (
    <>
      <div className="relative h-14 w-11 shrink-0 overflow-hidden rounded bg-zinc-100">
        {w.coverImageUrl && <Image src={w.coverImageUrl} alt="" fill unoptimized className="object-cover" />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-medium">{w.title}</span>
          {week ? (
            !w.publishedAt && <span className={`${badge} bg-amber-100 text-amber-800`}>Draft · hidden from members</span>
          ) : (
            <span className={`${badge} ${w.publishedAt ? "bg-emerald-100 text-emerald-700" : "bg-zinc-100 text-zinc-600"}`}>
              {w.publishedAt ? "Published" : "Draft"}
            </span>
          )}
          {inWeek && <span className={`${badge} bg-violet-100 text-violet-700`}>This week</span>}
        </div>
        <p className="truncate text-sm text-zinc-500">
          {[
            w.totalSeconds ? `About ${aboutMinutes(w.totalSeconds)} min` : "Empty",
            `${w.exerciseCount} exercise${w.exerciseCount === 1 ? "" : "s"}`,
            w.hasWarmup && "warm-up",
            w.hasCooldown && "cool-down",
            LEVELS.find((l) => l.id === w.level)?.label,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </div>
    </>
  );
}

function Grip({
  handleRef,
  attributes,
  listeners,
  label,
}: {
  handleRef: (el: HTMLElement | null) => void;
  attributes: DraggableAttributes;
  listeners: DraggableSyntheticListeners;
  label: string;
}) {
  return (
    <button
      type="button"
      ref={handleRef}
      aria-label={label}
      title={label}
      className="flex h-8 w-7 shrink-0 cursor-grab touch-none items-center justify-center rounded-md text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 active:cursor-grabbing"
      {...attributes}
      {...listeners}
    >
      <GripIcon className="h-4 w-4" />
    </button>
  );
}
