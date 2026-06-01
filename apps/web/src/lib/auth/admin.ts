import "server-only";

import { auth } from "@clerk/nextjs/server";
import { notFound } from "next/navigation";

/** True when the signed-in user carries the admin role in their Clerk session claims. */
export async function isAdmin(): Promise<boolean> {
  const { sessionClaims } = await auth();
  return sessionClaims?.metadata?.role === "admin";
}

/**
 * Gate a server component or server action to admins only. Renders a 404 for
 * everyone else so we don't reveal that the admin area exists. This is the real
 * authorization boundary — the proxy gate is only an optimistic redirect.
 */
export async function requireAdmin(): Promise<void> {
  if (!(await isAdmin())) {
    notFound();
  }
}
