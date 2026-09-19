#!/usr/bin/env node
/**
 * Copy every Clerk user's name and email onto their RevenueCat customer.
 *
 * Going forward the Clerk webhook (app/api/webhooks/clerk) does this on
 * `user.created` and `user.updated`. This is for everyone who signed up before
 * it did. Safe to rerun — every write is idempotent.
 *
 * Usage, from apps/web:
 *
 *   node scripts/backfill-revenuecat-names.mjs           # dry run: list what would be written
 *   node scripts/backfill-revenuecat-names.mjs --apply   # write it
 *
 * Keys come from .env.local unless already set in the environment — and
 * .env.local holds the *development* Clerk key. To backfill production, set the
 * live key for the one command; it takes precedence:
 *
 *   CLERK_SECRET_KEY=sk_live_... node scripts/backfill-revenuecat-names.mjs --apply
 *
 * Every Clerk user ends up with a RevenueCat customer, created if they don't
 * have one yet — the same thing the webhook now does at signup.
 *
 * The attribute mapping mirrors syncCustomerAttributes in
 * lib/revenuecat-admin.ts, which can't be imported here (server-only
 * TypeScript). Keep the two in step.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

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

const apply = process.argv.includes("--apply");
const clerkKey = process.env.CLERK_SECRET_KEY;
const rcKey = process.env.REVENUECAT_SECRET_API_KEY;

if (!clerkKey || !rcKey) {
  console.error("CLERK_SECRET_KEY and REVENUECAT_SECRET_API_KEY must both be set.");
  process.exit(1);
}

const RC_API = "https://api.revenuecat.com/v1";
const rcHeaders = {
  Authorization: `Bearer ${rcKey}`,
  "Content-Type": "application/json",
};

/** Every Clerk user, oldest first, a page at a time. */
async function* clerkUsers() {
  const limit = 100;
  for (let offset = 0; ; offset += limit) {
    const res = await fetch(
      `https://api.clerk.com/v1/users?limit=${limit}&offset=${offset}&order_by=%2Bcreated_at`,
      { headers: { Authorization: `Bearer ${clerkKey}` } },
    );
    if (!res.ok) {
      throw new Error(`Clerk user list failed (${res.status}): ${await res.text()}`);
    }
    const page = await res.json();
    yield* page;
    if (page.length < limit) return;
  }
}

/** A RevenueCat request, waiting out a rate limit rather than failing on it. */
async function rc(url, init) {
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(url, { ...init, headers: rcHeaders });
    if (res.status !== 429 || attempt === 4) return res;
    const wait = Number(res.headers.get("retry-after")) || 2;
    await new Promise((r) => setTimeout(r, wait * 1000));
  }
}

function attributesFor(user) {
  const firstName = user.first_name?.trim() ?? "";
  const lastName = user.last_name?.trim() ?? "";
  const email =
    user.email_addresses?.find((e) => e.id === user.primary_email_address_id)
      ?.email_address ?? user.email_addresses?.[0]?.email_address;
  return {
    $displayName: [firstName, lastName].filter(Boolean).join(" "),
    $email: email?.trim() ?? "",
    first_name: firstName,
    last_name: lastName,
  };
}

async function sync(userId, values) {
  const subscriberUrl = `${RC_API}/subscribers/${encodeURIComponent(userId)}`;

  // Get-or-create: the attributes endpoint can't be relied on to create a
  // customer RevenueCat has never seen.
  const ensure = await rc(subscriberUrl, { method: "GET" });
  if (!ensure.ok) {
    throw new Error(`lookup/create failed (${ensure.status}): ${await ensure.text()}`);
  }

  const res = await rc(`${subscriberUrl}/attributes`, {
    method: "POST",
    body: JSON.stringify({
      attributes: Object.fromEntries(
        Object.entries(values).map(([key, value]) => [key, { value }]),
      ),
    }),
  });
  if (!res.ok) {
    throw new Error(`attribute update failed (${res.status}): ${await res.text()}`);
  }
}

const instance = clerkKey.startsWith("sk_live_") ? "PRODUCTION" : "development";
console.log(
  `${apply ? "Writing" : "Dry run —"} Clerk ${instance} users → RevenueCat\n`,
);

let total = 0;
let unnamed = 0;
const failures = [];

for await (const user of clerkUsers()) {
  total++;
  const values = attributesFor(user);
  if (!values.$displayName) unnamed++;
  const label = `${user.id}  ${values.$displayName || "(no name)"}  <${values.$email || "no email"}>`;

  if (!apply) {
    console.log(`  ${label}`);
    continue;
  }

  try {
    await sync(user.id, values);
    console.log(`  ✓ ${label}`);
  } catch (error) {
    failures.push(user.id);
    console.error(`  ✗ ${label} — ${error.message}`);
  }
}

console.log(
  `\n${total} users, ${total - unnamed} with a name.` +
    (apply
      ? ` ${total - failures.length} synced, ${failures.length} failed.`
      : " Nothing written — rerun with --apply."),
);

if (failures.length > 0) process.exit(1);
