import Image from "next/image";
import Link from "next/link";
import { HeroMedia } from "@/components/products/hero-media";
import { Outfit } from "next/font/google";
import type { Product } from "@/lib/products";
import {
  PurchaseProvider,
  BuyButton,
  PurchasePrice,
  PurchaseError,
} from "@/components/product-purchase";

/**
 * The sales page for Posture & Mobility Reset.
 *
 * A bespoke page rather than the generic product layout, because this is the
 * URL the ads point at and it has to do the selling on its own. Everything
 * here came out of the design canvas; the copy is approved and should be
 * treated as content, not as something to improve in passing.
 *
 * Two rules it exists to keep:
 *
 *  - **The price is never written down.** It comes from RevenueCat, the same as
 *    everywhere else, so a price change in the dashboard can't leave stale
 *    numbers scattered up the page. Both calls to action start checkout
 *    directly; one <PurchaseProvider> wraps the page so they share a single
 *    offerings lookup rather than each making their own.
 *  - **The lineup is read from `products.ts`**, not duplicated here — so what a
 *    buyer is promised and what they get after paying cannot drift apart. Only
 *    the still image per day lives here, matched by position.
 *
 * The page assumes the viewer does *not* own the product: `[product]/page.tsx`
 * renders the video library instead once they do.
 */

// The design's typeface. Scoped to this page via the variable below rather than
// swapped in globally — the rest of the site is Geist.
const outfit = Outfit({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-outfit",
});

/** Stills for each day, in lineup order. */
const DAY_IMAGES = [
  {
    src: "/posture/day-1.jpg",
    alt: "Standing forward fold with hands at the wall",
  },
  {
    src: "/posture/day-2.jpg",
    alt: "Seated with a strap, opening through the chest",
  },
  { src: "/posture/day-3.jpg", alt: "Kneeling lunge with an overhead reach" },
  {
    src: "/posture/day-4.jpg",
    alt: "Kneeling tall on a bolster, spine upright",
  },
  {
    src: "/posture/day-5.jpg",
    alt: "Reclined with the legs lifted over a bolster",
  },
];

const WORK_ON = [
  {
    title: "Forward head posture and “tech neck”",
    body: "Mobilize the neck and upper back while strengthening the deep muscles that help support your head in better alignment.",
  },
  {
    title: "Rounded shoulders and a tight chest",
    body: "Open the chest and front of the shoulders while strengthening the muscles that support and stabilize your shoulder blades.",
  },
  {
    title: "A stiff or rounded upper back",
    body: "Restore movement through the thoracic spine so standing taller, reaching, and rotating feel easier.",
  },
  {
    title: "Limited shoulder and overhead mobility",
    body: "Improve shoulder and shoulder-blade mobility so reaching overhead feels smoother and less restricted.",
  },
  {
    title: "Weak postural and core muscles",
    body: "Build strength and control through the core, back, and stabilizing muscles that support better posture.",
  },
  {
    title: "Tight hips and lower-back stiffness",
    body: "Mobilize the hips and pelvis to help everyday movements like standing, walking, and bending feel less stiff.",
  },
];

const TESTIMONIALS = [
  {
    quote:
      "My flexibility has greatly improved, my aches and pains are gone, and my mobility has increased from these classes.",
    name: "Sherry Dunne",
    photo: "/posture/testimonial-sherry.jpg",
  },
  {
    quote:
      "My back no longer aches, the change in movement has been amazing. I look forward to going to class every day.",
    name: "Michelle Stoor",
    photo: "/posture/testimonial-michelle.jpg",
  },
  {
    quote:
      "This method is unlike any other yoga or movement. It’s what I’ve been looking for in a practice for a long time.",
    name: "Amy Eck-Henry",
    photo: "/posture/testimonial-amy.jpg",
  },
];

