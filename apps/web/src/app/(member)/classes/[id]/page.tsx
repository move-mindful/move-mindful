import { createClient } from "@/lib/supabase/server";
import { MuxPlayer } from "@/components/mux-player";
import { VideoTheaterStage } from "@/components/video-theater-stage";
import { InstructorAvatar } from "@/components/instructor-avatar";
import { formatClassDate } from "@/lib/format-date";
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

  let instructorName: string = videoClass.instructor_name ?? "";
  let instructorAvatarUrl: string | null = null;
  if (videoClass.instructor_id) {
    const { data: inst } = await supabase
      .from("instructors")
      .select("name,avatar_url")
      .eq("id", videoClass.instructor_id)
      .single();
    if (inst) {
      instructorName = inst.name ?? instructorName;
      instructorAvatarUrl = inst.avatar_url ?? null;
    }
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
    <div>
      <VideoTheaterStage>
        {videoClass.mux_playback_id ? (
          <MuxPlayer
            playbackId={videoClass.mux_playback_id}
            title={videoClass.title}
            fillVideo
          />
        ) : (
          <div className="flex aspect-video items-center justify-center bg-zinc-900 text-zinc-400">
            Video not yet available
          </div>
        )}
      </VideoTheaterStage>

      <div className="mx-auto max-w-6xl px-6 sm:px-8 py-6">
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
          {videoClass.class_date && (
            <>
              <span className="text-zinc-300">&middot;</span>
              <span className="text-sm text-zinc-400">
                {formatClassDate(videoClass.class_date)}
              </span>
            </>
          )}
        </div>

        <h1 className="mt-3 text-2xl font-bold tracking-tight">{videoClass.title}</h1>
        {instructorName && (
          <div className="mt-2 flex items-center gap-2">
            <InstructorAvatar name={instructorName} src={instructorAvatarUrl} size={32} />
            <p className="text-zinc-500">with {instructorName}</p>
          </div>
        )}

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
