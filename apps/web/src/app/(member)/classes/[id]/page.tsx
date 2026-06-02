import { createClient } from "@/lib/supabase/server";
import { MuxPlayer } from "@/components/mux-player";
import Link from "next/link";
import { notFound } from "next/navigation";

const intensityBadge: Record<string, string> = {
  beginner: "bg-emerald-100 text-emerald-700",
  intermediate: "bg-amber-100 text-amber-700",
  advanced: "bg-red-100 text-red-700",
};

interface TagRow {
  id: string;
  name: string;
  slug: string;
  group_id: string | null;
}

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

  // Tags (RLS allows class_tags for published classes; tags/groups are public).
  const { data: ct } = await supabase
    .from("class_tags")
    .select("tag_id")
    .eq("class_id", id);
  const tagIds = (ct ?? []).map((r) => r.tag_id);

  let tags: TagRow[] = [];
  if (tagIds.length > 0) {
    const { data } = await supabase
      .from("tags")
      .select("id,name,slug,group_id")
      .in("id", tagIds);
    tags = data ?? [];
  }
  const { data: groups } = await supabase.from("tag_groups").select("id,slug");

  const disciplineGroupId = (groups ?? []).find((g) => g.slug === "discipline")?.id ?? null;
  const intensityGroupId = (groups ?? []).find((g) => g.slug === "intensity")?.id ?? null;
  const disciplineLabel = tags.find((t) => t.group_id === disciplineGroupId)?.name ?? null;
  const intensity = tags.find((t) => t.group_id === intensityGroupId) ?? null;
  const otherTags = tags.filter(
    (t) => t.group_id !== disciplineGroupId && t.group_id !== intensityGroupId,
  );

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
          <MuxPlayer playbackId={videoClass.mux_playback_id} title={videoClass.title} />
        ) : (
          <div className="flex aspect-video items-center justify-center rounded-xl bg-zinc-100 text-zinc-400">
            Video not yet available
          </div>
        )}
      </div>

      <div className="mt-6">
        <div className="flex flex-wrap items-center gap-3">
          {disciplineLabel && (
            <span className="text-sm font-medium text-zinc-500">{disciplineLabel}</span>
          )}
          {intensity && (
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                intensityBadge[intensity.slug] ?? "bg-zinc-100 text-zinc-600"
              }`}
            >
              {intensity.name}
            </span>
          )}
          <span className="text-sm text-zinc-400">{videoClass.duration_minutes} min</span>
        </div>

        <h1 className="mt-3 text-2xl font-bold tracking-tight">{videoClass.title}</h1>
        <p className="mt-1 text-zinc-500">with {videoClass.instructor_name}</p>

        {videoClass.description && (
          <p className="mt-4 leading-relaxed text-zinc-600">{videoClass.description}</p>
        )}

        {otherTags.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {otherTags.map((t) => (
              <span
                key={t.id}
                className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-600"
              >
                {t.name}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
