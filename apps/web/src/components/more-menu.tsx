"use client";

import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { useClerk } from "@clerk/nextjs";
import {
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Monitor,
  Moon,
  Settings,
  Shield,
  Smartphone,
  Sun,
  type LucideIcon,
} from "lucide-react";
import {
  getAppearance,
  setAppearance,
  subscribeAppearance,
  type Appearance,
} from "@/lib/appearance";

/**
 * The member's appearance choice. Subscribing also keeps <html> in step while
 * the page is open — see subscribeAppearance().
 */
export function useAppearance(): Appearance {
  return useSyncExternalStore(subscribeAppearance, getAppearance, () => "auto");
}

/**
 * What ☰ More opens — a popover above the desktop sidebar's button, a sheet
 * from the bottom on a phone. The same items either way, so the two layouts
 * stay in step: what the old header menu held (Account settings, Help, Admin,
 * Sign out) plus Switch appearance.
 *
 * Only the contents: the sidebar and the tab bar each draw their own frame
 * around it.
 */
export function MoreMenu({
  admin,
  variant,
  onClose,
}: {
  admin: boolean;
  variant: "popover" | "sheet";
  onClose: () => void;
}) {
  const [panel, setPanel] = useState<"menu" | "appearance">("menu");
  const { signOut } = useClerk();
  const sheet = variant === "sheet";

  if (panel === "appearance") {
    return <AppearancePanel sheet={sheet} onBack={() => setPanel("menu")} />;
  }

  const row = rowClass(sheet);
  const icon = sheet ? 22 : 20;

  return (
    <div className="flex flex-col">
      <Link href="/account" onClick={onClose} className={row}>
        <Settings size={icon} className="shrink-0" aria-hidden="true" />
        Settings
      </Link>
      <button type="button" onClick={() => setPanel("appearance")} className={row}>
        <Moon size={icon} className="shrink-0" aria-hidden="true" />
        <span className="flex-1">Switch appearance</span>
        {sheet && (
          <ChevronRight size={18} className="shrink-0 text-zinc-400" aria-hidden="true" />
        )}
      </button>
      <Link href="/help" onClick={onClose} className={row}>
        <CircleHelp size={icon} className="shrink-0" aria-hidden="true" />
        Help
      </Link>

      <div aria-hidden="true" className="-mx-2 my-2 h-1.5 bg-black/[0.05] dark:bg-black/30" />

      {admin && (
        <>
          <Link href="/admin" onClick={onClose} className={row}>
            <Shield size={icon} className="shrink-0" aria-hidden="true" />
            Admin
          </Link>
          <div aria-hidden="true" className="-mx-2 my-2 h-px bg-zinc-200 dark:bg-white/10" />
        </>
      )}

      <button type="button" onClick={() => signOut()} className={row}>
        Sign out
      </button>
    </div>
  );
}

const OPTIONS: { value: Appearance; label: string; hint?: string }[] = [
  { value: "auto", label: "Automatic", hint: "Matches your device" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

function AppearancePanel({ sheet, onBack }: { sheet: boolean; onBack: () => void }) {
  const appearance = useAppearance();
  const size = sheet ? 22 : 20;
  const icons: Record<Appearance, LucideIcon> = {
    auto: sheet ? Smartphone : Monitor,
    light: Sun,
    dark: Moon,
  };

  return (
    <div className="flex flex-col">
      <div className={`flex items-center gap-1 pl-1 pr-2 ${sheet ? "h-[52px]" : "h-12"}`}>
        <button
          type="button"
          onClick={onBack}
          aria-label="Back"
          className={`flex shrink-0 items-center justify-center rounded-lg transition-colors hover:bg-black/5 dark:hover:bg-white/10 ${sheet ? "size-11" : "size-9"}`}
        >
          <ChevronLeft size={size} aria-hidden="true" />
        </button>
        <h2 className={`font-semibold ${sheet ? "text-[17px]" : "text-base"}`}>
          Switch appearance
        </h2>
      </div>
      <div aria-hidden="true" className="-mx-2 mt-1 mb-2 h-px bg-zinc-200 dark:bg-white/10" />

      <div role="radiogroup" aria-label="Appearance" className="flex flex-col">
        {OPTIONS.map((o) => {
          const on = appearance === o.value;
          const Icon = icons[o.value];
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => setAppearance(o.value)}
              className={rowClass(sheet, true)}
            >
              <Icon size={size} className="shrink-0" aria-hidden="true" />
              <span className="flex flex-1 flex-col gap-0.5">
                {o.label}
                {o.hint && (
                  <span className={`text-zinc-500 dark:text-zinc-400 ${sheet ? "text-[13px]" : "text-xs"}`}>
                    {o.hint}
                  </span>
                )}
              </span>
              <span
                aria-hidden="true"
                className={`shrink-0 rounded-full ${sheet ? "size-[22px]" : "size-5"} ${
                  on
                    ? `border-zinc-900 dark:border-zinc-50 ${sheet ? "border-[7px]" : "border-[6px]"}`
                    : "border-[1.5px] border-zinc-400 dark:border-zinc-500"
                }`}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** A menu row; `tall` for the appearance options, which can carry a hint line. */
function rowClass(sheet: boolean, tall = false) {
  const height = tall
    ? sheet ? "min-h-[60px] py-2" : "min-h-14 py-2"
    : sheet ? "h-[52px]" : "h-[50px]";
  return `flex w-full items-center px-4 text-left transition-colors hover:bg-black/5 dark:hover:bg-white/10 ${height} ${
    sheet ? "gap-3.5 rounded-[10px] text-base active:bg-black/5 dark:active:bg-white/10" : "gap-3 rounded-lg text-sm"
  }`;
}
