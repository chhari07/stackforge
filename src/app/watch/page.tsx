"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { BackIcon, BookmarkIcon, ClockIcon, ExternalIcon, ShareIcon } from "@/components/icons";
import { useNowPlaying } from "@/components/now-playing";
import { useToast } from "@/components/toast";
import { getSaved, toggleSaved } from "@/lib/db";
import { useStore } from "@/lib/use-store";
import { ago, newsTime } from "@/lib/format";
import { isVideoId, type Story } from "@/lib/news";
import { QuoteCardSheet } from "@/components/quote-card-sheet";
import { storyCard } from "@/lib/quote-card";
import { useT } from "@/lib/i18n";
import { ReadAbout } from "@/components/live";
import { useFocus } from "@/components/focus-provider";
import { onMobileData, wifiOnly } from "@/lib/channels";

export default function Page() {
  // useSearchParams needs a Suspense boundary.
  return (
    <Suspense>
      <Watch />
    </Suspense>
  );
}

// A news video (or a live channel, with live=1) played in YouTube's
// privacy-enhanced player, with Stack's articles about it underneath.
function Watch() {
  const tt = useT();
  const params = useSearchParams();
  const raw = params.get("v") ?? "";
  const live = params.get("live") === "1";
  const v = isVideoId(raw) ? raw : "";
  const id = `yt-${v}`;
  const router = useRouter();
  const toast = useToast();
  const [saved] = useStore(getSaved, []);
  const [story, setStory] = useState<Story | null>(null);
  const now = useNowPlaying();
  const paused = useRef(false);

  // The list hands over the title, channel and time (rememberStory).
  useEffect(() => {
    try {
      const s = sessionStorage.getItem(`stack.story:${id}`);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (s) setStory(JSON.parse(s));
    } catch {}
  }, [id]);

  // Don't play music over the video.
  useEffect(() => {
    if (!paused.current && now?.playing) {
      paused.current = true;
      now.toggle();
    }
  }, [now]);

  // Held back until the person says so: live news during a focus session, and
  // any video on mobile data when "Wi-Fi only" is on (Settings → Live news).
  const { session } = useFocus();
  const [allowed, setAllowed] = useState(false);
  const [mobile, setMobile] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMobile(wifiOnly() && onMobileData()), []);
  const hold = allowed ? null : live && session ? "focus" : mobile ? "data" : null;

  const fromLibrary = saved.find((a) => a.id === id);
  const title = story?.title ?? fromLibrary?.title ?? tt("News video");
  const source = story?.source ?? fromLibrary?.source ?? "YouTube";
  const isSaved = !!fromLibrary;
  const url = `https://www.youtube.com/watch?v=${v}`;

  const [sharing, setSharing] = useState(false);
  const thumb = `https://i.ytimg.com/vi/${v}/hqdefault.jpg`;

  const round = "flex size-11 shrink-0 items-center justify-center rounded-full border border-ink/15";

  return (
    <main className="min-h-dvh bg-paper pb-24">
      <div className="sticky top-0 z-10 bg-black pt-[env(safe-area-inset-top)]">
        <div className="flex h-12 items-center px-2 text-white">
          <button
            aria-label={tt("Back")}
            onClick={() => (history.length > 1 ? router.back() : router.push("/news"))}
            className="flex size-11 items-center justify-center"
          >
            <BackIcon size={22} />
          </button>
          <span className="label truncate text-[11px]">{source}</span>
        </div>
        <div className="mx-auto aspect-video w-full max-w-[960px] bg-black">
          {v && hold ? (
            <div className="flex size-full flex-col items-center justify-center gap-3 px-6 text-center text-white">
              <p className="text-[14px] leading-relaxed text-white/80">
                {hold === "focus" ? tt("You’re in a focus session. Live news can wait.") : tt("You’re on mobile data, and videos are set to Wi-Fi only.")}
              </p>
              <button onClick={() => setAllowed(true)} className="label h-10 rounded-full bg-white px-4 text-[10px] text-black">
                {tt("Play anyway")}
              </button>
            </div>
          ) : v ? (
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${v}?autoplay=1&playsinline=1&rel=0`}
              title={title}
              allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
              className="size-full border-0"
            />
          ) : (
            <p className="flex size-full items-center justify-center text-[14px] text-white/70">{tt("This video link isn’t valid.")}</p>
          )}
        </div>
      </div>

      <div className="mx-auto max-w-[760px] px-5 pt-5">
        <span className={`label rounded-full px-2.5 py-1 text-[10px] text-white ${live ? "bg-music" : "bg-news"}`}>
          {source}
          {live ? ` · ${tt("Live")}` : story ? ` · ${ago(story.createdAt)}` : ""}
        </span>
        <h1 className="mt-3 text-[22px] leading-[1.2] font-bold">{title}</h1>
        {story && !live && (
          <time dateTime={story.createdAt} className="label mt-2 flex items-center gap-1.5 text-[10px] text-muted">
            <ClockIcon size={13} />
            {newsTime(story.createdAt)}
          </time>
        )}

        <div className="mt-4 flex items-center gap-2">
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-11 grow items-center justify-center gap-2 rounded-full bg-ink text-[14px] font-semibold text-on-ink"
          >
            {tt("Open in YouTube")} <ExternalIcon size={15} />
          </a>
          <button
            aria-label={isSaved ? tt("Remove from saved") : tt("Save for later")}
            aria-pressed={isSaved}
            onClick={async () => {
              const nowSaved = await toggleSaved({ id, title, source, image: thumb });
              toast(nowSaved ? { text: tt("Saved to your Library"), href: "/library" } : { text: tt("Removed from saved") });
            }}
            className={round}
          >
            <BookmarkIcon size={18} filled={isSaved} />
          </button>
          <button aria-label={tt("Share")} onClick={() => setSharing(true)} className={round}>
            <ShareIcon size={18} />
          </button>
        </div>

        {story?.summary && (
          <p className="mt-5 text-[15px] leading-[1.6] whitespace-pre-line text-muted">{story.summary}</p>
        )}
        {v && title !== tt("News video") && <ReadAbout title={title} />}
        <p className="mt-6 text-[12px] leading-relaxed text-muted">
          {tt("If the video doesn’t play here, the channel may only allow it on YouTube. Use Open in YouTube.")}
        </p>
      </div>
      <QuoteCardSheet
        card={
          sharing
            ? storyCard({ title, source, url, summary: story?.summary, createdAt: story?.createdAt, image: v ? thumb : undefined })
            : null
        }
        onClose={() => setSharing(false)}
      />
    </main>
  );
}
