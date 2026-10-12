"use client";

// Live Indian news, # Trending India, your own channels and "Read about this"
// (lib/live.ts, lib/channels.ts). Videos play in YouTube's player on /watch.
import Link from "next/link";
import { useMemo, useState } from "react";
import { addChannel, getChannels, removeChannel, useArticles, useLive, useTrends, useVideos } from "@/lib/channels";
import { keywords, matchScore, SUGGESTED_CHANNELS, type LiveNow, type Trend } from "@/lib/live";
import type { Story } from "@/lib/news";
import { useStore } from "@/lib/use-store";
import { useT } from "@/lib/i18n";
import { ChevronRight, ExternalIcon, PlusIcon, SearchIcon, TrashIcon } from "./icons";
import { Sheet } from "./sheet";
import { StoryRow, StorySkeleton, rememberStory } from "./story";
import { useFocus } from "./focus-provider";
import { useToast } from "./toast";

export const topicHref = (t: { query: string; tag?: string }) =>
  `/news/topic?q=${encodeURIComponent(t.query)}${t.tag ? `&tag=${encodeURIComponent(t.tag)}` : ""}`;

// ---- # Trending India ----

export function TrendingRow({ className = "" }: { className?: string }) {
  const t = useT();
  const trends = useTrends();
  if (trends.status !== "ok" || !trends.items.length) return null;
  return (
    <div className={className}>
      <div role="list" aria-label={t("Trending in India")} className="no-scrollbar bleed flex items-center gap-2 overflow-x-auto overscroll-x-contain">
        <span className="label shrink-0 text-[10px] font-medium text-news-text">{t("# Trending")}</span>
        {trends.items.slice(0, 10).map((tr) => (
          <Link
            role="listitem"
            key={tr.query}
            href={topicHref(tr)}
            className="flex h-8 shrink-0 items-center rounded-full bg-news-tint px-3 text-[12px] font-semibold text-news-deep"
          >
            {tr.tag}
          </Link>
        ))}
      </div>
    </div>
  );
}

// ---- Live now ----

const liveStory = (l: LiveNow): Story => ({
  id: `yt-${l.video}`,
  source: l.channel.name,
  title: l.title || l.channel.name,
  url: `https://www.youtube.com/watch?v=${l.video}`,
  domain: "youtube.com",
  image: `https://i.ytimg.com/vi/${l.video}/hqdefault_live.jpg`,
  createdAt: new Date().toISOString(),
  video: l.video,
});

export function LiveCard({ live }: { live: LiveNow }) {
  const t = useT();
  const inner = (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`https://i.ytimg.com/vi/${live.video}/hqdefault_live.jpg`} alt="" loading="lazy" className="absolute inset-0 size-full object-cover opacity-70" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />
      <span className="label absolute top-2.5 left-2.5 flex items-center gap-1.5 rounded-full bg-music px-2 py-1 text-[9px] text-white">
        <span className="size-1.5 animate-pulse rounded-full bg-white" /> {t("Live")}
      </span>
      {!live.embeddable && (
        <span className="label absolute top-2.5 right-2.5 flex items-center gap-1 rounded-full bg-black/60 px-2 py-1 text-[9px] text-white">
          YouTube <ExternalIcon size={10} />
        </span>
      )}
      <span className="relative label text-[10px] text-white/80">{live.channel.name}</span>
      <span className="relative mt-1 line-clamp-2 text-[14px] leading-[1.25] font-bold text-white">{live.title}</span>
    </>
  );
  const box = "relative flex h-[150px] w-[236px] flex-col justify-end overflow-hidden rounded-2xl bg-soft p-3";
  // A channel that keeps its stream on YouTube opens there.
  return live.embeddable ? (
    <Link href={`/watch?v=${live.video}&live=1`} onClick={() => rememberStory(liveStory(live))} className={box}>
      {inner}
    </Link>
  ) : (
    <a href={`https://www.youtube.com/watch?v=${live.video}`} target="_blank" rel="noopener noreferrer" className={box}>
      {inner}
    </a>
  );
}

