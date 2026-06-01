"use client";

import { useUser, useClerk } from "@clerk/nextjs";
import Image from "next/image";
import Link from "next/link";
import { useState, useRef, useEffect } from "react";
import { Settings, HelpCircle, LogOut } from "lucide-react";

export function UserMenu() {
  const { user } = useUser();
  const { signOut } = useClerk();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (!user) return null;

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setOpen(!open)}
        className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full ring-2 ring-transparent transition hover:ring-zinc-300"
      >
        {user.imageUrl ? (
          <Image
            src={user.imageUrl}
            alt={user.fullName || "Profile"}
            width={32}
            height={32}
            className="rounded-full object-cover"
          />
        ) : (
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-200 text-sm font-medium text-zinc-600">
            {(user.firstName?.[0] || user.primaryEmailAddress?.emailAddress[0] || "?").toUpperCase()}
          </div>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-64 rounded-xl border border-zinc-200 bg-white py-2 shadow-lg">
          <div className="border-b border-zinc-100 px-4 pb-3 pt-2 pointer-events-none">
            <p className="text-sm font-medium">{user.fullName}</p>
            <p className="text-xs text-zinc-500">
              {user.primaryEmailAddress?.emailAddress}
            </p>
          </div>

          <div className="py-1">
            <Link
              href="/account"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-4 py-2 text-sm text-zinc-600 transition hover:bg-zinc-50"
            >
              <Settings className="h-4 w-4 text-zinc-400" />
              Account Settings
            </Link>
            <Link
              href="/help"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-4 py-2 text-sm text-zinc-600 transition hover:bg-zinc-50"
            >
              <HelpCircle className="h-4 w-4 text-zinc-400" />
              Help
            </Link>
          </div>

          <div className="border-t border-zinc-100 py-1">
            <button
              onClick={() => signOut()}
              className="flex w-full items-center gap-3 px-4 py-2 text-sm text-zinc-600 transition hover:bg-zinc-50"
            >
              <LogOut className="h-4 w-4 text-zinc-400" />
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

