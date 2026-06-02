"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  LIVE_SCHEDULE,
  classColor,
  formatAzTime,
  type ScheduleEntry,
} from "@/lib/live-schedule";

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_LABELS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// JS getDay(): 0 = Sun … 6 = Sat. Schedule weekday (ISO): 1 = Mon … 7 = Sun.
function isoWeekday(jsDay: number): number {
  return jsDay === 0 ? 7 : jsDay;
}

function classesForWeekday(weekday: number): ScheduleEntry[] {
  return LIVE_SCHEDULE.filter((s) => s.weekday === weekday).sort(
    (a, b) => a.hour * 60 + a.minute - (b.hour * 60 + b.minute),
  );
}

export function ScheduleCalendar() {
  const today = new Date();
  const [view, setView] = useState({
    year: today.getFullYear(),
    month: today.getMonth(), // 0-indexed
  });

  const firstDay = new Date(view.year, view.month, 1);
  const leadingBlanks = firstDay.getDay(); // 0 = Sun
  const daysInMonth = new Date(view.year, view.month + 1, 0).getDate();

  // Build a flat list of cells: leading blanks (null) then day numbers.
  const cells: (number | null)[] = [
    ...Array<null>(leadingBlanks).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  // Trailing blanks to complete the final week row.
  while (cells.length % 7 !== 0) cells.push(null);

  function shiftMonth(delta: number) {
    setView((v) => {
      const next = new Date(v.year, v.month + delta, 1);
      return { year: next.getFullYear(), month: next.getMonth() };
    });
  }

  const isCurrentMonth =
    view.year === today.getFullYear() && view.month === today.getMonth();

  return (
    <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
        <h2 className="text-lg font-semibold tracking-tight">
          {MONTH_LABELS[view.month]} {view.year}
        </h2>
        <div className="flex items-center gap-1">
          <button
            onClick={() => shiftMonth(-1)}
            aria-label="Previous month"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 transition hover:bg-zinc-100"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            onClick={() => shiftMonth(1)}
            aria-label="Next month"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 transition hover:bg-zinc-100"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Weekday header */}
      <div className="grid grid-cols-7 border-b border-zinc-200 bg-zinc-50">
        {WEEKDAY_LABELS.map((label) => (
          <div
            key={label}
            className="px-1 py-2 text-center text-xs font-medium uppercase tracking-wide text-zinc-400"
          >
            <span className="hidden sm:inline">{label}</span>
            <span className="sm:hidden">{label[0]}</span>
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7">
        {cells.map((day, i) => {
          if (day === null) {
            return <div key={`blank-${i}`} className="min-h-20 border-b border-r border-zinc-100 bg-zinc-50/40 last:border-r-0" />;
          }

          const cellDate = new Date(view.year, view.month, day);
          const entries = classesForWeekday(isoWeekday(cellDate.getDay()));
          const isToday =
            isCurrentMonth && day === today.getDate();

          return (
            <div
              key={day}
              className="min-h-20 border-b border-r border-zinc-100 p-1.5 last:border-r-0 sm:min-h-28 sm:p-2"
            >
              <div
                className={`mb-1 flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium ${
                  isToday ? "bg-zinc-900 text-white" : "text-zinc-500"
                }`}
              >
                {day}
              </div>
              <div className="space-y-1">
                {entries.map((e, idx) => (
                  <div
                    key={idx}
                    className={`rounded px-1 py-0.5 text-[10px] leading-tight sm:text-xs ${
                      classColor[e.title] ?? "bg-zinc-100 text-zinc-600"
                    }`}
                    title={`${e.title} · ${formatAzTime(e.hour, e.minute)} AZ`}
                  >
                    <span className="block font-medium">
                      {formatAzTime(e.hour, e.minute)}
                    </span>
                    <span className="block truncate">{e.title}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <p className="border-t border-zinc-200 px-4 py-2 text-xs text-zinc-400">
        All times shown in Arizona (MST). Same classes repeat every week.
      </p>
    </div>
  );
}
