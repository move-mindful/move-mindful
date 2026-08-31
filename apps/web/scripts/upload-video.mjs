#!/usr/bin/env node
/**
 * Upload a local video file to Mux as a new asset.
 *
 * The companion to make-clip.mjs, which only cuts clips from assets Mux already
 * has. This is for footage that starts life on your machine.
 *
 * Usage, from apps/web:
 *
 *   node scripts/upload-video.mjs <file> --title "Posture hero loop" [--mp4]
 *
 * `--mp4` requests a 720p **static rendition**, which is what makes
 * `https://stream.mux.com/<playbackId>/720p.mp4` resolve. Anything played
 * through a plain <video> tag rather than Mux Player needs it — without it Mux
 * serves HLS only and that URL 404s, which looks like the video silently
 * failing to appear. The admin uploader (app/actions/uploads.ts) deliberately
 * doesn't set it: classes play through Mux Player, which uses HLS.
 *
 * Assets are created with a **public** playback policy, matching everything
 * else here. The playback id alone streams the video, so only upload things you
 * are happy to have public.
 */

import { readFileSync, statSync, createReadStream } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve, basename } from "node:path";
import Mux from "@mux/mux-node";

const here = dirname(fileURLToPath(import.meta.url));

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
      if (process.env[m[1]]) continue;
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
}

loadEnv();

const argv = process.argv.slice(2);
const wantMp4 = argv.includes("--mp4");
const titleIdx = argv.indexOf("--title");
const file = argv.find((a) => !a.startsWith("--") && argv[titleIdx + 1] !== a);
const title =
  titleIdx !== -1 && argv[titleIdx + 1] ? argv[titleIdx + 1] : basename(file ?? "");

if (!file) {
  console.error(
    'Usage: node scripts/upload-video.mjs <file> --title "..." [--mp4]',
  );
  process.exit(1);
}

const path = resolve(process.cwd(), file);
let size;
try {
  size = statSync(path).size;
} catch {
  console.error(`No such file: ${path}`);
  process.exit(1);
}

if (!process.env.MUX_TOKEN_ID || !process.env.MUX_TOKEN_SECRET) {
  console.error("MUX_TOKEN_ID / MUX_TOKEN_SECRET not found in env or .env.local");
  process.exit(1);
}

const mux = new Mux({
  tokenId: process.env.MUX_TOKEN_ID,
  tokenSecret: process.env.MUX_TOKEN_SECRET,
});

const mb = (size / 1024 / 1024).toFixed(1);
console.log(`uploading ${basename(path)} (${mb} MB) as "${title}"`);

const upload = await mux.video.uploads.create({
  // The signed PUT target is single-use and short-lived; no browser is involved
  // here, but Mux requires the field.
  cors_origin: "*",
  new_asset_settings: {
    playback_policies: ["public"],
    ...(wantMp4 ? { static_renditions: [{ resolution: "720p" }] } : {}),
    meta: { title },
  },
});

if (!upload.url) {
  console.error("Mux did not return an upload URL");
  process.exit(1);
}

// Stream rather than buffer — these files are large enough that reading one
// into memory is pointless.
const put = await fetch(upload.url, {
  method: "PUT",
  headers: { "Content-Length": String(size) },
  body: createReadStream(path),
  duplex: "half",
});

if (!put.ok) {
  console.error(`Upload failed (${put.status})`, await put.text());
  process.exit(1);
}

console.log("uploaded — waiting for Mux to encode");

async function waitFor(check, label, tries = 120) {
  for (let i = 0; i < tries; i++) {
    const result = await check();
    if (result) return result;
    await new Promise((r) => setTimeout(r, 5000));
  }
  throw new Error(`Timed out waiting for ${label}`);
}

const assetId = await waitFor(async () => {
  const u = await mux.video.uploads.retrieve(upload.id);
  return u.asset_id ?? null;
}, "the asset to be created");

const asset = await waitFor(async () => {
  const a = await mux.video.assets.retrieve(assetId);
  if (a.status === "errored") {
    throw new Error(`Mux failed to encode: ${JSON.stringify(a.errors)}`);
  }
  return a.status === "ready" ? a : null;
}, "encoding to finish");

const playbackId =
  asset.playback_ids?.find((p) => p.policy === "public")?.id ??
  asset.playback_ids?.[0]?.id;

console.log(`\nasset id     ${asset.id}`);
console.log(`playback id  ${playbackId}`);
console.log(`duration     ${asset.duration}s`);
if (wantMp4) {
  const renditions = asset.static_renditions?.files?.map((f) => f.name) ?? [];
  console.log(`mp4          https://stream.mux.com/${playbackId}/720p.mp4`);
  console.log(
    `renditions   ${renditions.length ? renditions.join(", ") : "still processing — the mp4 URL 404s until one appears"}`,
  );
}
