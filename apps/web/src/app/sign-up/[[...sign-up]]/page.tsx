import { SignUp } from "@clerk/nextjs";
import { getProduct } from "@/lib/products";

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

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect_url?: string }>;
}) {
  // Lets a caller send someone back where they started — a product's sales page
  // resuming its purchase, say — instead of the global AFTER_SIGN_UP_URL.
  const redirectUrl = safeRedirect((await searchParams).redirect_url);
  const source = sourceFrom(redirectUrl);

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 py-16">
      <SignUp
        forceRedirectUrl={redirectUrl}
        // Rides along on user.created, where the webhook turns it into a
        // Mailchimp source tag.
        unsafeMetadata={source ? { source } : undefined}
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
