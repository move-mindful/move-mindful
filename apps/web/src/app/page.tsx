import Link from "next/link";
import { Show } from "@clerk/nextjs";

export default function Home() {
  return (
    <div className="flex flex-col flex-1 items-center justify-center font-sans">
      <main className="flex flex-col items-center gap-8 text-center px-8 py-32">
        <h1 className="text-5xl font-bold tracking-tight text-foreground sm:text-6xl">
          Move Mindful
        </h1>
        <p className="max-w-md text-lg leading-8 text-zinc-600 text-zinc-400">
          A video fitness platform — on-demand classes, livestreaming, and
          community.
        </p>
        <div className="flex gap-4">
          <Show when="signed-in">
            <Link
              href="/classes"
              className="rounded-full bg-foreground px-6 py-3 text-sm font-medium text-background transition-colors hover:bg-zinc-700"
            >
              Go to Classes
            </Link>
          </Show>
          <Show when="signed-out">
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
          </Show>
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