/** "Live now": every live Indian channel, or only those covering `about` first. */
export function LiveRow({ about }: { about?: string }) {
  const t = useT();
  const { session } = useFocus();
  const live = useLive(!session);
  const items = useMemo(() => {
    if (!about) return live.items;
    const w = keywords(about);
    return [...live.items].sort((a, b) => matchScore(b.title, w) - matchScore(a.title, w));
  }, [live.items, about]);

  if (session)
    return <p className="mt-2 rounded-2xl bg-card px-4 py-3 text-[13px] text-muted">{t("Live news is hidden during your focus session.")}</p>;
  if (live.status === "loading")
    return (
      <div className="bleed rail mt-2 gap-3">
        {[0, 1].map((i) => (
          <div key={i} className="h-[150px] w-[236px] animate-pulse rounded-2xl bg-rule" />
        ))}
      </div>
    );
  if (!items.length)
    return <p className="mt-2 text-[13px] text-muted">{live.status === "error" ? t("Couldn’t check the live channels. Pull to refresh.") : t("No Indian news channel is live right now.")}</p>;
  return (
    <div role="list" aria-label={t("Live now")} className="bleed rail mt-2 gap-3">
      {items.map((l) => (
        <div role="listitem" key={l.channel.id}>
          <LiveCard live={l} />
        </div>
      ))}
    </div>
  );
}

// ---- The Video topic: live, search, your channels, latest videos ----

export function VideoSection() {
  const t = useT();
  const [q, setQ] = useState("");
  const [managing, setManaging] = useState(false);
  const [mine] = useStore(getChannels, []);
  const videos = useVideos(true);
  const shown = useMemo(() => {
    const w = keywords(q);
    return w.length ? videos.items.filter((s) => matchScore(s.title, w) > 0 || s.source.toLowerCase().includes(q.trim().toLowerCase())) : videos.items;
  }, [videos.items, q]);

  return (
    <>
      <div className="mt-5 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-[19px] font-bold">
          <span className="size-2.5 animate-pulse rounded-full bg-music" /> {t("Live now")}
        </h2>
        <span className="label text-[10px] text-muted">{t("Indian news channels")}</span>
      </div>
      <LiveRow />

      <form
        onSubmit={(e) => e.preventDefault()}
        className="mt-6 flex h-[46px] items-center gap-2.5 rounded-full border border-ink/12 bg-card px-4"
      >
        <SearchIcon size={18} className="text-muted" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label={t("Search Indian news videos")}
          placeholder={t("Search Indian news videos")}
          className="min-w-0 grow bg-transparent text-[14px] outline-none"
        />
        {keywords(q).length > 0 && (
          <Link href={topicHref({ query: q })} className="label -mr-1.5 flex h-8 shrink-0 items-center rounded-full bg-ink px-3 text-[10px] text-on-ink">
            {t("Topic page")}
          </Link>
        )}
      </form>

      <button onClick={() => setManaging(true)} className="mt-3 flex w-full items-center gap-3 rounded-2xl bg-card px-4 py-3 text-left">
        <span className="flex min-w-0 grow flex-col">
          <span className="text-[15px] font-semibold">{t("Your channels")}</span>
          <span className="truncate text-[12px] text-muted">
            {mine.length ? mine.map((c) => c.name).join(", ") : t("Add independent news channels you trust")}
          </span>
        </span>
        <ChevronRight size={18} className="shrink-0 text-muted" />
      </button>

      <div className="mt-[22px] flex items-baseline justify-between">
        <h2 className="text-[19px] font-bold">{q.trim() ? t("Results for “{q}”", { q: q.trim() }) : t("Latest videos")}</h2>
      </div>
      <div className="mt-1">
        {videos.status === "loading" && <StorySkeleton rows={5} />}
        {videos.status !== "loading" && shown.length === 0 && (
          <p className="py-10 text-center text-[14px] text-muted">{q.trim() ? t("Nothing on that. Try another word.") : t("Couldn’t reach the channels. Check your connection and try again.")}</p>
        )}
        {shown.slice(0, 60).map((s, i) => (
          <StoryRow key={s.id} story={s} index={i} />
        ))}
      </div>
      <ChannelsSheet open={managing} onClose={() => setManaging(false)} />
    </>
  );
}

// ---- Your channels ----

