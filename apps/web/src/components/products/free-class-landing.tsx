import Image from "next/image";
import Link from "next/link";
import { Outfit } from "next/font/google";
import { HeroMedia } from "@/components/products/hero-media";
import type { Product } from "@/lib/products";

/**
 * The sales page for the free 12-minute routine.
 *
 * Reached at /class1 — a marketing URL, deliberately separate from the product
 * itself, which stays at /<slug>. The URL you advertise and the slug the code
 * keys off change for different reasons and shouldn't be the same string.
 *
 * There is nothing to buy here, so unlike the Posture Reset page it has no
 * RevenueCat involvement at all: the product's `entitlement` is null, meaning a
 * Clerk account is the entire gate. Every call to action therefore goes to
 * sign-up, and the class is waiting the moment they land.
 *
 * Copy is approved and came out of the design canvas — treat it as content, not
 * as something to improve in passing.
 */

// The design's typeface, scoped to this page rather than swapped in globally —
// the rest of the site is Geist. Same arrangement as the Posture Reset page.
const outfit = Outfit({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-outfit",
});

/**
 * The hero loop — 41 seconds, purpose-shot, silent by design (the audio track
 * is stripped before upload, so a browser that ignores `muted` has nothing to
 * play).
 *
 * Its own Mux asset, never a class's playback id: these assets are
 * public-policy, so publishing a class's id would publish the class.
 *
 * Uploaded with a **720p static rendition** — HeroMedia points a plain <video>
 * at the MP4 directly, and that URL only exists because the asset was created
 * with `static_renditions`. Re-upload with `scripts/upload-video.mjs --mp4` if
 * this is ever replaced; without it the URL 404s and the still silently stays.
 */
const HERO_LOOP_PLAYBACK_ID = "9Gwg00pcTnhSGYBUNM7hxik01401YirVq6WybsZqCRIzRY";

const ctaCls =
  "inline-flex items-center justify-center rounded-full bg-linear-to-r from-[#7A5FEA] to-[#4CC7E0] px-10 py-4 text-lg font-semibold text-white transition hover:opacity-90";

const cardCls = "rounded-[18px] border border-[#ECECF4] bg-[#FAFAFD]";

const BAND = [
  ["12 min", "One routine, start to finish. Short enough to do today."],
  ["Press play", "Follow along using simple household items as props."],
  ["Free", "No card, no subscription. Yours to come back to anytime."],
];