/**
 * PLACEHOLDER hero loop — 16 seconds cut from Day 5 (50–66s, the arm sweep) so
 * the treatment can be judged before the real thing is shot. It is its own Mux
 * asset, not the class: publishing a class's playback id would publish the
 * class. Replace this id when Ayla's purpose-shot clip is up, and delete the
 * placeholder asset. See scripts/make-clip.mjs.
 */
const HERO_LOOP_PLAYBACK_ID = "GoelX02f4fhezFpJ00hhUpQaLjo9TjYHI3m6QKK02znOlc";

const ctaCls =
  "inline-flex items-center justify-center rounded-full bg-linear-to-r from-[#7A5FEA] to-[#4CC7E0] px-10 py-4 text-lg font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60";

const h2Cls =
  "text-[2rem] font-semibold leading-[1.12] tracking-[-0.028em] text-[#14142B] text-pretty sm:text-[2.75rem]";

const cardCls = "rounded-[20px] border border-[#ECECF4] bg-[#FAFAFD]";

export function PostureLanding({
  product,
  userId,
  signedIn,
}: {
  product: Product;
  userId: string | null;
  signedIn: boolean;
}) {
  return (
    <PurchaseProvider
      userId={userId}
      productSlug={product.slug}
      revenueCatProductId={product.revenueCatProductId}
    >
      <div
        className={`${outfit.variable} w-full bg-white font-[family-name:var(--font-outfit)] text-[#14142B]`}
      >
        {/* ---------------- HERO ---------------- */}
        <section className="mx-auto flex max-w-[1140px] flex-col items-center gap-6 px-6 pt-14 text-center sm:px-11 sm:pt-[74px]">
          <span className="rounded-full bg-[#F2F0FE] px-4 py-1.5 text-[13px] font-semibold tracking-[0.04em] text-[#6D5FE8]">
            Posture &amp; Mobility Reset
          </span>
          <h1 className="max-w-[15em] text-[2.4rem] font-semibold leading-[1.06] tracking-[-0.034em] text-pretty sm:text-[3.875rem]">
            5-Day Posture and Mobility Reset
          </h1>
          <div className="flex max-w-[32em] flex-col gap-4 text-lg leading-relaxed text-[#5B5B72] text-pretty sm:text-[1.3125rem]">
            <p>
              Five follow-along 12-minute routines designed to help you feel
              less stiff, stand taller, and move with more freedom.
            </p>
            <p>
              Improve your mobility, build postural strength, and restore
              movement to the places that feel tight and restricted.
            </p>
          </div>
          <div className="mt-1.5 flex flex-col items-center gap-3.5">
            <BuyButton className={ctaCls} showPrice>
              Get the Reset
            </BuyButton>
            <p className="text-[15px] text-[#8A8AA0]">
              One-time payment · Yours to keep · Only 12 minutes a day
            </p>
            <PurchaseError className="text-[15px] text-red-600" />
          </div>
          <HeroMedia
            poster="/posture/hero-poster.jpg"
            alt="Standing tall on the mat, arms sweeping overhead"
            videoSrc={`https://stream.mux.com/${HERO_LOOP_PLAYBACK_ID}/720p.mp4`}
            imageSizes="(min-width: 1140px) 1052px, 100vw"
            className="mt-6 sm:mt-[30px]"
          />
        </section>

        {/* ---------------- TIME BAND ---------------- */}
        <section className="mx-auto grid max-w-[1140px] grid-cols-2 gap-3 px-6 pt-9 sm:gap-[18px] sm:px-11 sm:pt-14 lg:grid-cols-4">
          {[
            ["12 min", "Each routine takes 12 minutes, start to finish."],
            ["Press play", "Follow along. No equipment needed."],
            [
              "Start today",
              "Nothing to schedule. Start with the first one right away.",
            ],
            ["One time", "Full access. No subscription. Yours to keep."],
          ].map(([big, small]) => (
            <div
              key={big}
              className={`${cardCls} flex flex-col gap-1 p-4 sm:gap-1.5 sm:p-6`}
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

        {/* ---------------- RECOGNITION ---------------- */}
        <section className="mx-auto max-w-[1140px] px-6 py-12 sm:px-11 sm:py-[88px]">
          <div className="grid gap-8 lg:grid-cols-2 lg:items-center lg:gap-16">
            <h2 className={h2Cls}>
              <span className="block">Modern life makes your body stiff.</span>
              <span className="block">
                The right movement can help you feel like yourself again.
              </span>
            </h2>
            <div className="flex flex-col gap-5">
              <p className="text-[17px] leading-[1.68] text-[#5B5B72] sm:text-[19px]">
                Long periods of sitting and screen time can leave your body
                feeling stiff, achy, and restricted. This 5-Day Reset is
                designed to counteract common sedentary patterns and help your
                body move more freely. Each routine has a specific focus,
                progressing from targeted mobility and strength to coordinated
                full-body movement.
              </p>
              <p className="text-[17px] font-medium leading-[1.68] sm:text-[19px]">
                Each routine only takes 12 minutes.
              </p>
            </div>
          </div>
        </section>

        {/* ---------------- THE FIVE DAYS ---------------- */}
        <section className="w-full bg-[#F7F7FB]">
          <div className="mx-auto max-w-[1140px] px-6 py-12 sm:px-11 sm:py-[84px]">
            <div className="mb-9 flex flex-col gap-3.5 sm:mb-[46px] sm:items-center sm:text-center">
              <h2 className={h2Cls}>Your 5-Day Posture &amp; Mobility Reset</h2>
              <p className="max-w-[34em] text-[17px] leading-relaxed text-[#5B5B72] sm:text-[19px]">
                No equipment needed — just a folded blanket or towel.
              </p>
            </div>

            <div className="flex flex-col gap-3.5">
              {product.videos.map((video, i) => {
                const still = DAY_IMAGES[i];
                return (
                  <div
                    key={video.slug}
                    className="flex flex-col gap-3 rounded-[20px] border border-[#ECECF4] bg-white p-3 sm:grid sm:grid-cols-[220px_minmax(0,1fr)_110px] sm:items-center sm:gap-7 sm:p-[18px]"
                  >
                    {still && (
                      <Image
                        src={still.src}
                        alt={still.alt}
                        width={1600}
                        height={1067}
                        sizes="(min-width: 640px) 220px, 100vw"
                        className="h-[150px] w-full rounded-xl object-cover sm:h-[140px] sm:rounded-[14px]"
                      />
                    )}
                    <div className="flex flex-col gap-1.5 px-1.5 pb-1.5 sm:p-0">
                      <div className="flex items-baseline justify-between gap-2.5 sm:block">
                        <h3 className="text-lg font-semibold sm:text-[21px]">
                          {video.title}
                        </h3>
                        {video.durationMinutes && (
                          <span className="shrink-0 text-[13px] whitespace-nowrap text-[#8A8AA0] sm:hidden">
                            {video.durationMinutes} min
                          </span>
                        )}
                      </div>
                      {video.description && (
                        <p className="text-[15px] leading-[1.55] text-[#5B5B72] sm:text-base">
                          {video.description}
                        </p>
                      )}
                    </div>
                    {video.durationMinutes && (
                      <span className="hidden text-right text-[15px] font-medium text-[#8A8AA0] sm:block">
                        {video.durationMinutes} min
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ---------------- WHY IT STICKS ---------------- */}
        <section className="mx-auto max-w-[1140px] px-6 py-12 sm:px-11 sm:py-[88px]">
          <div className="grid gap-8 lg:grid-cols-2 lg:items-center lg:gap-16">
            <div className="flex flex-col gap-7">
              <h2 className={h2Cls}>A routine you’ll actually stick with.</h2>
              <div className="flex flex-col gap-6">
                <Benefit
                  title="Short enough to repeat"
                  body="Each routine takes just 12 minutes, making it easier to fit movement into your day and return to it regularly."
                  icon={
                    <>
                      <circle cx="12" cy="12" r="8.5" />
                      <path d="M12 7.5V12l3 2" />
                    </>
                  }
                />
                <Benefit
                  title="Just press play and follow along."
                  body="No complicated plans or wondering what to do next. Each routine guides you through every movement from beginning to end."
                  icon={
                    <>
                      <path d="M4 5.5h11v13H4z" />
                      <path d="M15 9.5l5-3v11l-5-3z" />
                    </>
                  }
                />
                <Benefit
                  title="Stretch, strengthen, and move better."
                  body="Build mobility, postural strength, and deepen your mind-body connection while working within a comfortable, pain-free range of motion."
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
                src="/posture/method.jpg"
                alt="Supported bridge with one leg extended"
                width={1600}
                height={1067}
                sizes="(min-width: 1024px) 526px, 100vw"
                className="h-[185px] w-full rounded-[20px] object-cover sm:h-[340px] sm:rounded-[24px]"
              />
              <div className={`${cardCls} p-6 sm:px-[30px] sm:py-7`}>
                <p className="text-[17px] leading-[1.55] text-pretty sm:text-[19px]">
                  Better posture isn’t something you force. It’s something you
                  build through mobility, strength, and awareness.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ---------------- AYLA ---------------- */}
        <section className="w-full bg-[#F7F7FB]">
          <div className="mx-auto grid max-w-[1140px] gap-8 px-6 py-11 sm:px-11 sm:py-20 lg:grid-cols-[380px_minmax(0,1fr)] lg:items-center lg:gap-[60px]">
            <Image
              src="/posture/ayla.jpg"
              alt="Ayla Sarnoff"
              width={1092}
              height={1365}
              sizes="(min-width: 1024px) 380px, 100vw"
              className="h-[280px] w-full rounded-[20px] object-cover sm:h-[440px] sm:rounded-[24px]"
            />
            <div className="flex flex-col gap-5">
              <span className="text-[13px] font-semibold tracking-[0.1em] uppercase text-[#6D5FE8]">
                Your teacher
              </span>
              <h2 className="text-[1.875rem] font-semibold leading-[1.14] tracking-[-0.028em] sm:text-[2.5rem]">
                Ayla Sarnoff
              </h2>
              <div className="flex flex-col gap-4 text-base leading-[1.68] text-[#5B5B72] sm:text-lg">
                <p>
                  For over a decade, Ayla has helped thousands of people improve
                  their posture, mobility, strength, and balance so they can
                  move through life with greater freedom and ease.
                </p>
                <p>
                  Ayla is the creator of the Therapeutic Yoga Method and founder
                  of Clarity of Heart Yoga Studio in Sedona, AZ. Her mission is
                  to help people transform their posture, strength, mobility and
                  balance. Her method makes it possible for people of all ages,
                  abilities, and levels of fitness to safely discover their
                  body’s full potential.
                </p>
                <p>
                  Ayla teaches adults ranging in age from 30 to 85 in her studio
                  every day, giving her firsthand experience adapting movement
                  for different bodies, abilities, and stages of life. She
                  created the Posture &amp; Mobility Reset by organizing the
                  most effective movements she teaches in the studio into five
                  simple, follow-along routines you can practice from the
                  comfort of your home.
                </p>
              </div>
              <div className="mt-2 grid gap-4 border-t border-[#E4E4EE] pt-6 sm:grid-cols-3 sm:gap-5">
                {[
                  ["Over a decade", "of teaching experience"],
                  ["Thousands", "of students taught"],
                  ["Ages 30–85", "in her studio"],
                ].map(([big, small]) => (
                  <div key={big} className="flex flex-col gap-0.5">
                    <span className="text-[21px] font-semibold tracking-[-0.02em] sm:text-[26px]">
                      {big}
                    </span>
                    <span className="text-[13px] text-[#8A8AA0] sm:text-sm">
                      {small}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ---------------- TESTIMONIALS ---------------- */}
        <section className="mx-auto max-w-[1140px] px-6 py-12 sm:px-11 sm:py-[84px]">
          <h2 className="mb-8 text-[1.875rem] font-semibold leading-[1.14] tracking-[-0.028em] sm:mb-10 sm:text-[2.5rem]">
            Here’s what Ayla’s students have to say:
          </h2>
          <div className="grid gap-4 sm:gap-[18px] lg:grid-cols-3">
            {TESTIMONIALS.map((t) => (
              <figure
                key={t.name}
                className={`${cardCls} flex flex-col gap-4 p-6 sm:p-7`}
              >
                <blockquote className="text-[17px] leading-[1.55] text-pretty sm:text-lg">
                  “{t.quote}”
                </blockquote>
                <figcaption className="mt-auto flex items-center gap-3">
                  <Image
                    src={t.photo}
                    alt={t.name}
                    width={400}
                    height={400}
                    sizes="46px"
                    className="size-11 shrink-0 rounded-full object-cover sm:size-[46px]"
                  />
                  <span className="text-[15px] font-semibold text-[#8A8AA0]">
                    {t.name}
                  </span>
                </figcaption>
              </figure>
            ))}
          </div>
        </section>

        {/* ---------------- WHAT WE’LL WORK ON ---------------- */}
        <section className="w-full bg-[#F7F7FB]">
          <div className="mx-auto max-w-[860px] px-6 py-12 sm:px-11 sm:py-[84px]">
            <h2 className="mb-8 text-[1.875rem] font-semibold leading-[1.14] tracking-[-0.028em] sm:mb-10 sm:text-[2.5rem]">
              What We’ll Work On Together:
            </h2>
            <div className="flex flex-col gap-[22px]">
              {WORK_ON.map((item, i) => (
                <div
                  key={item.title}
                  className={
                    i < WORK_ON.length - 1
                      ? "flex flex-col gap-[7px] border-b border-[#E4E4EE] pb-[22px]"
                      : "flex flex-col gap-[7px]"
                  }
                >
                  <h3 className="text-[17px] font-semibold sm:text-xl">
                    {item.title}
                  </h3>
                  <p className="text-[15px] leading-[1.65] text-[#5B5B72] sm:text-[17px]">
                    {item.body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ---------------- BUY ---------------- */}
        <section
          id="buy"
          className="mx-auto max-w-[1140px] px-6 py-11 sm:px-11"
        >
          <div className="flex flex-col items-center gap-4 rounded-[24px] bg-linear-[120deg,#F4F1FE_0%,#EAF8FC_100%] px-6 py-10 text-center sm:px-10 sm:py-14">
            <h2 className="max-w-[14em] text-[2.125rem] font-semibold leading-[1.08] tracking-[-0.032em] text-pretty sm:text-[3.125rem]">
              12 minutes is all it takes. Start today.
            </h2>
            <p className="max-w-[32em] text-base leading-relaxed text-[#5B5B72] text-pretty sm:text-[19px]">
              Five routines, yours to keep. Full access, no subscription.
              <br />
              Start today and feel the difference.
            </p>

            <PurchasePrice
              className="mt-2 text-[2rem] font-semibold tracking-[-0.02em]"
              skeletonClassName="mt-2 h-9 w-28 animate-pulse rounded bg-white/60"
            />
            <BuyButton className={ctaCls}>Get the Reset</BuyButton>
            <PurchaseError />

            {!signedIn && (
              <p className="text-[15px] text-[#8A8AA0]">
                Already bought it?{" "}
                <Link
                  href="/sign-in"
                  className="underline hover:text-[#5B5B72]"
                >
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
              This program offers general movement instruction and is not
              medical advice, diagnosis, or treatment. Consult a qualified
              professional before beginning, particularly if you are pregnant,
              injured, or managing a medical condition. Stop any movement that
              causes pain.
            </p>
          </div>
        </div>
      </div>
    </PurchaseProvider>
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
