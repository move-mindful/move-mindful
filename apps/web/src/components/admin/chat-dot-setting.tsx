"use client";

import { useState, useTransition } from "react";
import { saveChatDotAfter } from "@/app/actions/chat";

/**
 * Admin → Chat: how many new messages the room needs before the violet dot
 * shows on members' Chat tab. A trainer's post shows it straight away whatever
 * the number (lib/chat/dot-server.ts).
 */
export function ChatDotSetting({ initial, max }: { initial: number; max: number }) {
  const [saved, setSaved] = useState(initial);
  const [value, setValue] = useState(String(initial));
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startSaving] = useTransition();

  const n = Number(value);
  const valid = Number.isInteger(n) && n >= 1 && n <= max;

  function save() {
    if (!valid) return;
    setMessage(null);
    startSaving(async () => {
      const result = await saveChatDotAfter(n);
      if (result.value !== undefined) {
        setSaved(result.value);
        setValue(String(result.value));
        setMessage({ ok: true, text: "Saved." });
      } else {
        setMessage({ ok: false, text: result.error ?? "Couldn’t save that." });
      }
    });
  }

  return (
    <section className="rounded-xl border border-zinc-200 p-5">
      <h2 className="font-semibold">Chat dot</h2>
      <p className="mt-1 text-sm text-zinc-500">
        The violet dot on the Chat tab shows once this many new messages have come into the room since a member last
        looked. A trainer&rsquo;s post shows it straight away, whatever the number.
      </p>
      <form
        className="mt-4 flex flex-wrap items-center gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <label className="flex items-center gap-2 text-sm">
          Show after
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={max}
            step={1}
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setMessage(null);
            }}
            className="w-20 rounded-lg border border-zinc-300 px-3 py-1.5 text-sm tabular-nums"
          />
          {n === 1 ? "new message" : "new messages"}
        </label>
        <button
          type="submit"
          disabled={!valid || pending || n === saved}
          className="rounded-lg bg-zinc-900 px-4 py-1.5 text-sm font-medium text-white transition hover:bg-zinc-700 disabled:opacity-40"
        >
          {pending ? "Saving…" : "Save"}
        </button>
        {!valid && value !== "" && <span className="text-sm text-red-600">A whole number from 1 to {max}.</span>}
        {message && (
          <span role="status" className={`text-sm ${message.ok ? "text-green-700" : "text-red-600"}`}>
            {message.text}
          </span>
        )}
      </form>
    </section>
  );
}
