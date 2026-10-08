"use client";

import type { ReactNode } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { restrictToParentElement, restrictToVerticalAxis } from "@dnd-kit/modifiers";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripIcon } from "@/components/admin/grip-icon";

// A list whose rows are reordered by dragging a grip handle — the builder's
// blocks, and the exercises in a superset or circuit — with @dnd-kit, as the
// collections lists are (collection-reorder.tsx). The others slide aside as a
// row is dragged; near the window's edge the page scrolls along; the handle
// also works from the keyboard (Space to pick up, arrows, Space to drop). The
// first `fixed` rows (the warm-up) have no handle, and nothing goes above them.

export function SortableList<T>({
  items,
  keyOf,
  onMove,
  fixed = 0,
  className = "",
  children,
}: {
  items: T[];
  keyOf: (item: T) => string;
  onMove: (from: number, to: number) => void;
  fixed?: number;
  className?: string;
  /** A row, given its handle — null for a fixed row, which shows a gap in its place. */
  children: (item: T, index: number, handle: ReactNode) => ReactNode;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const from = items.findIndex((x) => keyOf(x) === active.id);
    const to = items.findIndex((x) => keyOf(x) === over.id);
    if (from >= fixed && to >= fixed) onMove(from, to);
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[restrictToVerticalAxis, restrictToParentElement]}
      onDragEnd={onDragEnd}
    >
      {/* Only the rows that move are sortable, so none can be dropped above a fixed one. */}
      <SortableContext items={items.slice(fixed).map(keyOf)} strategy={verticalListSortingStrategy}>
        <ol className={className}>
          {items.map((item, i) =>
            i < fixed ? (
              <li key={keyOf(item)}>{children(item, i, null)}</li>
            ) : (
              <SortableRow key={keyOf(item)} id={keyOf(item)}>
                {(handle) => children(item, i, handle)}
              </SortableRow>
            ),
          )}
        </ol>
      </SortableContext>
    </DndContext>
  );
}

function SortableRow({ id, children }: { id: string; children: (handle: ReactNode) => ReactNode }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id });
  const handle = (
    <button
      type="button"
      ref={setActivatorNodeRef}
      aria-label="Drag to reorder"
      title="Drag to reorder"
      className="flex h-8 w-7 shrink-0 cursor-grab touch-none items-center justify-center rounded-md text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 active:cursor-grabbing"
      {...attributes}
      {...listeners}
    >
      <GripIcon className="h-4 w-4" />
    </button>
  );
  return (
    <li
      ref={setNodeRef}
      // Translate, not Transform: rows differ in height, and a scale would stretch them.
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={isDragging ? "relative z-10 drop-shadow-lg" : undefined}
    >
      {children(handle)}
    </li>
  );
}
