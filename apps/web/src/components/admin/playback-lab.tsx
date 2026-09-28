"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

/**
 * Playback lab — a throwaway test bench for the exercise-workout player
 * (plan.md, Phase 4.5 step 1). It answers four questions before any exercise
 * clip is uploaded for real, because the answers decide the Mux settings every
 * clip is created with:
 *
 *   1. Loop seam   — does a short clip loop without a visible hitch?
 *   2. Handoff     — with the next clips preloaded, how fast does "next" show a frame?
 *   3. Sound       — can a clip play with sound after an automatic advance
 *                    (no tap), which is what "play once" tutorials need on iOS?
 *   4. Full screen — what the viewport and Fullscreen API look like on this device.
 *
 * Each is measured for both an MP4 static rendition (a plain <video> file) and
 * Mux's HLS stream, so the two can be compared on the same phone.
 */

type Source = "mp4" | "hls";

interface Clip {
  playbackId: string;
  label: string;
}

interface Stats {
  seams: number[];
  handoffs: number[];
  stalls: number;
  frameMs: number | null;
}

// The two hero loops from the sales pages (posture-landing.tsx and
// free-class-landing.tsx). Already public and already created with a 720p MP4
// static rendition, so the lab works before any test footage exists. They're
// horizontal; the stage crops them to 9:16 like the real player will.
const DEFAULT_CLIPS: Clip[] = [
  { playbackId: "eVD8zDG9qUBljEoxL37tVz1U4A6padQ2JkvziLXlP3A", label: "Posture hero loop" },
  { playbackId: "9Gwg00pcTnhSGYBUNM7hxik01401YirVq6WybsZqCRIzRY", label: "Free class hero loop" },
];

// Keep the current clip, one behind and two ahead loaded — the same window the
// real player would preload. Everything else has no src, so it holds no buffer.
const KEEP_BEHIND = 1;
const KEEP_AHEAD = 2;

const emptyStats = (): Stats => ({ seams: [], handoffs: [], stalls: 0, frameMs: null });

function clipUrl(playbackId: string, source: Source): string {
  return source === "mp4"
    ? `https://stream.mux.com/${playbackId}/720p.mp4`
    : `https://stream.mux.com/${playbackId}.m3u8`;
}

function parseClips(text: string): Clip[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [playbackId, ...rest] = line.split(/\s+/);
      return { playbackId, label: rest.join(" ") || playbackId.slice(0, 8) };
    });
}

function clipsToText(clips: Clip[]): string {
  return clips.map((c) => `${c.playbackId} ${c.label}`).join("\n");
}

function isLoaded(i: number, cur: number, n: number): boolean {
  for (let d = -KEEP_BEHIND; d <= KEEP_AHEAD; d++) {
    if ((((cur + d) % n) + n) % n === i) return true;
  }
  return false;
}

function summarize(values: number[]): string {
  if (values.length === 0) return "—";
  const last = values[values.length - 1];
  const worst = Math.max(...values);
  return `last ${Math.round(last)} ms · worst ${Math.round(worst)} ms (${values.length})`;
}

/** One pooled <video>. Attaches hls.js when the browser can't play HLS natively. */
function LabVideo({
  index,
  url,
  hls,
  load,
  visible,
  register,
}: {
  index: number;
  url: string;
  hls: boolean;
  load: boolean;
  visible: boolean;
  register: (index: number, el: HTMLVideoElement | null) => void;
}) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    register(index, ref.current);
    return () => register(index, null);
  }, [index, register]);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    if (!load) {
      video.removeAttribute("src");
      video.load();
      return;
    }
    if (hls && !video.canPlayType("application/vnd.apple.mpegurl")) {
      // hls.js ships with Mux Player; Safari (the device that matters most here)
      // plays HLS natively and never reaches this branch.
      let cancelled = false;
      let instance: { destroy(): void } | null = null;
      import("hls.js").then(({ default: Hls }) => {
        if (cancelled || !Hls.isSupported()) return;
        const h = new Hls({ maxBufferLength: 12 });
        h.loadSource(url);
        h.attachMedia(video);
        instance = h;
      });
      return () => {
        cancelled = true;
        instance?.destroy();
      };
    }
    video.src = url;
  }, [url, hls, load]);

  return (
    <video
      ref={ref}
      muted
      loop
      playsInline
      preload="auto"
      aria-hidden={!visible}
      className={`absolute inset-0 h-full w-full object-cover ${visible ? "opacity-100" : "opacity-0"}`}
    />
  );
}

