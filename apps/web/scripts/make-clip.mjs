#!/usr/bin/env node
/**
 * Cut a short clip out of an existing Mux asset, as a new asset.
 *
 * For anything a public page has to play: hero loops, class previews. It has to
 * be a separate asset rather than the real video with a stop time, because the
 * class assets use Mux's public playback policy — the playback id *is* the
 * video, so publishing one hands over the whole class. Same reason the product
 * page keeps playback ids away from unentitled viewers.
 *
 * Mux cuts server-side from the existing master: no re-upload, and you pay
 * encoding and storage on the clip's length only.
 *
 * Usage, from apps/web:
 *
 *   node scripts/make-clip.mjs --source <playbackId> --start 50 --end 66 \
 *     --title "Posture — hero loop"
 *
 * Source playback ids live in src/lib/products.ts. Times are seconds, and
 * accept mm:ss too. Add --mp4 for a downloadable/`<video>`-friendly rendition
 * (wanted for a background loop, unnecessary for anything played through Mux
 * Player). Prints the new playback id to paste back into products.ts.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import Mux from "@mux/mux-node";

const here = dirname(fileURLToPath(import.meta.url));

/** Minimal .env.local reader — this runs outside Next, so nothing loads it. */
function loadEnv() {
  for (const file of [".env.local", ".env"]) {
    let text;
    try {
      text = readFileSync(resolve(here, "..", file), "utf8");
    } catch {
      continue;
    }
    for (const line of text.split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!m) continue;
      const [, key, raw] = m;
      if (process.env[key]) continue;
      process.env[key] = raw.replace(/^["']|["']$/g, "");
    }
  }
}

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
}

/** Seconds, or mm:ss / h:mm:ss. */
function seconds(value, label) {
  if (value === undefined) throw new Error(`Missing --${label}`);
  const parts = String(value).split(":").map(Number);
  if (parts.some((n) => !Number.isFinite(n))) {
    throw new Error(`--${label} must be seconds or mm:ss, got "${value}"`);
  }
  return parts.reduce((total, n) => total * 60 + n, 0);
}

loadEnv();

const source = arg("source");
const title = arg("title") ?? "Clip";
const wantMp4 = process.argv.includes("--mp4");

if (!source) {
  console.error(
    "Usage: node scripts/make-clip.mjs --source <playbackId> --start <t> --end <t> [--title T] [--mp4]",
  );
  process.exit(1);
}

const start = seconds(arg("start"), "start");
const end = seconds(arg("end"), "end");
if (end - start < 0.5) throw new Error("--end must be after --start");

if (!process.env.MUX_TOKEN_ID || !process.env.MUX_TOKEN_SECRET) {
  console.error("MUX_TOKEN_ID / MUX_TOKEN_SECRET not found in env or .env.local");
  process.exit(1);
}

const mux = new Mux({
  tokenId: process.env.MUX_TOKEN_ID,
  tokenSecret: process.env.MUX_TOKEN_SECRET,
});

// The clip input addresses the *asset*, but products.ts stores playback ids.
const playback = await mux.video.playbackIds.retrieve(source);
const sourceAssetId = playback.object?.id;
if (playback.object?.type !== "asset" || !sourceAssetId) {
  throw new Error(`Playback id ${source} does not belong to an asset`);
}

console.log(`source asset ${sourceAssetId} → clip ${start}s–${end}s (${end - start}s)`);

const asset = await mux.video.assets.create({
  inputs: [{ url: `mux://assets/${sourceAssetId}`, start_time: start, end_time: end }],
  playback_policies: ["public"],
  ...(wantMp4 ? { static_renditions: [{ resolution: "720p" }] } : {}),
  meta: { title },
  passthrough: `clip-of-${sourceAssetId}`,
});

const playbackId =
  asset.playback_ids?.find((p) => p.policy === "public")?.id ??
  asset.playback_ids?.[0]?.id;

console.log(`\nasset id     ${asset.id}`);
console.log(`playback id  ${playbackId}`);
console.log(`status       ${asset.status} (encoding takes a moment)`);
if (wantMp4) {
  console.log(`mp4          https://stream.mux.com/${playbackId}/720p.mp4`);
}
