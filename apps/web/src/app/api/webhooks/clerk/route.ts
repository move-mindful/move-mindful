import { Webhook } from "svix";
import { subscribeToAudience } from "@/lib/mailchimp";
import { SIGNUP_TAG, sourceTag } from "@/lib/audience-tags";

/**
 * Clerk webhook receiver — subscribes new users to the Mailchimp audience,
 * tagged with where they signed up from.
 *
 * Public by necessity (Clerk isn't a signed-in user), so the Svix signature is
 * the only thing standing between this and anyone who finds the URL. Without
 * verification, a stranger could POST arbitrary emails into the marketing list.
 */

interface ClerkUserCreated {
  type: string;
  data: {
    id: string;
    first_name?: string | null;
    last_name?: string | null;
    primary_email_address_id?: string | null;
    email_addresses?: Array<{ id: string; email_address: string }>;
    unsafe_metadata?: { source?: string };
  };
}

export async function POST(request: Request) {
  const secret = process.env.CLERK_WEBHOOK_SIGNING_SECRET;
  if (!secret) {
    console.error("[clerk-webhook] CLERK_WEBHOOK_SIGNING_SECRET is not set");
    // 500, not 200: Clerk should retry once this is configured rather than
    // treating a dropped signup as delivered.
    return new Response("Not configured", { status: 500 });
  }

  // The raw body is what was signed, so read text and verify before parsing.
  const body = await request.text();
  const headers = {
    "svix-id": request.headers.get("svix-id") ?? "",
    "svix-timestamp": request.headers.get("svix-timestamp") ?? "",
    "svix-signature": request.headers.get("svix-signature") ?? "",
  };

  let event: ClerkUserCreated;
  try {
    event = new Webhook(secret).verify(body, headers) as ClerkUserCreated;
  } catch (error) {
    console.error("[clerk-webhook] signature verification failed", error);
    return new Response("Invalid signature", { status: 400 });
  }

  if (event.type !== "user.created") {
    // Acknowledge everything else so Clerk doesn't retry events we ignore.
    return new Response("Ignored", { status: 200 });
  }

  const { data } = event;
  const email =
    data.email_addresses?.find((e) => e.id === data.primary_email_address_id)
      ?.email_address ?? data.email_addresses?.[0]?.email_address;

  if (!email) {
    console.warn("[clerk-webhook] user.created with no email", data.id);
    return new Response("No email", { status: 200 });
  }

  // Set by the sign-up page from the product slug someone signed up on, so
  // ManyChat cohorts stay separable in Mailchimp. Free-class signups and
  // Posture Reset buyers behave very differently, and reconstructing that
  // split later is far harder than recording it now.
  const source = data.unsafe_metadata?.source;

  await subscribeToAudience({
    email,
    firstName: data.first_name,
    lastName: data.last_name,
    tags: [SIGNUP_TAG, ...(source ? [sourceTag(source)] : [])],
  });

  // Always 200 once verified: a Mailchimp failure is logged, not retried
  // forever. The account exists either way and the signup already succeeded.
  return new Response("OK", { status: 200 });
}
