import "server-only";

import { headers } from "next/headers";

/**
 * The origin to bake into a Mux Direct Upload's CORS headers. The browser uploads
 * straight to a Google Cloud Storage signed URL, so Mux must allow our origin.
 * Derived from the request rather than hard-coded, so it works the same in
 * local, preview and production.
 */
export async function requestOrigin(): Promise<string> {
  const h = await headers();
  const origin = h.get("origin");
  if (origin) return origin;
  const host = h.get("host");
  if (host) {
    const proto = h.get("x-forwarded-proto") ?? "https";
    return `${proto}://${host}`;
  }
  return "*";
}
