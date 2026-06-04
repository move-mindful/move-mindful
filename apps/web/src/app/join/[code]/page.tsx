import { SignUp } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";

/**
 * Hidden free-membership signup page.
 *
 * Reachable only at /join/<JOIN_SECRET_SLUG>; any other slug 404s. New members
 * sign up here and are forwarded to the activate route, which grants them a
 * lifetime entitlement. Protection is by obscurity only — anyone with the link
 * can sign themselves up for free access.
 */
export default async function JoinPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;

  const secret = process.env.JOIN_SECRET_SLUG;
  // 404 unless the slug matches exactly. If the env var is unset the page is
  // disabled entirely, so a misconfigured deploy can't hand out free access.
  if (!secret || code !== secret) {
    notFound();
  }

  // Already signed in? Skip the form and go straight to the grant step.
  const { userId } = await auth();
  if (userId) {
    redirect(`/join/${code}/activate`);
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8 py-16">
      <div className="max-w-md text-center">
        <h1 className="text-3xl font-bold tracking-tight">Join Move Mindful</h1>
        <p className="mt-3 text-zinc-500">
          Create your account to unlock free lifetime access to every class.
        </p>
      </div>
      <SignUp forceRedirectUrl={`/join/${code}/activate`} signInUrl="/sign-in" />
    </div>
  );
}
