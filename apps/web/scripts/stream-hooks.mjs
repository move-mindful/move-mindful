#!/usr/bin/env node
/**
 * Point Stream's two chat hooks at the site, once (or again if the domain
 * changes):
 *
 *   - the message.new event webhook → /api/webhooks/stream, which lights the
 *     violet dot on the Chat tab when a trainer posts;
 *   - the before-message-send hook → /api/webhooks/stream/before-send, which
 *     turns away a video from anyone who isn't a trainer.
 *
 * Usage, from apps/web:
 *
 *   node scripts/stream-hooks.mjs https://www.movemindful.com           # dry run: show what would change
 *   node scripts/stream-hooks.mjs https://www.movemindful.com --apply   # change it
 *
 * Keys come from .env.local unless already set in the environment; to use the
 * ones on Vercel, set them for the one command:
 *
 *   NEXT_PUBLIC_STREAM_API_KEY=... STREAM_API_SECRET=... node scripts/stream-hooks.mjs https://www.movemindful.com --apply
 *
 * Other event hooks on the Stream app are kept: Stream replaces the whole list
 * on each update, so this sends back what's there with ours added or updated.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { StreamChat } from "stream-chat";

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

const origin = process.argv.slice(2).find((a) => a.startsWith("https://"))?.replace(/\/+$/, "");
const apply = process.argv.includes("--apply");
const key = process.env.NEXT_PUBLIC_STREAM_API_KEY;
const secret = process.env.STREAM_API_SECRET;

if (!origin) {
  console.error("Give the site's address, e.g. node scripts/stream-hooks.mjs https://www.movemindful.com");
  process.exit(1);
}
if (!key || !secret) {
  console.error("NEXT_PUBLIC_STREAM_API_KEY and STREAM_API_SECRET must both be set.");
  process.exit(1);
}

const server = StreamChat.getInstance(key, secret);
const eventsUrl = `${origin}/api/webhooks/stream`;
const beforeSendUrl = `${origin}/api/webhooks/stream/before-send`;

const { app } = await server.getAppSettings();
const others = (app.event_hooks ?? []).filter((h) => h.webhook_url !== eventsUrl);
const update = {
  event_hooks: [...others, { enabled: true, hook_type: "webhook", webhook_url: eventsUrl, event_types: ["message.new"] }],
  before_message_send_hook_url: beforeSendUrl,
  // A cold start on Vercel can take longer than Stream's default 1.5 s, and
  // past it Stream lets the message through unchecked.
  before_message_send_hook_attempt_timeout_ms: 5000,
};

console.log("Event hooks now:", JSON.stringify(app.event_hooks ?? [], null, 2));
console.log("Before-send hook now:", app.before_message_send_hook_url || "(none)");
console.log("\nWill set:", JSON.stringify(update, null, 2));

if (!apply) {
  console.log("\nDry run. Add --apply to change it.");
  process.exit(0);
}

await server.updateAppSettings(update);
console.log("\nDone.");
