import { redirect } from "next/navigation";
import { getViewerAccess, viewerCanAccess } from "@/lib/auth/viewer";
import { MEMBERSHIP_ENTITLEMENT } from "@/lib/entitlements";

/**
 * Membership-gated routes — the on-demand class library and the live stream.
 *
 * Nested inside the signed-in shell in (app)/layout.tsx, so it inherits the
 * header rather than duplicating it and only adds the entitlement check. These
 * are the routes that will stay behind the recurring membership when the
 * one-time-purchase product ships alongside them.
 *
 * Checked on the server as the page renders (the same RevenueCat lookup the
 * home page uses, shared within the request), so there's no second wait and
 * spinner in the browser once the page arrives. Admins pass, to preview.
 *
 * Note both sections are *additionally* locked to admins right now — see
 * requireSectionUnlocked() in each page.
 */
export default async function MemberLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const viewer = await getViewerAccess();
  if (!viewerCanAccess(viewer, MEMBERSHIP_ENTITLEMENT)) redirect("/pricing");
  return children;
}
