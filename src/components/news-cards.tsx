"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ago, newsTime } from "@/lib/format";
import { getSaved, toggleSaved } from "@/lib/db";
import { useStore } from "@/lib/use-store";
import { safeImage, type Story } from "@/lib/use-news";
import { PlayBadge, rememberStory, storyHref } from "./story";
import { useToast } from "./toast";
import { downloadArticle } from "@/lib/offline";
import { BookmarkIcon, ClockIcon, ShareIcon } from "./icons";
import { QuoteCardSheet } from "./quote-card-sheet";
import { storyCard } from "@/lib/quote-card";
import { useT } from "@/lib/i18n";

const TINTS = ["#2F4B3A", "#54473A", "#2C3E57", "#4A2F3A", "#3A3A37"];
const HINT_KEY = "stack.cards-hint-seen";

// One story per full-height card; swipe up for the next (Inshorts-style).
export function NewsCards({ stories }: { stories: Story[] }) {
  const t = useT();
  const toast = useToast();
  const [saved] = useStore(getSaved, []);
  const [index, setIndex] = useState(0);
  const [hint, setHint] = useState(false);
  const [sharing, setSharing] = useState<Story | null>(null);
  const scroller = useRef<HTMLDivElement>(null);

  // Which card is on screen, for the "3 / 40" counter.
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const onScroll = () =>
      setIndex(Math.round(el.scrollTop / Math.max(1, el.clientHeight)));
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  // New topic or search: back to the first card.
  useEffect(() => {
    scroller.current?.scrollTo({ top: 0 });
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIndex(0);
  }, [stories]);

  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (!localStorage.getItem(HINT_KEY)) setHint(true);
    } catch {}
  }, []);
  useEffect(() => {
    if (index > 0 && hint) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setHint(false);
      try {
        localStorage.setItem(HINT_KEY, "1");
      } catch {}
    }
  }, [index, hint]);

  return (
    <div className="relative min-h-0 grow">
      <div
        ref={scroller}
        className="no-scrollbar h-full snap-y snap-mandatory overflow-y-auto overscroll-contain"
        aria-label={t("News cards, swipe up for the next story")}
      >
        {stories.map((s, i) => {
          const img = safeImage(s.image);
          const isSaved = saved.some((a) => a.id === s.id);
          const summary =
            s.summary ??
            (s.points !== undefined
              ? `${s.points} points and ${s.comments ?? 0} comments on ${s.source}${s.domain ? ` · ${s.domain}` : ""}`
              : s.domain);
          return (
            <article
              key={s.id}
              className="h-full snap-start snap-always pb-3"
              aria-label={s.title}
            >
              <div className="card-snap flex h-full flex-col overflow-hidden rounded-3xl bg-card shadow-[0_10px_30px_rgba(0,0,0,.08)]">
                <div
                  className="relative h-[40%] shrink-0"
                  style={{ background: TINTS[i % TINTS.length] }}
                >
                  {img ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={img}
                      alt=""
                      loading={i < 2 ? "eager" : "lazy"}
                      className="size-full object-cover"
                    />
                  ) : (
                    <span className="display absolute inset-x-5 bottom-4 text-[56px] leading-[0.85] text-white/85 uppercase">
                      {s.source}
                    </span>
                  )}
                  {s.video && (
                    <Link href={storyHref(s)} onClick={() => rememberStory(s)} aria-label={t("Watch {title}", { title: s.title })}>
                      <PlayBadge size={64} />
                    </Link>
                  )}
                  <span className="label absolute top-3 left-3 rounded-full bg-news px-2.5 py-1 text-[10px] text-white">
                    {s.source} · {ago(s.createdAt)}
                  </span>
                  <span className="label absolute top-3 right-3 rounded-full bg-black/55 px-2.5 py-1 text-[10px] text-white">
                    {i + 1} / {stories.length}
                  </span>
                </div>
                <div className="flex min-h-0 grow flex-col px-5 pt-4 pb-4">
                  <Link
                    href={storyHref(s)}
                    onClick={() => rememberStory(s)}
                  >
                    <h2 className="line-clamp-4 text-[22px] leading-[1.18] font-bold">
                      {s.title}
                    </h2>
                  </Link>
                  <time
                    dateTime={s.createdAt}
                    className="label mt-2 flex items-center gap-1.5 text-[10px] text-muted"
                  >
                    <ClockIcon size={13} />
                    {newsTime(s.createdAt)}
                  </time>
                  {summary && (
                    <p className="mt-3 line-clamp-6 min-h-0 text-[15px] leading-[1.55] text-muted">
                      {summary}
                    </p>
                  )}
                  <div className="mt-auto flex items-center gap-2 pt-3">
                    <Link
                      href={storyHref(s)}
                      onClick={() => rememberStory(s)}
                      className="flex h-11 grow items-center justify-center rounded-full bg-ink text-[14px] font-semibold text-on-ink"
                    >
                      {s.video ? t("Watch video") : t("Read full story")}
                    </Link>
                    <button
                      aria-label={
                        isSaved ? t("Remove from saved") : t("Save for later")
                      }
                      aria-pressed={isSaved}
                      onClick={async () => {
                        const now = await toggleSaved({
                          id: s.id,
                          title: s.title,
                          source: s.source,
                          image: img,
                        });
                        toast(
                          now
                            ? {
                                text: t("Saved to your Library"),
                                href: "/library",
                              }
                            : { text: t("Removed from saved") },
                        );
                        // Keep a copy to read offline.
                        if (now) downloadArticle(s.id).catch(() => {});
                      }}
                      className="flex size-11 shrink-0 items-center justify-center rounded-full border border-ink/15"
                    >
                      <BookmarkIcon size={18} filled={isSaved} />
                    </button>
                    <button
                      aria-label={t("Share")}
                      onClick={() => setSharing(s)}
                      className="flex size-11 shrink-0 items-center justify-center rounded-full border border-ink/15"
                    >
                      <ShareIcon size={18} />
                    </button>
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </div>
      <QuoteCardSheet card={sharing ? storyCard(sharing) : null} onClose={() => setSharing(null)} />
      {hint && stories.length > 1 && (
        <div
          aria-hidden
          className="label pointer-events-none absolute inset-x-0 bottom-20 mx-auto w-fit animate-bounce rounded-full bg-ink px-4 py-2 text-[10px] text-on-ink shadow-lg"
        >
          {t("↑ Swipe up for the next story")}
        </div>
      )}
    </div>
  );
}
