"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo } from "react";
import { BackIcon, ExternalIcon } from "@/components/icons";
import { LiveRow } from "@/components/live";
import { StoryRow, StorySkeleton } from "@/components/story";
import { useArticles, useTrends, useVideos } from "@/lib/channels";
import { hashtag, keywords, matchScore } from "@/lib/live";
import { useT } from "@/lib/i18n";

export default function Page() {
  // useSearchParams needs a Suspense boundary.
  return (
    <Suspense>
      <Topic />
    </Suspense>
  );
}

// One topic (a trend, or a search): who's live on it, videos about it, and
// Stack's articles on it, so watching leads to reading.
function Topic() {
  const t = useT();
  const router = useRouter();
  const params = useSearchParams();
  const query = (params.get("q") ?? "").slice(0, 120);
  const tag = params.get("tag") || hashtag(query);
  const words = useMemo(() => keywords(query), [query]);

  const trends = useTrends();
  const trend = trends.items.find((x) => x.query === query);
  const videos = useVideos(true);
  const matching = useMemo(
    () =>
      videos.items
        .map((s) => ({ s, score: matchScore(s.title, words) }))
        .filter((x) => x.score > 0)
        .sort((a, b) => b.score - a.score || Date.parse(b.s.createdAt) - Date.parse(a.s.createdAt))
        .slice(0, 12)
        .map((x) => x.s),
    [videos.items, words],
  );
  const articles = useArticles(query);

  const heading = (text: string) => <h2 className="mt-7 text-[19px] font-bold">{text}</h2>;
  const empty = (text: string) => <p className="py-4 text-[13px] text-muted">{text}</p>;

  return (
    <main className="min-h-dvh px-(--gutter) pt-1 pb-16">
      <div className="flex h-14 items-center">
        <button
          aria-label={t("Back")}
          onClick={() => (history.length > 1 ? router.back() : router.push("/news"))}
          className="-ml-2.5 flex size-11 items-center justify-center"
        >
          <BackIcon size={22} />
        </button>
      </div>
      <span className="label text-[10px] text-news-text">
        {trend ? t("Trending in India") : t("Topic")}
        {trend?.traffic ? ` · ${t("{n} searches", { n: trend.traffic })}` : ""}
      </span>
      <h1 className="display mt-2 text-[clamp(44px,13vw,80px)] leading-[0.9] break-words">{tag}</h1>

      {heading(t("Live now"))}
      <LiveRow about={query} />

      {heading(t("Videos"))}
      <div className="mt-1">
        {videos.status === "loading" ? <StorySkeleton rows={3} /> : matching.length ? matching.map((s, i) => <StoryRow key={s.id} story={s} index={i} />) : empty(t("No videos on this yet."))}
      </div>

      {heading(t("Read about it"))}
      <div className="mt-1">
        {articles.status === "loading" ? (
          <StorySkeleton rows={3} />
        ) : articles.items.length ? (
          articles.items.map((s, i) => <StoryRow key={s.id} story={s} index={i} />)
        ) : (
          empty(t("No articles on this yet."))
        )}
      </div>

      {trend && trend.news.length > 0 && (
        <>
          {heading(t("More coverage"))}
          <ul className="mt-1">
            {trend.news.map((n) => (
              <li key={n.url}>
                <a href={n.url} target="_blank" rel="noopener noreferrer" className="flex items-start gap-3 border-b border-line py-3.5">
                  <span className="flex min-w-0 grow flex-col gap-1.5">
                    <span className="text-[15px] leading-[1.3] font-semibold">{n.title}</span>
                    <span className="label text-[10px] text-muted">{n.source}</span>
                  </span>
                  <ExternalIcon size={15} className="mt-1 shrink-0 text-muted" />
                </a>
              </li>
            ))}
          </ul>
        </>
      )}
    </main>
  );
}
