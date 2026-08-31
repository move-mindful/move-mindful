#!/usr/bin/env node
/**
 * Delete Mux assets by id. Permanent — Mux keeps no copy.
 *
 * The companion to make-clip.mjs: recutting a preview or a hero loop leaves the
 * old asset behind, still billing storage and still publicly playable by anyone
 * who noted its playback id.
 *
 * Usage, from apps/web:
 *
 *   node scripts/delete-asset.mjs <assetId> [<assetId> ...]
 *
 * It prints each asset's title and duration and asks for confirmation, so a
 * mistyped id fails loudly rather than removing a class. Pass --yes to skip the
 * prompt (for a scripted cleanup you have already checked).
 */

import { readFileSync } from "node:fs";
import { createInterface } from "node:readline/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
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

const skipPrompt = process.argv.includes("--yes");
const ids = process.argv.slice(2).filter((a) => !a.startsWith("--"));

if (ids.length === 0) {
  console.error("Usage: node scripts/delete-asset.mjs <assetId> [...] [--yes]");
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

// Show what each id actually is before removing it — an id is unreadable, and
// the classes and the clips live in the same account.
const targets = [];
for (const id of ids) {
  try {
    const asset = await mux.video.assets.retrieve(id);
    targets.push(asset);
    console.log(
      `${id}\n  title    ${asset.meta?.title ?? "(untitled)"}\n  duration ${asset.duration ?? "?"}s\n  created  ${asset.created_at}`,
    );
  } catch (e) {
    console.error(`${id}\n  NOT FOUND — ${e instanceof Error ? e.message : e}`);
  }
}

if (targets.length === 0) process.exit(1);

if (!skipPrompt) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question(
    `\nPermanently delete ${targets.length} asset(s)? [y/N] `,
  );
  rl.close();
  if (answer.trim().toLowerCase() !== "y") {
    console.log("Nothing deleted.");
    process.exit(0);
  }
}

for (const asset of targets) {
  await mux.video.assets.delete(asset.id);
  console.log(`deleted ${asset.id}`);
}
