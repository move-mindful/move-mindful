import { EntitlementGate } from "@/components/entitlement-gate";

/**
 * Membership-gated routes — the on-demand class library and the live stream.
 *
 * Nested inside the signed-in shell in (app)/layout.tsx, so it inherits the
 * header rather than duplicating it and only adds the entitlement check. These
 * are the routes that will stay behind the recurring membership when the
 * one-time-purchase product ships alongside them.
 *
 * Note both sections are *additionally* locked to admins right now — see
 * requireSectionUnlocked() in each page.
 */
export default function MemberLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <EntitlementGate>{children}</EntitlementGate>;
}
