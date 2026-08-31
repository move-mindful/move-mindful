import { SignUp } from "@clerk/nextjs";
import { cookies } from "next/headers";
import { getProduct } from "@/lib/products";
import { MC_COOKIE, isValidContactId } from "@/lib/manychat-contact";

/**
 * Only same-origin relative paths are honoured. `redirect_url` comes from the
 * query string, so anything else — an absolute URL, or a protocol-relative
 * "//evil.com" — would turn sign-up into an open redirect.
 */
function safeRedirect(value: string | undefined): string | undefined {
  if (!value) return undefined;
  if (!value.startsWith("/") || value.startsWith("//")) return undefined;
  return value;
}

/**
 * Which product page someone signed up from, if any.
 *
 * Validated against the known product slugs rather than taken at face value:
 * the value ends up as a Mailchimp tag, and unchecked query-string input would
 * let anyone litter the audience with arbitrary tags.
 */
function sourceFrom(redirectUrl: string | undefined): string | undefined {
  if (!redirectUrl) return undefined;
  const slug = redirectUrl.split("?")[0].replace(/^\//, "").split("/")[0];
  return getProduct(slug)?.slug;
}

/**
 * The ManyChat contact id the proxy stashed when they arrived from a DM link.
 *
 * Re-validated on the way out even though the proxy validated it on the way in
 * — a cookie is client-supplied like any other request header, and this one is
 * about to be written into Clerk metadata.
 */
async function manyChatContactId(): Promise<string | undefined> {
  const value = (await cookies()).get(MC_COOKIE)?.value;
  return isValidContactId(value) ? value : undefined;
}

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect_url?: string }>;
}) {
  // Lets a caller send someone back where they started — a product's sales page
  // resuming its purchase, say — instead of the global AFTER_SIGN_UP_URL.
  const redirectUrl = safeRedirect((await searchParams).redirect_url);
  const source = sourceFrom(redirectUrl);
  const mc = await manyChatContactId();

  // `unsafeMetadata` is the only channel Clerk's <SignUp> offers, so it is what
  // both of these ride on. It is client-writable, which is fine for `source`
  // (worst case someone mislabels themselves) but not for `mc` — a forged
  // contact id would tag a stranger. The user.created webhook promotes it to
  // privateMetadata and everything downstream reads it from there.
  const metadata = {
    ...(source ? { source } : {}),
    ...(mc ? { mc } : {}),
  };

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 py-16">
      <SignUp
        forceRedirectUrl={redirectUrl}
        // Rides along on user.created, where the webhook turns it into a
        // Mailchimp source tag and a ManyChat contact join.
        unsafeMetadata={Object.keys(metadata).length > 0 ? metadata : undefined}
      />
      {/* Notice rather than a checkbox: enough to make the soft opt-in
          defensible without adding a conversion-costing gate. */}
      <p className="max-w-sm px-6 text-center text-xs text-zinc-500">
        We&apos;ll send you occasional emails about classes and new releases.
        Unsubscribe any time.
      </p>
    </div>
  );
}