export function FreeClassLanding({
  product,
  signedIn,
}: {
  product: Product;
  /** Where a call to action sends someone. Signed-in visitors never see this
      page — the route redirects them to the class — but the prop keeps the
      component honest if that ever changes. */
  signedIn: boolean;
}) {
  // Straight to sign-up, carrying the product's own path back. That return path
  // is also what earns the Mailchimp `source:<slug>` tag, so it must be the
  // product slug and not this page's marketing URL.
  const cta = signedIn ? `/${product.slug}` : `/sign-up?redirect_url=/${product.slug}`;
  const ctaLabel = signedIn ? "Watch the class" : "Get your free class";

  return (
    <div
      className={`${outfit.variable} w-full bg-white font-[family-name:var(--font-outfit)] text-[#14142B]`}
    >
      {/* ---------------- HERO ---------------- */}
      <section className="mx-auto flex max-w-[1140px] flex-col items-center gap-6 px-6 pt-14 text-center sm:px-11 sm:pt-[74px]">
        <span className="rounded-full bg-emerald-100 px-4 py-1.5 text-[13px] font-semibold tracking-[0.04em] text-emerald-700">
          Free class
        </span>
        <h1 className="max-w-[14em] text-[2.4rem] font-semibold leading-[1.06] tracking-[-0.034em] text-pretty sm:text-[3.75rem]">
          A 12-minute posture and mobility routine, free!
        </h1>
        <p className="max-w-[31em] text-lg leading-relaxed text-[#5B5B72] text-pretty sm:text-[1.3125rem]">
          A daily routine designed to help you feel less stiff and more open
          throughout your entire body.
        </p>
        <Link href={cta} className={`${ctaCls} mt-1.5`}>
          {ctaLabel}
        </Link>
        <HeroMedia
          poster="/posture-routine/hero-poster.jpg"
          alt="Seated cross-legged on a mat, bending to the side with a dowel held overhead"
          videoSrc={`https://stream.mux.com/${HERO_LOOP_PLAYBACK_ID}/720p.mp4`}
          imageSizes="(min-width: 1140px) 1052px, 100vw"
          className="mt-6 sm:mt-[30px]"
        />
      </section>

      {/* ---------------- BAND ---------------- */}
      <section className="mx-auto grid max-w-[1140px] gap-3 px-6 pt-9 sm:gap-[18px] sm:px-11 sm:pt-14 lg:grid-cols-3">
        {BAND.map(([big, small]) => (
          <div
            key={big}
            className={`${cardCls} flex flex-col gap-1 p-5 sm:gap-1.5 sm:p-6`}
          >
            <span className="text-[22px] font-semibold tracking-[-0.02em] sm:text-[30px]">
              {big}
            </span>
            <span className="text-[13px] leading-snug text-[#5B5B72] sm:text-[15px]">
              {small}
            </span>
          </div>
        ))}
      </section>

      {/* ---------------- WHAT YOU'LL DO ---------------- */}
      <section className="mx-auto max-w-[1140px] px-6 py-12 sm:px-11 sm:py-[84px]">
        <div className="grid gap-8 lg:grid-cols-2 lg:items-center lg:gap-16">
          <div className="flex flex-col gap-7">
            <h2 className="text-[2rem] font-semibold leading-[1.12] tracking-[-0.028em] text-pretty sm:text-[2.625rem]">
              Twelve minutes, and your body will thank you.
            </h2>
            <div className="flex flex-col gap-6">
              <Benefit
                title="Loosen what feels stiff"
                body="Gentle movement through the neck, shoulders and spine — the places that stiffen first when you spend the day sitting in a chair."
                icon={
                  <>
                    <circle cx="12" cy="12" r="8.5" />
                    <path d="M12 7.5V12l3 2" />
                  </>
                }
              />
              <Benefit
                title="Just press play and follow along"
                body="No plan to follow, no sequence to remember. You'll be guided through every movement from beginning to end."
                icon={
                  <>
                    <path d="M4 5.5h11v13H4z" />
                    <path d="M15 9.5l5-3v11l-5-3z" />
                  </>
                }
              />
              <Benefit
                title="Work at your own range"
                body="Move within a comfortable, pain-free range of motion. Go as far as your body wants to go today, and no further."
                stroke="#4CC7E0"
                icon={
                  <>
                    <path d="M12 20.5s-7-4.2-7-9.4V6.4l7-2.9 7 2.9v4.7c0 5.2-7 9.4-7 9.4z" />
                    <path d="M9.5 11.8l1.8 1.8 3.4-3.8" />
                  </>
                }
              />
            </div>
          </div>

          <div className="flex flex-col gap-5">
            <Image
              src="/posture-routine/practice.jpg"
              alt="Lying back over a foam roller, reaching a dowel overhead to open the chest"
              width={1600}
              height={900}
              sizes="(min-width: 1024px) 526px, 100vw"
              className="h-[200px] w-full rounded-[20px] object-cover sm:h-[340px] sm:rounded-[24px]"
            />
            <div className={`${cardCls} flex flex-col gap-2 p-6 sm:px-[30px] sm:py-7`}>
              <span className="text-[13px] font-semibold tracking-[0.1em] uppercase text-[#6D5FE8]">
                What you&apos;ll need
              </span>
              <p className="text-[17px] leading-[1.55] text-pretty">
                A mat, a dowel or broomstick, and either a foam roller or a
                folded blanket or towel.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------- AYLA ---------------- */}
      <section className="w-full bg-[#F7F7FB]">
        <div className="mx-auto grid max-w-[1140px] gap-8 px-6 py-12 sm:px-11 sm:py-[72px] lg:grid-cols-[320px_minmax(0,1fr)] lg:items-center lg:gap-14">
          <Image
            src="/posture/ayla.jpg"
            alt="Ayla Sarnoff"
            width={1092}
            height={1365}
            sizes="(min-width: 1024px) 320px, 100vw"
            className="h-[280px] w-full rounded-[20px] object-cover sm:h-[420px] sm:rounded-[24px]"
          />
          <div className="flex flex-col gap-4">
            <span className="text-[13px] font-semibold tracking-[0.1em] uppercase text-[#6D5FE8]">
              Your instructor
            </span>
            <h2 className="text-[1.75rem] font-semibold leading-[1.14] tracking-[-0.028em] sm:text-[2.375rem]">
              Ayla Sarnoff
            </h2>
            <div className="flex flex-col gap-4 text-base leading-[1.68] text-[#5B5B72] sm:text-lg">
              <p>
                For over a decade, Ayla has helped thousands of people improve
                their posture, mobility, strength, and balance so they can move
                through life with greater freedom and ease.
              </p>
              <p>
                Ayla is the creator of the Therapeutic Yoga Method and founder
                of Clarity of Heart Yoga Studio in Sedona, AZ. Her mission is to
                help people transform their posture, strength, mobility and
                balance. Her method makes it possible for people of all ages,
                abilities, and levels of fitness to safely discover their
                body&rsquo;s full potential.
              </p>
              <p>
                Ayla teaches adults ranging in age from 30 to 85 in her studio
                every day, giving her firsthand experience adapting movement for
                different bodies, abilities, and stages of life. She created
                this short routine with some of the most effective movements she
                teaches in the studio so you can practice from the comfort of
                your home and experience the benefits firsthand.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------- CLOSING CTA ---------------- */}
      <section className="mx-auto max-w-[1140px] px-6 py-12 sm:px-11 sm:py-[72px]">
        <div className="flex flex-col items-center gap-4 rounded-[24px] bg-linear-[120deg,#F4F1FE_0%,#EAF8FC_100%] px-6 py-12 text-center sm:px-10 sm:py-16">
          <h2 className="max-w-[14em] text-[2rem] font-semibold leading-[1.08] tracking-[-0.032em] text-pretty sm:text-[3rem]">
            Twelve minutes is all it takes.
          </h2>
          <p className="max-w-[30em] text-base leading-relaxed text-[#5B5B72] text-pretty sm:text-[19px]">
            Create a free account and start right away — come back as often as
            you like.
          </p>
          <Link href={cta} className={`${ctaCls} mt-2`}>
            {ctaLabel}
          </Link>
          {!signedIn && (
            <p className="text-[15px] text-[#8A8AA0]">
              Already have an account?{" "}
              <Link href="/sign-in" className="underline hover:text-[#5B5B72]">
                Sign in
              </Link>
            </p>
          )}
        </div>
      </section>

      {/* ---------------- DISCLAIMER ---------------- */}
      <div className="w-full border-t border-[#EFEFF5]">
        <div className="mx-auto max-w-[1140px] px-6 py-8 sm:px-11">
          <p className="text-[13px] leading-relaxed text-[#8A8AA0] sm:text-sm">
            This class offers general movement instruction and is not medical
            advice, diagnosis, or treatment. Consult a qualified professional
            before beginning, particularly if you are pregnant, injured, or
            managing a medical condition. Stop any movement that causes pain.
          </p>
        </div>
      </div>
    </div>
  );
}

function Benefit({
  title,
  body,
  icon,
  stroke = "#6D5FE8",
}: {
  title: string;
  body: string;
  icon: React.ReactNode;
  stroke?: string;
}) {
  return (
    <div className="flex items-start gap-4">
      <svg
        width="26"
        height="26"
        viewBox="0 0 24 24"
        fill="none"
        stroke={stroke}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
        className="mt-1 shrink-0"
      >
        {icon}
      </svg>
      <div className="flex flex-col gap-1">
        <h3 className="text-[17px] font-semibold sm:text-xl">{title}</h3>
        <p className="text-[15px] leading-[1.62] text-[#5B5B72] sm:text-[17px]">
          {body}
        </p>
      </div>
    </div>
  );
}
