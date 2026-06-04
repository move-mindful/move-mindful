import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { grantLifetimeMembership } from "@/lib/revenuecat-admin";

/**
 * Grants the lifetime entitlement to the signed-in user, then sends them into
 * the member area. Reached automatically after signing up on /join/<slug>.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;

  const secret = process.env.JOIN_SECRET_SLUG;
  if (!secret || code !== secret) {
    return new Response("Not found", { status: 404 });
  }

  const { userId } = await auth();
  if (!userId) {
    // Not signed in yet — back to the signup form for this slug.
    redirect(`/join/${code}`);
  }

  let granted = false;
  try {
    await grantLifetimeMembership(userId);
    granted = true;
  } catch (error) {
    // Log for diagnosis (Vercel logs). Fall back to /pricing so a signed-in user
    // still has a path forward instead of bouncing on the entitlement gate.
    console.error("[join/activate] failed to grant lifetime membership", error);
  }

  // redirect() throws, so it must live outside the try/catch above.
  redirect(granted ? "/classes" : "/pricing");
}
