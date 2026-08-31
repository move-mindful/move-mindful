import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getProduct, getProductVideo, getVideoPoster } from "@/lib/products";
import { getViewerAccess, viewerCanAccess } from "@/lib/auth/viewer";
import { MuxPlayer } from "@/components/mux-player";
import { VideoTheaterStage } from "@/components/video-theater-stage";

/**
 * Plays one video from a product.
 *
 * The entitlement check is the first thing that happens, and it redirects
 * rather than rendering a locked state — so the playback id is never sent to a
 * browser that isn't entitled to it. (The videos themselves use Mux's public
 * playback policy, so anyone holding an id can stream it; keeping ids off the
 * wire is what makes this a gate rather than a suggestion.)
 */
export default async function ProductVideoPage({
  params,
}: {
  params: Promise<{ product: string; video: string }>;
}) {
  const { product: productSlug, video: videoSlug } = await params;

  const product = getProduct(productSlug);
  if (!product) notFound();

  const video = getProductVideo(product, videoSlug);
  if (!video) notFound();

  const viewer = await getViewerAccess();
  if (!viewerCanAccess(viewer, product.entitlement)) {
    redirect(`/${product.slug}`);
  }

  return (
    <div>
      <VideoTheaterStage>
        <MuxPlayer
          playbackId={video.playbackId}
          title={video.title}
          poster={getVideoPoster(video)}
        />
      </VideoTheaterStage>

      <div className="mx-auto max-w-6xl px-6 sm:px-8 py-8">
        <Link
          href={`/${product.slug}`}
          className="text-sm text-zinc-500 transition hover:text-zinc-800"
        >
          &larr; {product.title}
        </Link>
        <h1 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">
          {video.title}
        </h1>
        {video.description && (
          <p className="mt-3 max-w-2xl text-zinc-600">{video.description}</p>
        )}
      </div>
    </div>
  );
}
