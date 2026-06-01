export default function Home() {
  return (
    <div className="flex flex-col flex-1 items-center justify-center font-sans">
      <main className="flex flex-col items-center gap-6 text-center px-8 py-32">
        <h1 className="text-5xl font-bold tracking-tight text-foreground sm:text-6xl">
          Move Mindful
        </h1>
        <p className="max-w-md text-lg leading-8 text-zinc-600 dark:text-zinc-400">
          A video fitness platform — on-demand classes, livestreaming, and
          community.
        </p>
      </main>
    </div>
  );
}
