import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getProduct, getVideoPoster, PRODUCTS } from "@/lib/products";
import { getViewerAccess, viewerCanAccess } from "@/lib/auth/viewer";
import { ProductPurchase } from "@/components/product-purchase";
import { PostureLanding } from "@/components/products/posture-landing";
import { MuxPlayer } from "@/components/mux-player";
import { VideoTheaterStage } from "@/components/video-theater-stage";
import { auth } from "@clerk/nextjs/server";

/**
 * Products with a bespoke sales page, keyed by slug.
 *
 * Everything else falls through to the generic layout below, which is the right
 * home for a product that doesn't warrant its own page — a new one works with no
 * code changes, as products.ts promises. Only the *unowned* view is overridden:
 * once someone buys, every product shows the same video library.
 */
const CUSTOM_LANDINGS = { posture: PostureLanding } as const;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ product: string }>;
}): Promise<Metadata> {
  const product = getProduct((await params).product);
  if (!product) return {};
  return { title: `${product.title} — MoveMindful`, description: product.tagline };
}

/** Pre-render the known products; anything else 404s. */
export function generateStaticParams() {
  return PRODUCTS.map((p) => ({ product: p.slug }));
}

/**
 * A product's page. Public on purpose — this is the URL you advertise, so it has
 * to load for someone who has never signed in. It adapts to the viewer: buyers
 * get the videos, everyone else gets the pitch.
 *
 * The entitlement check runs here, server-side, so an unentitled visitor's
 * browser never receives the playback ids at all.
 */
export default async function ProductPage({
  params,
}: {
  params: Promise<{ product: string }>;
}) {
  const product = getProduct((await params).product);
  if (!product) notFound();

  const [viewer, { userId }] = await Promise.all([getViewerAccess(), auth()]);
  const owned = viewerCanAccess(viewer, product.entitlement);

  const CustomLanding =
    CUSTOM_LANDINGS[product.slug as keyof typeof CUSTOM_LANDINGS];
  if (!owned && CustomLanding) {
    return (
      <CustomLanding
        product={product}
        userId={userId}
        signedIn={viewer.signedIn}
      />
    );
  }

  // A single-video product someone already owns is just... the video. Give it
  // the same full-bleed theater layout as the player pages rather than a sales
  // header with a small embed underneath — there's nothing left to sell.
  if (owned && product.videos.length === 1) {
    const video = product.videos[0];
    return (
      <div>
        <VideoTheaterStage>
          <MuxPlayer
            playbackId={video.playbackId}
            title={video.title}
            poster={getVideoPoster(video)}
          />
        </VideoTheaterStage>

        <div className="mx-auto max-w-6xl px-6 sm:px-8 py-6">
          {video.durationMinutes && (
            <span className="text-sm text-zinc-400">
              {video.durationMinutes} min
            </span>
          )}
          <h1 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">
            {product.title}
          </h1>
          <p className="mt-3 max-w-2xl leading-relaxed text-zinc-600">
            {video.description ?? product.tagline}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-6 sm:px-8 py-12">
      <header className="max-w-2xl">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          {product.title}
        </h1>
        <p className="mt-3 text-lg text-zinc-500">{product.tagline}</p>
      </header>

      {owned ? (
        product.videos.length > 0 ? (
          <div className="mt-8 flex flex-wrap gap-4">
            {product.videos.map((video) => (
              <Link
                key={video.slug}
                href={`/${product.slug}/${video.slug}`}
                className="group w-64 shrink-0 overflow-hidden rounded-xl border border-zinc-200 bg-white transition hover:shadow-md"
              >
                <div className="relative aspect-video bg-zinc-100">
                  <Image
                    src={getVideoPoster(video)}
                    alt={video.title}
                    fill
                    unoptimized={getVideoPoster(video).startsWith("http")}
                    className="object-cover transition group-hover:scale-105"
                  />
                  {video.durationMinutes && (
                    <span className="absolute bottom-2 left-2 rounded bg-black/70 px-2 py-0.5 text-xs font-medium text-white">
                      {video.durationMinutes} min
                    </span>
                  )}
                </div>
                <div className="p-3">
                  <h2 className="font-semibold leading-snug group-hover:text-zinc-600">
                    {video.title}
                  </h2>
                  {video.description && (
                    <p className="mt-1.5 text-sm text-zinc-500">{video.description}</p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <p className="mt-10 text-zinc-500">
            Videos are on their way — check back shortly.
          </p>
        )
      ) : (
        <div className="mt-10 max-w-md rounded-xl border border-zinc-200 bg-white p-6">
          {product.entitlement === null ? (
            <>
              <h2 className="text-lg font-semibold">Watch it free</h2>
              {/* Straight about the account up front: promising a video and
                  then producing a form converts worse than saying so. */}
              <p className="mt-2 text-sm text-zinc-500">
                Free with a Move Mindful account. Create one and watch it now —
                no card, no subscription.
              </p>
              <Link
                href={`/sign-up?redirect_url=${encodeURIComponent(`/${product.slug}`)}`}
                className="mt-5 inline-flex rounded-full bg-foreground px-6 py-3 text-sm font-medium text-background transition-colors hover:bg-zinc-700"
              >
                Create free account
              </Link>
            </>
          ) : (
            <>
              <h2 className="text-lg font-semibold">Get access</h2>
              <p className="mt-2 text-sm text-zinc-500">
                A one-time purchase. Yours to keep, with no subscription.
              </p>
              <ProductPurchase
                userId={userId}
                productSlug={product.slug}
                revenueCatProductId={product.revenueCatProductId}
              />
            </>
          )}
          {!viewer.signedIn && (
            <p className="mt-4 text-sm text-zinc-500">
              Already bought it?{" "}
              <Link href="/sign-in" className="underline hover:text-zinc-800">
                Sign in
              </Link>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
