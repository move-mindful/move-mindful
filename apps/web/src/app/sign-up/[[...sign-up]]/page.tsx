import { SignUp } from "@clerk/nextjs";

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

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect_url?: string }>;
}) {
  // Lets a caller send someone back where they started — a product's sales page
  // resuming its purchase, say — instead of the global AFTER_SIGN_UP_URL.
  const redirectUrl = safeRedirect((await searchParams).redirect_url);

  return (
    <div className="flex flex-1 items-center justify-center py-16">
      <SignUp forceRedirectUrl={redirectUrl} />
    </div>
  );
}
