import Link from "next/link";
import Image from "next/image";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export default async function Home() {
  const { userId } = await auth();
  if (userId) {
    redirect("/classes");
  }

  return (
    <div className="flex flex-col flex-1 items-center justify-center font-sans">
      <main className="flex flex-col items-center gap-8 text-center px-8 py-32">
        <Image
          src="/logo.png"
          alt="Move Mindful"
          width={120}
          height={120}
          priority
        />
        <h1 className="text-5xl font-bold tracking-tight text-foreground sm:text-6xl">
          Move Mindful
        </h1>
        <p className="max-w-md text-lg leading-8 text-zinc-600 text-zinc-400">
          A video fitness platform — on-demand classes, livestreaming, and
          community.
        </p>
        <div className="flex gap-4">
          <Link
            href="/sign-up"
            className="rounded-full bg-foreground px-6 py-3 text-sm font-medium text-background transition-colors hover:bg-zinc-700"
          >
            Get Started
          </Link>
          <Link
            href="/sign-in"
            className="rounded-full border border-zinc-300 px-6 py-3 text-sm font-medium transition-colors hover:bg-zinc-100"
          >
            Sign In
          </Link>
        </div>
        <Link
          href="/pricing"
          className="text-sm text-zinc-500 hover:text-foreground"
        >
          View Pricing
        </Link>
      </main>
    </div>
  );
}