// How long "Auto-advance" waits. Browsers treat anything within a few seconds of
// a tap as still caused by that tap (Chrome: 5 s), which would make the no-tap
// sound test pass when it shouldn't. A real timed set ends far later than this.
const AUTO_ADVANCE_SECONDS = 8;

/**
 * `initialText` is the clip list from the page URL (`?clips=`), so a list set up
 * on a computer opens as-is on a phone.
 */
export function PlaybackLab({ initialText }: { initialText?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const fromUrl = initialText ? parseClips(initialText) : [];
  const [clips, setClips] = useState<Clip[]>(fromUrl.length ? fromUrl : DEFAULT_CLIPS);
  const [draft, setDraft] = useState(fromUrl.length ? initialText! : clipsToText(DEFAULT_CLIPS));
  const [open, setOpen] = useState(false);
  const [started, setStarted] = useState(false);
  const [source, setSource] = useState<Source>("mp4");
  const [sound, setSound] = useState(false);
  const [unlockOnStart, setUnlockOnStart] = useState(true);
  const [cur, setCur] = useState(0);
  const [showStats, setShowStats] = useState(true);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [audioResult, setAudioResult] = useState("not tried");
  const [stats, setStats] = useState<Record<Source, Stats>>({ mp4: emptyStats(), hls: emptyStats() });
  const [buffers, setBuffers] = useState<string[]>([]);
  const [screen, setScreen] = useState("");
  const [copied, setCopied] = useState(false);

  const videos = useRef<(HTMLVideoElement | null)[]>([]);
  const stageRef = useRef<HTMLDivElement>(null);
  const countdownTimer = useRef<number | null>(null);

  const register = useCallback((index: number, el: HTMLVideoElement | null) => {
    videos.current[index] = el;
  }, []);

  const record = useCallback((key: "seams" | "handoffs" | "stalls" | "frameMs", value: number) => {
    setStats((prev) => {
      const s = prev[source];
      const next: Stats =
        key === "stalls"
          ? { ...s, stalls: s.stalls + 1 }
          : key === "frameMs"
            ? { ...s, frameMs: value }
            : { ...s, [key]: [...s[key], value].slice(-50) };
      return { ...prev, [source]: next };
    });
  }, [source]);

  // Play the current clip, park the rest at their first frame.
  const showClip = useCallback(
    (index: number, auto: boolean) => {
      videos.current.forEach((v, i) => {
        if (!v || i === index) return;
        v.pause();
        v.currentTime = 0;
      });
      const v = videos.current[index];
      if (!v) return;
      v.muted = !sound;
      // Time from the tap (or timer) to the first new frame on screen.
      const t0 = performance.now();
      if ("requestVideoFrameCallback" in v) {
        v.requestVideoFrameCallback((now) => record("handoffs", now - t0));
      }
      v.play().then(
        () => {
          if (auto) setAudioResult(sound ? "played WITH sound ✓" : "played muted (sound was off)");
        },
        (err: unknown) => {
          const name = err instanceof Error ? err.name : "error";
          if (auto) setAudioResult(`sound blocked (${name}) → fell back to muted`);
          v.muted = true;
          v.play().catch(() => {});
        },
      );
    },
    [sound, record],
  );

  const go = useCallback(
    (delta: number, auto = false) => {
      const n = clips.length;
      const next = (((cur + delta) % n) + n) % n;
      setCur(next);
      showClip(next, auto);
    },
    [clips.length, cur, showClip],
  );

  // The first tap: start playback and, if asked, "unlock" every loaded clip for
  // sound by playing and pausing it inside this user gesture (the iOS rule).
  // The current clip starts first, because showClip pauses every other clip —
  // pausing one mid-unlock would abort its play() and undo the unlock.
  function start() {
    setStarted(true);
    showClip(cur, false);
    if (unlockOnStart) {
      videos.current.forEach((v, i) => {
        if (!v || i === cur || !v.getAttribute("src")) return;
        v.muted = false;
        v.play().then(
          () => {
            v.pause();
            v.currentTime = 0;
          },
          () => {},
        );
      });
    }
  }

  // Frame timing on the current clip: the gap where the loop wraps, plus the
  // normal frame interval to compare it with.
  useEffect(() => {
    if (!open || !started) return;
    const v = videos.current[cur];
    if (!v || !("requestVideoFrameCallback" in v)) return;
    let handle = 0;
    let last: { now: number; media: number } | null = null;
    const deltas: number[] = [];
    const onFrame = (now: number, meta: VideoFrameCallbackMetadata) => {
      if (last) {
        const gap = now - last.now;
        if (meta.mediaTime + 0.25 < last.media) {
          record("seams", gap); // mediaTime jumped back: the loop wrapped
        } else if (gap < 200) {
          deltas.push(gap);
          if (deltas.length === 60) {
            record("frameMs", deltas.reduce((a, b) => a + b, 0) / deltas.length);
            deltas.length = 0;
          }
        }
      }
      last = { now, media: meta.mediaTime };
      handle = v.requestVideoFrameCallback(onFrame);
    };
    handle = v.requestVideoFrameCallback(onFrame);
    const onWaiting = () => record("stalls", 1);
    v.addEventListener("waiting", onWaiting);
    return () => {
      v.cancelVideoFrameCallback(handle);
      v.removeEventListener("waiting", onWaiting);
    };
  }, [open, started, cur, source, record]);

  // Buffer and screen readouts, refreshed twice a second while the stage is open.
  useEffect(() => {
    if (!open) return;
    const tick = () => {
      setBuffers(
        clips.map((c, i) => {
          const v = videos.current[i];
          if (!v || !v.getAttribute("src") && !v.currentSrc) return `${c.label}: not loaded`;
          const end = v.buffered.length ? v.buffered.end(v.buffered.length - 1) : 0;
          const pct = v.duration ? Math.round((end / v.duration) * 100) : 0;
          return `${c.label}: ${pct}% buffered · readyState ${v.readyState}`;
        }),
      );
      const standalone = window.matchMedia("(display-mode: standalone)").matches;
      setScreen(
        `${window.innerWidth}×${window.innerHeight} · home-screen app ${standalone ? "yes" : "no"} · fullscreen API ${
          document.fullscreenEnabled ? "yes" : "no"
        }`,
      );
    };
    tick();
    const id = window.setInterval(tick, 500);
    return () => window.clearInterval(id);
  }, [open, clips]);

  // Auto-advance reads the latest `go` when its timer fires, not the one from
  // when it was started.
  const goRef = useRef(go);
  useEffect(() => {
    goRef.current = go;
  }, [go]);

  function stopCountdown() {
    if (countdownTimer.current !== null) window.clearInterval(countdownTimer.current);
    countdownTimer.current = null;
    setCountdown(null);
  }

  // The advance runs from a timer, not a tap — the "play once" tutorial case.
  function autoAdvance() {
    let left = AUTO_ADVANCE_SECONDS;
    setCountdown(left);
    countdownTimer.current = window.setInterval(() => {
      left -= 1;
      if (left > 0) {
        setCountdown(left);
        return;
      }
      stopCountdown();
      goRef.current(1, true);
    }, 1000);
  }

  function applyClips() {
    const parsed = parseClips(draft);
    if (!parsed.length) return;
    setClips(parsed);
    setCur(0);
    router.replace(`${pathname}?${new URLSearchParams({ clips: draft.trim() })}`);
  }

  function switchSource(next: Source) {
    setSource(next);
    setStarted(false);
  }

  function close() {
    videos.current.forEach((v) => v?.pause());
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    stopCountdown();
    setOpen(false);
    setStarted(false);
  }

  function results(): string {
    const line = (s: Source) =>
      `${s.toUpperCase()}\n  loop seam: ${summarize(stats[s].seams)}\n  next clip: ${summarize(stats[s].handoffs)}\n  normal frame: ${
        stats[s].frameMs ? `${Math.round(stats[s].frameMs!)} ms` : "—"
      }\n  stalls: ${stats[s].stalls}`;
    return [
      `Playback lab — ${navigator.userAgent}`,
      `Screen: ${screen}`,
      line("mp4"),
      line("hls"),
      `Sound after auto-advance: ${audioResult} (unlock on start: ${unlockOnStart ? "on" : "off"})`,
    ].join("\n");
  }

  async function copyResults() {
    try {
      await navigator.clipboard.writeText(results());
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  const s = stats[source];
  const btn =
    "h-9 rounded-full bg-white/15 px-3 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/25";
  const on = "bg-white text-zinc-900 hover:bg-white";

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <label htmlFor="lab-clips" className="text-sm font-medium text-zinc-700">
          Clips — one Mux playback ID per line, optional label after a space
        </label>
        <textarea
          id="lab-clips"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={4}
          className="w-full rounded-lg border border-zinc-300 p-3 font-mono text-xs"
        />
        <p className="text-xs text-zinc-500">
          The MP4 test needs clips created with a static rendition (
          <code>make-clip.mjs --mp4</code> or <code>upload-video.mjs --mp4</code>); without one the
          MP4 URL 404s. HLS works for any public playback ID.
        </p>
        <button
          onClick={applyClips}
          className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium hover:bg-zinc-50"
        >
          Use these clips
        </button>
        <p className="text-xs text-zinc-500">
          Using a list puts it in the page address — open that same link on your phone to test the
          same clips.
        </p>
      </div>

      <label className="flex items-center gap-2 text-sm text-zinc-700">
        <input type="checkbox" checked={unlockOnStart} onChange={(e) => setUnlockOnStart(e.target.checked)} />
        Unlock sound on every loaded clip during the first tap
      </label>

      <button
        onClick={() => setOpen(true)}
        className="rounded-lg bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800"
      >
        Open the player
      </button>

      {open && (
        <div ref={stageRef} className="fixed inset-0 z-50 h-dvh bg-black">
          <div className="relative mx-auto h-full w-full sm:aspect-[9/16] sm:w-auto">
            {clips.map((clip, i) => (
              <LabVideo
                key={`${source}-${i}-${clip.playbackId}`}
                index={i}
                url={clipUrl(clip.playbackId, source)}
                hls={source === "hls"}
                load={isLoaded(i, cur, clips.length)}
                visible={i === cur}
                register={register}
              />
            ))}

            {/* Story-style segments, one per clip */}
            <div className="absolute inset-x-4 top-4 flex gap-1.5">
              {clips.map((clip, i) => (
                <div key={i} className={`h-1 flex-1 rounded-full ${i <= cur ? "bg-white" : "bg-white/35"}`} />
              ))}
            </div>

            {/* Tap zones: left third back, the rest forward — as in the design */}
            {started && (
              <div className="absolute inset-0 flex">
                <button aria-label="Previous clip" className="h-full w-1/3" onClick={() => go(-1)} />
                <button aria-label="Next clip" className="h-full flex-1" onClick={() => go(1)} />
              </div>
            )}

            {!started && (
              <button
                onClick={start}
                className="absolute inset-0 flex items-center justify-center bg-black/40 text-lg font-semibold text-white"
              >
                Tap to start ({source.toUpperCase()})
              </button>
            )}

            <div className="absolute inset-x-3 bottom-3 space-y-2 rounded-2xl bg-black/70 p-3 text-white backdrop-blur">
              <div className="flex flex-wrap gap-2">
                <button className={`${btn} ${source === "mp4" ? on : ""}`} onClick={() => switchSource("mp4")}>
                  MP4
                </button>
                <button className={`${btn} ${source === "hls" ? on : ""}`} onClick={() => switchSource("hls")}>
                  HLS
                </button>
                <button className={`${btn} ${sound ? on : ""}`} onClick={() => setSound(!sound)}>
                  Sound {sound ? "on" : "off"}
                </button>
                <button className={btn} disabled={!started || countdown !== null} onClick={autoAdvance}>
                  {countdown !== null ? `Advancing in ${countdown}…` : `Auto-advance in ${AUTO_ADVANCE_SECONDS}s`}
                </button>
                <button
                  className={btn}
                  onClick={() => stageRef.current?.requestFullscreen?.().catch(() => {})}
                >
                  Full screen
                </button>
                <button className={btn} onClick={() => setShowStats(!showStats)}>
                  {showStats ? "Hide stats" : "Stats"}
                </button>
                <button className={btn} onClick={copyResults}>
                  {copied ? "Copied" : "Copy results"}
                </button>
                <button className={btn} onClick={close}>
                  Exit
                </button>
              </div>
              {showStats && (
                <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 font-mono text-[11px] leading-snug">
                  <dt className="text-white/60">clip</dt>
                  <dd>
                    {cur + 1}/{clips.length} · {clips[cur]?.label}
                  </dd>
                  <dt className="text-white/60">loop seam</dt>
                  <dd>{summarize(s.seams)}</dd>
                  <dt className="text-white/60">next clip</dt>
                  <dd>{summarize(s.handoffs)}</dd>
                  <dt className="text-white/60">frame</dt>
                  <dd>{s.frameMs ? `${Math.round(s.frameMs)} ms normally` : "—"}</dd>
                  <dt className="text-white/60">stalls</dt>
                  <dd>{s.stalls}</dd>
                  <dt className="text-white/60">sound</dt>
                  <dd>{audioResult}</dd>
                  <dt className="text-white/60">buffers</dt>
                  <dd>{buffers.join(" | ")}</dd>
                  <dt className="text-white/60">screen</dt>
                  <dd>{screen}</dd>
                </dl>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
