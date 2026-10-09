export default function HelpPage() {
  return (
    <div className="mx-auto max-w-2xl px-6 pt-6 pb-12 md:pt-12">
      <h1 className="text-3xl font-bold tracking-tight">Help</h1>

      <div className="mt-8 rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-white/[0.03] p-6">
        <h2 className="text-lg font-semibold">Contact Us</h2>
        <p className="mt-3 text-zinc-600 dark:text-zinc-300">
          Have a question or need help? Reach out and we&apos;ll get back to you
          as soon as possible.
        </p>
        <a
          href="mailto:contact@movemindful.com"
          className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white"
        >
          contact@movemindful.com &rarr;
        </a>
      </div>
    </div>
  );
}
