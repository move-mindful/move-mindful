import { createClient } from "@/lib/supabase/server";
import { MuxPlayer } from "@/components/mux-player";
import Link from "next/link";
import { notFound } from "next/navigation";

const difficultyColor: Record<string, string> = {
  beginner: "bg-emerald-100 text-emerald-700",
  intermediate: "bg-amber-100 text-amber-700",
  advanced: "bg-red-100 text-red-700",
};

export default async function ClassDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: videoClass } = await supabase
    .from("classes")
    .select("*")
    .eq("id", id)
    .single();

  if (!videoClass) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <Link
        href="/classes"
        className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-800"
      >
        &larr; Back to classes
      </Link>

      <div className="mt-6">
        {videoClass.mux_playback_id ? (
          <MuxPlayer
            playbackId={videoClass.mux_playback_id}
            title={videoClass.title}
          />
        ) : (
          <div className="flex aspect-video items-center justify-center rounded-xl bg-zinc-100 text-zinc-400">
            Video not yet available
          </div>
        )}
      </div>

      <div className="mt-6">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-medium text-zinc-500">
            {videoClass.category.charAt(0).toUpperCase() +
              videoClass.category.slice(1)}
          </span>
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${difficultyColor[videoClass.difficulty] ?? "bg-zinc-100 text-zinc-600"}`}
          >
            {videoClass.difficulty.charAt(0).toUpperCase() +
              videoClass.difficulty.slice(1)}
          </span>
          <span className="text-sm text-zinc-400">
            {videoClass.duration_minutes} min
          </span>
        </div>

        <h1 className="mt-3 text-2xl font-bold tracking-tight">
          {videoClass.title}
        </h1>
        <p className="mt-1 text-zinc-500">
          with {videoClass.instructor_name}
        </p>

        {videoClass.description && (
          <p className="mt-4 leading-relaxed text-zinc-600">
            {videoClass.description}
          </p>
        )}
      </div>
    </div>
  );
}
