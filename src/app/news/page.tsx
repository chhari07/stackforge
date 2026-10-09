"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { TabBar } from "@/components/tab-bar";
import { TopBar } from "@/components/top-bar";
import { Chips } from "@/components/sheet";
import { HeroStory, StoryRow, StorySkeleton } from "@/components/story";
import { NewsCards } from "@/components/news-cards";
import { QuoteCardSheet } from "@/components/quote-card-sheet";
import { storyCard } from "@/lib/quote-card";
import { RefreshLogo, usePullToRefresh } from "@/components/pull-refresh";
import { useToast } from "@/components/toast";
import { Logo } from "@/components/logo";
import { CloseIcon, PlusIcon, SearchIcon } from "@/components/icons";
import { useFollowing, useNews, type Story, type Topic } from "@/lib/use-news";
import { addPref } from "@/lib/news-prefs";
import { NewsPrefsSheet } from "@/components/news-prefs-sheet";
import { isTopic, TOPICS } from "@/lib/news";
import { dayStamp, time12 } from "@/lib/format";
import { getProfile } from "@/lib/profile";
import { useStore } from "@/lib/use-store";
import { CardsIcon, FilterIcon, ListViewIcon, NewspaperIcon, StarIcon } from "@/components/stack-icons";
import { PapersSheet } from "@/components/papers-sheet";
import { TopicIcon } from "@/components/topic-icon";
import { FeedsSheet } from "@/components/feeds-sheet";
import { RssIcon } from "@/components/stack-icons";
import { getFeeds } from "@/lib/feeds";
import { useT, useUiLang } from "@/lib/i18n";

const TOPIC_KEY = "stack.news-topic";
const VIEW_KEY = "stack.news-view";
type View = "cards" | "list";