export function ChannelsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT();
  const toast = useToast();
  const [mine] = useStore(getChannels, []);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  const add = async (what: string | (typeof SUGGESTED_CHANNELS)[number]) => {
    const key = typeof what === "string" ? what : what.id;
    if (busy || !key.trim()) return;
    setBusy(key);
    setError("");
    const { channel, error } = await addChannel(what);
    setBusy(null);
    if (error) return setError(error);
    setInput("");
    toast({ text: t("Added {name}", { name: channel!.name }) });
  };
  const suggestions = SUGGESTED_CHANNELS.filter((s) => !mine.some((c) => c.id === s.id));

  return (
    <Sheet open={open} onClose={onClose} title="Your channels">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          add(input);
        }}
        className="flex gap-2"
      >
        <input
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            setError("");
          }}
          autoCorrect="off"
          spellCheck={false}
          autoCapitalize="none"
          placeholder={t("YouTube link or @handle")}
          aria-label={t("YouTube link or @handle")}
          className="h-12 min-w-0 grow rounded-full border border-ink/15 bg-card px-4 text-[15px] outline-none focus:border-ink"
        />
        <button disabled={!input.trim() || !!busy} className="h-12 shrink-0 rounded-full bg-ink px-5 text-[15px] font-semibold text-on-ink disabled:opacity-40">
          {busy === input && input ? t("Checking…") : t("Add")}
        </button>
      </form>
      {error ? (
        <p className="-mt-2 text-[13px] text-music-text">{error}</p>
      ) : (
        <p className="-mt-2 text-[13px] text-muted">{t("Their videos join Latest videos, and their live streams join Live now.")}</p>
      )}

      {mine.length > 0 && (
        <ul className="flex flex-col">
          {mine.map((c) => (
            <li key={c.id} className="flex items-center gap-3 border-b border-line py-2.5">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-music-tint text-[15px] font-bold text-music-deep">
                {c.name.slice(0, 1)}
              </span>
              <span className="min-w-0 grow truncate text-[15px] font-semibold">{c.name}</span>
              <button
                aria-label={t("Remove {name}", { name: c.name })}
                onClick={async () => {
                  await removeChannel(c.id);
                  toast({ text: t("Removed {name}", { name: c.name }) });
                }}
                className="-mr-2 flex size-11 shrink-0 items-center justify-center text-muted"
              >
                <TrashIcon size={18} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {suggestions.length > 0 && (
        <>
          <h3 className="label mt-1 text-[10px] text-muted">{t("Independent news · you choose")}</h3>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((s) => (
              <button
                key={s.id}
                onClick={() => add(s)}
                disabled={!!busy}
                className="flex h-10 items-center gap-1.5 rounded-full border border-ink/20 pr-3.5 pl-2.5 text-[13px] font-medium disabled:opacity-50"
              >
                <PlusIcon size={14} />
                {busy === s.id ? t("Adding…") : s.name}
              </button>
            ))}
          </div>
          <p className="text-[12px] leading-relaxed text-muted">{t("Suggestions are from across the spectrum. Stack doesn’t pick sides: add only what you want.")}</p>
        </>
      )}
    </Sheet>
  );
}

// ---- Read about this ----

/** Stack's articles about a video, so watching leads back to reading. */
export function ReadAbout({ title }: { title: string }) {
  const t = useT();
  const articles = useArticles(title);
  const words = keywords(title).slice(0, 4).join(" ");
  return (
    <section className="mt-6">
      <h2 className="label text-[11px] font-medium">{t("Read about this")}</h2>
      <div className="mt-1">
        {articles.status === "loading" && <StorySkeleton rows={2} />}
        {articles.status !== "loading" &&
          (articles.items.length ? (
            articles.items.slice(0, 3).map((s, i) => <StoryRow key={s.id} story={s} index={i} />)
          ) : (
            <p className="py-3 text-[13px] text-muted">{t("No articles on this yet.")}</p>
          ))}
      </div>
      {words && (
        <Link href={topicHref({ query: words })} className="label mt-3 inline-flex items-center gap-1 text-[10px] underline">
          {t("Everything on this topic")} <ChevronRight size={12} />
        </Link>
      )}
    </section>
  );
}

export type { Trend };
