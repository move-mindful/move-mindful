"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  restrictToParentElement,
  restrictToVerticalAxis,
} from "@dnd-kit/modifiers";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { formatClassDate } from "@/lib/format-date";
import {
  removeClassFromCollection,
  reorderClassesInCollection,
} from "@/app/actions/collections";
import { GripIcon } from "@/components/admin/grip-icon";

export interface ReorderClass {
  id: string;
  title: string;
  muxPlaybackId: string | null;
  publishedAt: string | null;
  classDate: string | null;
}

export function CollectionClassReorder({
  collectionId,
  initialMembers,
}: {
  collectionId: string;
  initialMembers: ReorderClass[];
}) {
  const [members, setMembers] = useState(initialMembers);
  const [, startTransition] = useTransition();

  // Re-sync to server truth whenever the page re-renders with a fresh list — e.g.
  // after a class is added or removed (those revalidate the route). The server
  // builds a new array each render, so the reference check fires on real updates.
  const [snapshot, setSnapshot] = useState(initialMembers);
  if (initialMembers !== snapshot) {
    setSnapshot(initialMembers);
    setMembers(initialMembers);
  }

  const sensors = useSensors(
    // A small drag threshold so a click on the Remove button isn't read as a drag.
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = members.findIndex((m) => m.id === active.id);
    const newIndex = members.findIndex((m) => m.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    const next = arrayMove(members, oldIndex, newIndex);
    setMembers(next); // optimistic — reflect the new order immediately
    startTransition(() => {
      reorderClassesInCollection(
        collectionId,
        next.map((m) => m.id),
      );
    });
  }

  if (members.length === 0) {
    return <p className="mt-2 text-sm text-zinc-500">No classes yet — add some below.</p>;
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[restrictToVerticalAxis, restrictToParentElement]}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={members.map((m) => m.id)} strategy={verticalListSortingStrategy}>
        <div className="mt-4 divide-y divide-zinc-200 rounded-xl border border-zinc-200">
          {members.map((c) => (
            <SortableClassRow key={c.id} member={c} collectionId={collectionId} />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

function SortableClassRow({
  member,
  collectionId,
}: {
  member: ReorderClass;
  collectionId: string;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id: member.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 bg-white p-3 ${
        isDragging ? "relative z-10 rounded-lg shadow-md ring-1 ring-zinc-200" : ""
      }`}
    >
      <button
        type="button"
        ref={setActivatorNodeRef}
        className="shrink-0 cursor-grab touch-none text-zinc-400 hover:text-zinc-600 active:cursor-grabbing"
        aria-label="Drag to reorder"
        {...attributes}
        {...listeners}
      >
        <GripIcon />
      </button>

      <div className="relative h-10 w-16 shrink-0 overflow-hidden rounded bg-zinc-100">
        {member.muxPlaybackId && (
          <Image
            src={`https://image.mux.com/${member.muxPlaybackId}/thumbnail.webp?width=160&height=100&fit_mode=smartcrop`}
            alt=""
            fill
            unoptimized
            className="object-cover"
          />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm">
          {member.title}
          {!member.publishedAt && <span className="ml-2 text-xs text-amber-600">draft</span>}
        </p>
        {member.classDate && (
          <p className="text-xs text-zinc-400">{formatClassDate(member.classDate)}</p>
        )}
      </div>

      <form action={removeClassFromCollection}>
        <input type="hidden" name="collectionId" value={collectionId} />
        <input type="hidden" name="classId" value={member.id} />
        <button type="submit" className="text-sm text-red-600 hover:underline">
          Remove
        </button>
      </form>
    </div>
  );
}
