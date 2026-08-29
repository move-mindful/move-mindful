import "server-only";

import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/auth/admin";
import { MEMBER_HOME } from "@/lib/routes";

/**
 * Gate a section that's built but not yet released to members.
 *
 * The class library and the live stream are on hold while the one-time-purchase
 * product is the only thing for sale, and they'll come back under the membership
 * entitlement rather than the one-time one. Until then they stay hidden from the
 * member nav and locked to admins, so the pages can still be previewed but a
 * member who guesses (or bookmarks) the URL is bounced out.
 *
 * This is the authoritative check — the matching redirect in `proxy.ts` is only
 * optimistic (it reads the role off the session token). A redirect rather than a
 * 404: the sections aren't a secret, they're just not open yet.
 *
 * To release a section, drop its call to this and restore its nav link in
 * `app/(member)/layout.tsx`.
 */
export async function requireSectionUnlocked(): Promise<void> {
  if (await isAdmin()) return;
  redirect(MEMBER_HOME);
}