export default function News() {
  const [topic, setTopicState] = useState<Topic>("top");
  // Remember the last topic between visits.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(TOPIC_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (saved && isTopic(saved)) setTopicState(saved);
    } catch {}
  }, []);
  const setTopic = (t: Topic) => {
    setTopicState(t);
    try {
      localStorage.setItem(TOPIC_KEY, t);
    } catch {}
  };
  const [view, setViewState] = useState<View>("cards");
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (localStorage.getItem(VIEW_KEY) === "list") setViewState("list");
    } catch {}
  }, []);
  const setView = (v: View) => {
    setViewState(v);
    try {
      localStorage.setItem(VIEW_KEY, v);
    } catch {}
  };
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [stamp, setStamp] = useState<{ day: string; date: string } | null>(
    null,
  );
  const searchRef = useRef<HTMLInputElement>(null);
  const t = useT();
  const hindi = useUiLang() === "hi";
  const news = useNews(topic);
  // "Following": what you follow, from every topic (lib/news-prefs.ts).
  const [following, setFollowing] = useState(false);
  const followedNews = useFollowing(following);
  const feed = following ? followedNews : news;
  const follows = followedNews.follows;
  const [tuning, setTuning] = useState(false); // the "Your news" sheet
  const [papers, setPapers] = useState(false); // the "Today’s paper" sheet
  // Your profile interests come right after "Top".
  const [profile] = useStore(getProfile, { id: "me", updatedAt: 0 });
  const [feeds, feedsReady] = useStore(getFeeds, []);
  const [managing, setManaging] = useState(false);
  const [sharing, setSharing] = useState<Story | null>(null); // the story on the Share sheet (list view)
  const noFeeds = topic === "mine" && !following && feedsReady && feeds.length === 0;
  const topics = useMemo(() => {
    const mine = profile.interests ?? [];
    return [
      TOPICS[0],
      ...mine.flatMap((t) => TOPICS.filter((x) => x.value === t && x.value !== "top")),
      // Your own feeds come right after your interests.
      ...TOPICS.slice(1)
        .filter((x) => !mine.includes(x.value))
        .sort((a, b) => Number(b.value === "mine") - Number(a.value === "mine")),
    ].map((t) => ({ ...t, value: t.value as Topic | "following", icon: <TopicIcon topic={t.value} size={14} /> }));
  }, [profile.interests]);
  // With something followed, "Following" comes right after "Top".
  const chips = follows.length
    ? [topics[0], { value: "following" as const, label: "Following", icon: <StarIcon size={14} /> }, ...topics.slice(1)]
    : topics;
  const inFollowing = following && follows.length > 0;
  useEffect(() => {
    // The last followed word was removed: back to the topic.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (following && followedNews.status !== "loading" && !follows.length) setFollowing(false);
  }, [following, followedNews.status, follows.length]);
  const toast = useToast();
  const page = useRef<HTMLElement>(null);
  const [busy, setBusy] = useState(false);
  const refresh = async () => {
    if (busy || feed.status === "loading") return;
    setBusy(true);
    // Keep the logo stacking for a moment even when the network is quick.
    const [ok] = await Promise.all([
      feed.refresh(),
      new Promise((r) => setTimeout(r, 1200)),
    ]);
    setBusy(false);
    toast({
      text: ok ? t("Fresh off the press.") : t("Couldn’t refresh. Check your connection."),
    });
  };
  const pull = usePullToRefresh(page, refresh, busy || searching);
  const word = t(
    inFollowing ? "FOLLOWING" : topic === "top" ? "NEWS" : (TOPICS.find((x) => x.value === topic)?.label ?? "").toUpperCase(),
  );

  // Date is read on the client only, so server and client HTML match.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setStamp(dayStamp()), []);
  useEffect(() => {
    if (searching) searchRef.current?.focus();
  }, [searching]);

  const stories = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q
      ? feed.stories.filter((s) => s.title.toLowerCase().includes(q))
      : feed.stories;
  }, [feed.stories, query]);

  const heroes = query ? [] : stories.slice(0, 3);
  const rest = query ? stories : stories.slice(3);

  const cards = view === "cards";

  return (
    <main
      ref={page}
      className={
        cards
          ? "flex h-[calc(100dvh-env(safe-area-inset-top))] flex-col px-5 pt-1 pb-[calc(var(--above-tabs)-10px)]"
          : "px-5 pt-1 pb-[120px]"
      }
    >
      <TopBar />
      <div className="flex h-11 shrink-0 items-center justify-between">
        <div className="flex items-center gap-1.5">
          <button
            aria-label={t("Refresh news")}
            onClick={refresh}
            className="-m-2.5 flex size-[46px] items-center justify-center"
          >
            <span className="flex size-[26px] items-center justify-center rounded-md bg-news text-white">
              <Logo size={20} loop={busy} />
            </span>
          </button>
          <span className="label text-[12px] font-medium">{t("News")}</span>
        </div>
        <div className="flex items-center gap-1">
          <div
            role="tablist"
            aria-label={t("Layout")}
            className="flex rounded-full border border-ink/15 p-0.5"
          >
            {(["cards", "list"] as View[]).map((v) => (
              <button
                key={v}
                role="tab"
                aria-selected={view === v}
                onClick={() => setView(v)}
                aria-label={v === "cards" ? t("Cards") : t("List")}
                className={`flex h-7 w-9 items-center justify-center rounded-full ${view === v ? "bg-ink text-on-ink" : ""}`}
              >
                {v === "cards" ? <CardsIcon size={16} /> : <ListViewIcon size={16} />}
              </button>
            ))}
          </div>
          <button
            aria-label={t("Today’s paper")}
            onClick={() => setPapers(true)}
            className="flex size-11 items-center justify-center"
          >
            <NewspaperIcon size={20} />
          </button>
          <button
            aria-label={t("Your news: follow and mute")}
            onClick={() => setTuning(true)}
            className="flex size-11 items-center justify-center"
          >
            <FilterIcon size={20} />
          </button>
          <button
            aria-label={searching ? t("Close search") : t("Search")}
            onClick={() => {
              setSearching((s) => !s);
              setQuery("");
            }}
            className="-mr-2 flex size-11 items-center justify-center"
          >
            {searching ? <CloseIcon size={22} /> : <SearchIcon size={22} />}
          </button>
        </div>
      </div>

      {searching ? (
        <label className="mt-2.5 flex h-[46px] items-center gap-2.5 rounded-full border border-ink/12 bg-card px-4">
          <SearchIcon size={18} className="text-muted" />
          <input
            ref={searchRef}
            aria-label={t("Search headlines")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("Search today's headlines")}
            className="min-w-0 grow bg-transparent text-[14px] outline-none"
          />
          {query.trim().length >= 2 && !follows.some((f) => f.toLowerCase() === query.trim().toLowerCase()) && (
            <button
              onClick={() => {
                addPref("follows", query);
                toast({ text: t("Following “{q}”. Its stories are under Following.", { q: query.trim() }) });
              }}
              className="label -mr-1.5 flex h-8 shrink-0 items-center gap-1 rounded-full bg-ink px-3 text-[10px] text-on-ink"
            >
              <StarIcon size={12} /> {t("Follow")}
            </button>
          )}
        </label>
      ) : cards ? (
        <div className="mt-1.5 flex shrink-0 items-end justify-between">
          <h1 className="display text-[40px] leading-[0.9] tracking-[-0.03em]">
            {t("{word} TODAY", { word })}
          </h1>
          <span className="label text-right text-[10px] leading-normal">
            {stamp ? `${stamp.day} ${stamp.date}` : ""}
            {feed.updatedAt && (
              <span className={`block ${feed.offline ? "text-music-text" : "text-muted"}`}>
                {feed.offline ? t("Offline · saved") : t("Updated")} {time12(feed.updatedAt)}
              </span>
            )}
          </span>
        </div>
      ) : (
        <div className="mt-2.5 flex items-end justify-between">
          <h1
            className={`display leading-[0.85] tracking-[-0.03em] ${word.length > 7 ? "text-[46px]" : "text-[64px]"}`}
          >
            {hindi ? t("TODAY") : word}
            <br />
            {hindi ? word : t("TODAY")}
          </h1>
          <span className="label text-right text-[10px] leading-normal">
            {stamp?.day}
            <br />
            {stamp?.date}
            {feed.updatedAt && (
              <span className={`block ${feed.offline ? "text-music-text" : "text-muted"}`}>
                {feed.offline ? t("Offline · saved") : t("Updated")} {time12(feed.updatedAt)}
              </span>
            )}
          </span>
        </div>
      )}

      <div className={cards ? "mt-3 mb-3 shrink-0" : "mt-4"}>
        <Chips
          label={t("Topic")}
          options={chips}
          value={inFollowing ? "following" : topic}
          onChange={(v) => {
            setFollowing(v === "following");
            if (v !== "following") setTopic(v);
          }}
        />
      </div>

      {topic === "mine" && !inFollowing && feeds.length > 0 && (
        <div className={`flex items-center justify-between ${cards ? "-mt-1 mb-2 shrink-0" : "mt-3"}`}>
          <span className="label truncate text-[10px] text-muted">
            {t(feeds.length === 1 ? "{n} feed" : "{n} feeds", { n: feeds.length })} · {feeds.map((f) => f.title).join(", ")}
          </span>
          <button onClick={() => setManaging(true)} className="label shrink-0 pl-3 text-[10px] underline">
            {t("Manage")}
          </button>
        </div>
      )}

      {noFeeds ? (
        <div className="flex grow flex-col items-center justify-center gap-3 py-12 text-center">
          <span className="flex size-16 items-center justify-center rounded-full bg-news-tint text-news-deep">
            <RssIcon size={30} />
          </span>
          <p className="text-[19px] font-bold">{t("Build your own front page.")}</p>
          <p className="max-w-[300px] text-[14px] leading-relaxed text-muted">
            {t("Follow any blog, magazine or site with an RSS feed. Their stories show up here.")}
          </p>
          <button
            onClick={() => setManaging(true)}
            className="mt-2 flex h-12 items-center gap-2 rounded-full bg-ink px-6 text-[15px] font-semibold text-on-ink"
          >
            <PlusIcon size={16} /> {t("Add a feed")}
          </button>
        </div>
      ) : (
        <>

      {cards && (
        <>
          {feed.status === "loading" && (
            <div
              aria-hidden
              className="grow animate-pulse rounded-3xl bg-rule"
            />
          )}
          {feed.status === "error" && (
            <p className="py-10 text-center text-[14px] text-muted">
              {t("Couldn’t reach the news sources. Check your connection and try again.")}
            </p>
          )}
          {feed.status === "ok" && stories.length === 0 && (
            <p className="py-10 text-center text-[14px] text-muted">
              {inFollowing && !query ? t("Nothing today about what you follow.") : t("Nothing on that. Try another word.")}
            </p>
          )}
          {stories.length > 0 && <NewsCards stories={stories} />}
        </>
      )}

      {!cards && heroes.length > 0 && (
        <div className="no-scrollbar -mx-5 mt-[18px] flex snap-x snap-mandatory gap-3 overflow-x-auto px-5">
          {heroes.map((s) => (
            <div key={s.id} className="relative w-[82%] shrink-0 snap-start">
              <HeroStory story={s} onShare={setSharing} />
            </div>
          ))}
        </div>
      )}

      {!cards && (
        <>
          <div className="mt-[22px] flex items-baseline justify-between">
            <h2 className="text-[19px] font-bold">
              {query ? t("Results for “{q}”", { q: query }) : topic === "video" ? t("Latest videos") : t("Today’s posts")}
            </h2>
            <span className="label truncate pl-3 text-[10px] text-muted">
              {[...new Set(feed.stories.map((s) => s.source))]
                .slice(0, 3)
                .join(" · ")}
            </span>
          </div>

          <div className="mt-1">
            {feed.status === "loading" && <StorySkeleton rows={5} />}
            {feed.status === "error" && (
              <p className="py-10 text-center text-[14px] text-muted">
                {t("Couldn’t reach the news sources. Check your connection and try again.")}
              </p>
            )}
            {feed.status === "ok" && rest.length === 0 && (
              <p className="py-10 text-center text-[14px] text-muted">
                {inFollowing && !query ? t("Nothing today about what you follow.") : t("Nothing on that. Try another word.")}
              </p>
            )}
            {rest.map((s, i) => (
              <StoryRow key={s.id} story={s} index={i} onShare={setSharing} />
            ))}
          </div>
        </>
      )}

        </>
      )}

      <QuoteCardSheet card={sharing ? storyCard(sharing) : null} onClose={() => setSharing(null)} />
      <NewsPrefsSheet
        open={tuning}
        onClose={() => setTuning(false)}
        sources={[...new Set(news.stories.concat(followedNews.all).map((s) => s.source))].sort()}
      />
      <PapersSheet open={papers} onClose={() => setPapers(false)} />
      <FeedsSheet open={managing} onClose={() => setManaging(false)} onChange={() => topic === "mine" && news.refresh()} />
      <RefreshLogo pull={pull} busy={busy} />
      <TabBar add={topic === "mine" && !inFollowing ? { label: "Add a feed", onClick: () => setManaging(true) } : undefined} />
    </main>
  );
}
