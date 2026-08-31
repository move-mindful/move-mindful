import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { MEMBER_HOME } from "@/lib/routes";
import { PRODUCTS } from "@/lib/products";

const isPublicRoute = createRouteMatcher([
  "/",
  "/pricing",
  "/sign-in(.*)",
  "/sign-up(.*)",
  // Hidden free-membership signup. The /join/[code]/activate route does its own
  // auth check and grant; the signup page itself must load while signed out.
  "/join(.*)",
  // Webhook receivers. Necessarily unauthenticated — the caller is another
  // service, not a signed-in user — so each route authenticates its own caller
  // before trusting anything in the payload: Clerk's verifies the Svix
  // signature, RevenueCat's compares a shared secret (RevenueCat does not sign
  // its payloads).
  //
  // Anything reached by a machine belongs on this list. Without it the proxy
  // 307s the POST to /sign-in, which a sender reports as a delivery failure
  // rather than an auth error — a confusing way to lose events silently.
  "/api/webhooks/clerk",
  "/api/webhooks/revenuecat",
  // Product sales pages — the URLs you advertise, so they must load signed out.
  // Only the landing page is public: the page renders its own locked state and
  // never emits playback ids to an unentitled viewer. The /<product>/<video>
  // player routes are deliberately NOT listed, so they still require sign-in.
  ...PRODUCTS.map((p) => `/${p.slug}`),
]);

const isAdminRoute = createRouteMatcher(["/admin(.*)"]);

// Sections that are built but not released to members yet — admins only for now.
// See lib/auth/locked-sections.ts for the authoritative check and the rationale.
const isLockedSection = createRouteMatcher(["/classes(.*)", "/live(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  if (isPublicRoute(req)) return;

  const { userId, sessionClaims } = await auth();

  if (!userId) {
    const signInUrl = new URL("/sign-in", req.url);
    signInUrl.searchParams.set("redirect_url", req.url);
    return NextResponse.redirect(signInUrl);
  }

  // Optimistic admin gate only. Real enforcement is server-side via requireAdmin()
  // in the /admin layout + every admin server action. This just stops non-admins
  // from loading the admin UI shell.
  const admin = sessionClaims?.metadata?.role === "admin";

  if (isAdminRoute(req) && !admin) {
    return NextResponse.redirect(new URL(MEMBER_HOME, req.url));
  }

  // Same optimistic-only deal: requireSectionUnlocked() in each locked page is
  // the real boundary. This just avoids rendering the shell for members.
  if (isLockedSection(req) && !admin) {
    return NextResponse.redirect(new URL(MEMBER_HOME, req.url));
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
