"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
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
import { setCollectionPublished, reorderCollections } from "@/app/actions/collections";
import { DeleteCollectionButton } from "@/components/admin/delete-collection-button";
import { GripIcon } from "@/components/admin/grip-icon";

export interface ReorderCollection {
  id: string;
  title: string;
  kind: "manual" | "smart";
  publishedAt: string | null;
  itemCount: number;
}

export function CollectionReorder({
  initialCollections,
}: {
  initialCollections: ReorderCollection[];
}) {
  const [collections, setCollections] = useState(initialCollections);
  const [, startTransition] = useTransition();

  // Re-sync to server truth after a create/delete/publish revalidates the route.
  const [snapshot, setSnapshot] = useState(initialCollections);
  if (initialCollections !== snapshot) {
    setSnapshot(initialCollections);
    setCollections(initialCollections);
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = collections.findIndex((c) => c.id === active.id);
    const newIndex = collections.findIndex((c) => c.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    const next = arrayMove(collections, oldIndex, newIndex);
    setCollections(next); // optimistic
    startTransition(() => {
      reorderCollections(next.map((c) => c.id));
    });
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[restrictToVerticalAxis, restrictToParentElement]}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={collections.map((c) => c.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="mt-8 divide-y divide-zinc-200 rounded-xl border border-zinc-200">
          {collections.map((c) => (
            <SortableCollectionRow key={c.id} collection={c} />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

function SortableCollectionRow({ collection: c }: { collection: ReorderCollection }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id: c.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  const published = !!c.publishedAt;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-4 bg-white p-4 ${
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

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/admin/collections/${c.id}`}
            className="truncate font-medium hover:underline"
          >
            {c.title}
          </Link>
          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600">
            {c.kind === "smart" ? "Smart" : "Manual"}
          </span>
          {published ? (
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
              Published
            </span>
          ) : (
            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600">
              Draft
            </span>
          )}
        </div>
        <p className="mt-0.5 text-sm text-zinc-500">
          {c.kind === "smart"
            ? `${c.itemCount} rule tag${c.itemCount !== 1 ? "s" : ""}`
            : `${c.itemCount} class${c.itemCount !== 1 ? "es" : ""}`}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-4">
        <form action={setCollectionPublished}>
          <input type="hidden" name="id" value={c.id} />
          <input type="hidden" name="publish" value={published ? "false" : "true"} />
          <button type="submit" className="text-sm text-zinc-600 hover:underline">
            {published ? "Unpublish" : "Publish"}
          </button>
        </form>
        <Link
          href={`/admin/collections/${c.id}`}
          className="text-sm text-zinc-600 hover:underline"
        >
          Edit
        </Link>
        <DeleteCollectionButton id={c.id} title={c.title} />
      </div>
    </div>
  );
}
