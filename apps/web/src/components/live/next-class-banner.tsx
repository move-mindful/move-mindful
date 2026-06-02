"use client";

import { DateTime } from "luxon";
import { useEffect, useState } from "react";
import { ARIZONA_ZONE, LIVE_SCHEDULE, type ScheduleEntry } from "@/lib/live-schedule";

interface NextClass extends ScheduleEntry {
  time: DateTime;
}

// Find the class that is live right now, or the soonest upcoming one. `now` must
// already be in Arizona time so the schedule's hour/minute line up.
function getCurrentOrNextClass(now: DateTime): NextClass {
  let soonest: NextClass | undefined;

  for (const s of LIVE_SCHEDULE) {
    // Luxon keeps `weekday` within the current Mon–Sun week.
    let classTime = now.set({
      weekday: s.weekday as 1 | 2 | 3 | 4 | 5 | 6 | 7,
      hour: s.hour,
      minute: s.minute,
      second: 0,
      millisecond: 0,
    });

    const classEnd = classTime.plus({ minutes: s.duration });

    if (now >= classTime && now < classEnd) {
      return { ...s, time: classTime };
    }

    if (classTime < now) {
      classTime = classTime.plus({ weeks: 1 });
    }

    if (!soonest || classTime < soonest.time) {
      soonest = { ...s, time: classTime };
    }
  }

  // The schedule is never empty, so `soonest` is always assigned here.
  return soonest as NextClass;
}

export function NextClassBanner() {
  const [content, setContent] = useState<React.ReactNode>(
    <span className="text-zinc-400">Loading next class info…</span>,
  );
  const [live, setLive] = useState(false);

  useEffect(() => {
    function update() {
      const nowAz = DateTime.now().setZone(ARIZONA_ZONE);
      const next = getCurrentOrNextClass(nowAz);
      const classTimeAz = next.time;
      const classEndAz = classTimeAz.plus({ minutes: next.duration });

      if (nowAz >= classTimeAz && nowAz < classEndAz) {
        setLive(true);
        setContent(<strong>{next.title} is now live! Click play! ▶</strong>);
        return;
      }

      setLive(false);
      const localZone = DateTime.local().zoneName;
      const nextLocal = classTimeAz.setZone(localZone);
      const diff = nextLocal
        .diffNow(["days", "hours", "minutes", "seconds"])
        .toObject();

      const dayOfWeek = nextLocal.toFormat("cccc");
      const timeLocal = nextLocal.toFormat("h:mm a");

      setContent(
        <>
          Next class: <strong>{next.title}</strong> on{" "}
          <strong>{dayOfWeek}</strong> at <strong>{timeLocal}</strong> your time
          <span className="mt-1.5 block text-base font-normal text-zinc-500">
            Starts in {Math.max(0, Math.floor(diff.days ?? 0))}d{" "}
            {Math.max(0, Math.floor(diff.hours ?? 0))}h{" "}
            {Math.max(0, Math.floor(diff.minutes ?? 0))}m{" "}
            {Math.max(0, Math.floor(diff.seconds ?? 0))}s
          </span>
        </>,
      );
    }

    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div
      className={`text-center text-xl font-medium sm:text-2xl ${
        live ? "text-emerald-600" : "text-zinc-800"
      }`}
    >
      {content}
    </div>
  );
}
