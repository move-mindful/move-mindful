import { createClient } from "@/lib/supabase/server";
import Image from "next/image";
import Link from "next/link";

const difficultyColor: Record<string, string> = {
  beginner: "bg-emerald-100 text-emerald-700",
  intermediate: "bg-amber-100 text-amber-700",
  advanced: "bg-red-100 text-red-700",
};

function formatCategory(category: string) {
  return category.charAt(0).toUpperCase() + category.slice(1);
}

export default async function ClassesPage() {
  const supabase = await createClient();
  const { data: classes } = await supabase
    .from("classes")
    .select("*")
    .not("published_at", "is", null)
    .order("published_at", { ascending: false });

  if (!classes || classes.length === 0) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-12">
        <h1 className="text-3xl font-bold tracking-tight">Classes</h1>
        <p className="mt-3 text-zinc-500">
          No classes available yet. Check back soon!
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <h1 className="text-3xl font-bold tracking-tight">Classes</h1>
      <p className="mt-2 text-zinc-500">
        {classes.length} class{classes.length !== 1 && "es"} available
      </p>

      <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {classes.map((c) => (
          <Link
            key={c.id}
            href={`/classes/${c.id}`}
            className="group overflow-hidden rounded-xl border border-zinc-200 bg-white transition hover:shadow-md"
          >
            <div className="relative aspect-video bg-zinc-100">
              {c.mux_playback_id ? (
                <Image
                  src={`https://image.mux.com/${c.mux_playback_id}/thumbnail.webp?width=640&height=360&fit_mode=smartcrop`}
                  alt={c.title}
                  fill
                  className="object-cover transition group-hover:scale-105"
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-zinc-400">
                  No preview
                </div>
              )}
              <span className="absolute bottom-2 left-2 rounded bg-black/70 px-2 py-0.5 text-xs font-medium text-white">
                {c.duration_minutes} min
              </span>
            </div>

            <div className="p-4">
              <div className="flex items-center gap-2 text-xs">
                <span className="font-medium text-zinc-500">
                  {formatCategory(c.category)}
                </span>
                <span className="text-zinc-300">&middot;</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${difficultyColor[c.difficulty] ?? "bg-zinc-100 text-zinc-600"}`}
                >
                  {c.difficulty.charAt(0).toUpperCase() +
                    c.difficulty.slice(1)}
                </span>
              </div>
              <h2 className="mt-2 font-semibold leading-snug group-hover:text-zinc-600">
                {c.title}
              </h2>
              <p className="mt-1 text-sm text-zinc-500">
                {c.instructor_name}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
