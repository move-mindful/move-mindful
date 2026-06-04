"use server";

import { headers } from "next/headers";
import { requireAdmin } from "@/lib/auth/admin";
import { mux } from "@/lib/mux/client";

export interface CreatedUpload {
  /** The original filename — display only; files are matched back by array index. */
  name: string;
  /** Signed URL the browser streams the file bytes to (PUT, via UpChunk). */
  url: string;
}

export interface CreateUploadsResult {
  uploads: CreatedUpload[];
  error?: string;
}

// Upper bound on a single batch — keeps one click from minting hundreds of Mux
// uploads by accident. Generous enough for any realistic upload session.
const MAX_FILES = 50;

// Strip the extension for a cleaner Mux title; the admin renames on import anyway.
function titleFromFilename(name: string): string {
  const base = name.replace(/\.[^./\\]+$/, "").trim();
  return base || name;
}

// The browser uploads straight to a Google Cloud Storage signed URL, so Mux must
// bake our origin into that URL's CORS headers. Derive it from the request rather
// than hard-coding, so it works the same in local/preview/prod.
async function requestOrigin(): Promise<string> {
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

/**
 * Mint one Mux Direct Upload per selected file. Returns a signed PUT URL per file
 * (in the same order as `names`) that the browser streams the bytes to. Each
 * finished upload becomes a public Mux asset that surfaces in the Import list once
 * Mux finishes encoding. Secret keys stay server-side — the browser only ever sees
 * the short-lived signed URL.
 */
export async function createMuxDirectUploads(
  names: string[],
): Promise<CreateUploadsResult> {
  await requireAdmin();

  const clean = names.map((n) => (n ?? "").trim()).filter(Boolean);
  if (clean.length === 0) return { uploads: [], error: "No files selected." };
  if (clean.length > MAX_FILES) {
    return {
      uploads: [],
      error: `Please upload ${MAX_FILES} or fewer files at a time.`,
    };
  }

  const cors_origin = await requestOrigin();

  try {
    const uploads = await Promise.all(
      clean.map(async (name) => {
        const upload = await mux.video.uploads.create({
          cors_origin,
          new_asset_settings: {
            playback_policies: ["public"],
            meta: { title: titleFromFilename(name) },
          },
        });
        return { name, url: upload.url ?? "" };
      }),
    );

    if (uploads.some((u) => !u.url)) {
      return { uploads: [], error: "Mux did not return an upload URL. Try again." };
    }

    return { uploads };
  } catch (e) {
    return {
      uploads: [],
      error:
        e instanceof Error
          ? `Mux upload setup failed: ${e.message}`
          : "Mux upload setup failed.",
    };
  }
}
