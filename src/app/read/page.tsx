"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { BackIcon, BookmarkIcon, ClockIcon, ExternalIcon, ShareIcon } from "@/components/icons";
import { useFocus } from "@/components/focus-provider";
import { useAiExplain } from "@/components/ai-explain";
import { SelectionToolbar } from "@/components/selection-toolbar";
import { QuoteNoteSheet } from "@/components/quote-note-sheet";
import { WordSheet } from "@/components/word-sheet";
import { QuoteCardSheet } from "@/components/quote-card-sheet";
import { storyCard, wordCard, type CardText } from "@/lib/quote-card";
import { AiSummary } from "@/components/ai-summary";
import { useToast } from "@/components/toast";
import { addNote, getNotes, getSaved, toggleSaved } from "@/lib/db";
import { useStore } from "@/lib/use-store";
import { paintHighlights } from "@/lib/highlights";
import { safeImage } from "@/lib/use-news";
import { loadArticle } from "@/lib/platform";
import { markArticleRead, useReadingTimer } from "@/lib/reading";
import { cacheArticle, forgetArticle, getOfflineIndex } from "@/lib/offline";
import { CheckCircleIcon, DownloadIcon } from "@/components/stack-icons";
import { newsTime } from "@/lib/format";
import { ListenButton } from "@/components/listen-button";
import { LANGS, langName, translateArticle, type Lang, type Translated } from "@/lib/translate";
import type { Article } from "@/lib/article";
import { ensureSampleHighlight, SAMPLE_ID, SAMPLE_LINES } from "@/lib/sample";
import { inWelcome, setWelcomeStep } from "@/lib/welcome";
import type { Story } from "@/lib/news";
import { dateLocale, useT } from "@/lib/i18n";


const SOURCE_COLOR: Record<string, string> = {
  "Hacker News": "#F26522",
  "dev.to": "#3B49DF",
  BBC: "#B80000",
  "The Hindu": "#1D3F74",
  "Times of India": "#D12E27",
  "Indian Express": "#0F4C81",
  "Al Jazeera": "#C6982C",
  Mint: "#F58220",
  "The Guardian": "#052962",
};

function stampOf(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  const date = d.toLocaleDateString(dateLocale()).replace(/\//g, ".");
  const time = d.toLocaleTimeString(dateLocale(), { hour: "2-digit", minute: "2-digit" });
  return `${date} · ${time}`;
}

export default function Page() {
  // useSearchParams needs a Suspense boundary.
  return (
    <Suspense>
      <Reader />
    </Suspense>
  );
}

function Reader() {
  const t = useT();
  const params = useSearchParams();
  const id = params.get("id") ?? "";
  const sample = id === SAMPLE_ID;
  const router = useRouter();
  const { session: focus } = useFocus();
  const toast = useToast();
  const bodyRef = useRef<HTMLDivElement>(null);
  const [article, setArticle] = useState<(Article & { offlineAt?: number }) | null>(null);
  const [offline] = useStore(getOfflineIndex, {});
  const kept = !!offline[id]?.keep;
  const [failed, setFailed] = useState(false);
  const [noteQuote, setNoteQuote] = useState<string | null>(null);
  const [word, setWord] = useState<string | null>(null);
  const [sharing, setSharing] = useState<CardText | null>(null); // what the Share sheet is showing
  const [notes] = useStore(getNotes, []);
  const [shown, setShown] = useState<Translated | null>(null); // the article in another language
  const [translating, setTranslating] = useState<Lang | null>(null);
  const [saved] = useStore(getSaved, []);

  // The sample article always opens with its one ready-made highlight.
  useEffect(() => {
    if (sample) ensureSampleHighlight();
  }, [sample]);
  // First launch's "Try it" (welcome screen) continues from here.
  const [tour] = useState(() => params.get("tour") === "1" && inWelcome());
  const myLines = sample ? notes.filter((n) => n.articleId === SAMPLE_ID && n.quote && !SAMPLE_LINES.includes(n.quote)).length : 0;

  // Saved videos (Library, search) link here too; play them instead.
  useEffect(() => {
    if (id.startsWith("yt-")) router.replace(`/watch?v=${id.slice(3)}`);
  }, [id, router]);

  useEffect(() => {
    if (id.startsWith("yt-")) return;
    let alive = true;
    loadArticle(id)
      .then((a) => {
        if (!alive) return;
        if (a) setArticle(a);
        else setFailed(true);
      })
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [id]);

  // Re-draw this article's saved highlights whenever notes change.
  const quotes = notes.filter((n) => n.articleId === id && n.quote && !n.word).map((n) => n.quote!);
  const quotesKey = quotes.join("\u0000");
  useEffect(() => {
    if (!article?.html) return;
    paintHighlights("stack-article", bodyRef.current, quotes);
    return () => paintHighlights("stack-article", null, []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [article, quotesKey, shown]);

  // Reading stats: time on the page, and "read" once the end comes into view.
  useReadingTimer(!!article?.html);
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = endRef.current;
    if (!article?.html || !el) return;
    const seen = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) {
        markArticleRead(id);
        seen.disconnect();
      }
    });
    seen.observe(el);
    return () => seen.disconnect();
  }, [article, id]);

  const isSaved = saved.some((s) => s.id === id);
  // What the news list knew about this story (headline, image, summary).
  const [listed] = useState<Story | null>(() => {
    try {
      return JSON.parse(sessionStorage.getItem(`stack.story:${id}`) ?? "null");
    } catch {
      return null;
    }
  });
  const pageLoaded = !!article?.html || (article?.title && !/^(www\.)?[\w-]+(\.[\w-]+)+$/.test(article.title));
  const title = (pageLoaded ? article?.title : null) ?? listed?.title ?? article?.title;
  const html = shown?.html ?? article?.html;

  const translate = async (to: Lang) => {
    if (!article?.html) return;
    setTranslating(to);
    try {
      setShown(await translateArticle(id, title ?? article.title, article.html, to));
    } catch {
      toast({ text: t("Couldn’t translate right now. Check your connection and try again.") });
    } finally {
      setTranslating(null);
    }
  };
  const img = safeImage(article?.image ?? listed?.image);
  const [explain, explainSheet] = useAiExplain({ kind: "article", title, label: article?.source, href: `/read?id=${id}` });

  const save = async (quote: string, body?: string) => {
    if (!article) return;
    await addNote({
      kind: "article",
      quote,
      body: body || undefined,
      highlight: !body,
      sourceTitle: title ?? article.title,
      sourceLabel: article.source,
      articleId: id,
      href: `/read?id=${id}`,
    });
    toast({
      text: t("Saved to Notes with source link"),
      href: "/notes",
    });
  };

  const saveWord = async (w: string, meaning: string) => {
    if (!article) return;
    await addNote({
      kind: "article",
      word: true,
      quote: w,
      body: meaning,
      sourceTitle: title ?? article.title,
      sourceLabel: article.source,
      articleId: id,
      href: `/read?id=${id}`,
    });
    toast({ text: t("“{word}” saved to My words", { word: w }), href: "/notes" });
  };

  const bookmark = async () => {
    if (!article) return;
    const now = await toggleSaved({ id, title: title ?? article.title, source: article.source, image: img });
    // Saved articles stay readable offline.
    if (now && article.html) await cacheArticle(article, true);
    toast(now ? { text: t("Stacked. Read it anytime, even offline."), href: "/library" } : { text: t("Removed from saved") });
  };

  const download = async () => {
    if (!article?.html) return;
    if (kept) {
      await forgetArticle(id);
      toast({ text: t("Removed the offline copy") });
    } else {
      await cacheArticle(article, true);
      toast({ text: t("Downloaded · you can read this offline") });
    }
  };

  return (
    <main className="-mt-[env(safe-area-inset-top)] min-h-dvh bg-soft">
      {/* Dark header with the story's image behind it */}
      <header className="relative flex min-h-[330px] flex-col px-[max(20px,calc((100%-720px)/2))] pt-[calc(env(safe-area-inset-top)+20px)] pb-12 text-white">
        {img && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={img} alt="" className="absolute inset-0 size-full object-cover opacity-45" />
            <div className="absolute inset-0 bg-gradient-to-t from-soft via-soft/60 to-soft/20" />
          </>
        )}
        <div className="relative flex h-11 items-center justify-between">
          <button
            aria-label={t("Back")}
            onClick={() => (history.length > 1 ? router.back() : router.push("/news"))}
            className="-ml-2 flex size-11 items-center justify-center"
          >
            <BackIcon size={22} />
          </button>
          <div className="-mr-2 flex">
            {(!focus || focus.endedAt) && (
              <Link
                href={`/focus?kind=article&id=${encodeURIComponent(id)}&title=${encodeURIComponent(title ?? "")}`}
                aria-label={t("Start a focus session with this article")}
                className="flex size-11 items-center justify-center"
              >
                <ClockIcon size={20} />
              </Link>
            )}
            {article?.html && (
              <ListenButton
                title={title ?? article.title}
                source={article.source}
                getText={() => `${title ?? article.title}.\n\n${bodyRef.current?.innerText ?? ""}`}
              />
            )}
            {article?.html && (
              <button
                aria-label={kept ? t("Available offline (tap to remove)") : t("Download for offline")}
                aria-pressed={kept}
                onClick={download}
                className="flex size-11 items-center justify-center"
              >
                {kept ? <CheckCircleIcon size={20} /> : <DownloadIcon size={20} />}
              </button>
            )}
            {article && (
              <button
                aria-label={t("Share this story as a card")}
                onClick={() =>
                  setSharing(storyCard({ ...article, title: title ?? article.title, summary: listed?.summary, image: img }))
                }
                className="flex size-11 items-center justify-center"
              >
                <ShareIcon size={20} />
              </button>
            )}
            <button
              aria-label={isSaved ? t("Remove bookmark") : t("Bookmark")}
              aria-pressed={isSaved}
              onClick={bookmark}
              className="flex size-11 items-center justify-center"
            >
              <BookmarkIcon size={20} filled={isSaved} />
            </button>
          </div>
        </div>
        <div className="relative mt-auto pt-16">
          <span className="label text-[10px] text-[#BDBAB2]">
            {[stampOf(article?.createdAt), article?.readMinutes && t("{n} min read", { n: article.readMinutes })].filter(Boolean).join(" · ")}
          </span>
          <h1 className="mt-2.5 text-[25px] leading-[1.2] font-bold">
            {shown?.title ?? title ?? (failed ? t("Story not found") : t("Loading…"))}
          </h1>
          {article && (
            <div className="mt-3.5 flex items-center gap-2.5">
              <span className="size-7 rounded-md" style={{ background: SOURCE_COLOR[article.source] ?? "#6B6862" }} />
              <span className="label text-[10px]">
                {article.source}
                {article.author ? ` · ${article.author}` : ""}
              </span>
            </div>
          )}
        </div>
      </header>

      <div className="relative -mt-3 min-h-[60dvh] rounded-t-[26px] bg-paper px-[max(26px,calc((100%-720px)/2))] pt-9 pb-32">
        {article && !sample && (
          <a
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            className="label absolute -top-6 right-[max(22px,calc((100%-720px)/2))] flex h-12 items-center gap-2 rounded-full bg-news px-[22px] text-[11px] font-medium text-white shadow-[0_8px_20px_rgba(10,138,58,.35)]"
          >
            {t("Original")} <ExternalIcon size={14} />
          </a>
        )}

        {!article && !failed && (
          <div aria-hidden className="flex animate-pulse flex-col gap-3">
            {Array.from({ length: 8 }, (_, i) => (
              <div key={i} className="h-4 rounded bg-rule" style={{ width: `${70 + ((i * 37) % 30)}%` }} />
            ))}
          </div>
        )}

        {failed && listed?.url && (
          <div className="flex flex-col gap-4">
            {listed.summary && <p className="text-[17px] leading-relaxed">{listed.summary}</p>}
            <p className="text-[15px] text-muted">{t("This story can’t be shown in reader mode here.")}</p>
            <a
              href={listed.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-12 items-center justify-center gap-2 rounded-full bg-ink text-[15px] font-semibold text-on-ink"
            >
              {t("Read on {site}", { site: listed.domain ?? t("the site") })} <ExternalIcon size={15} />
            </a>
          </div>
        )}
        {failed && !listed?.url && (
          <p className="text-[15px] text-muted">
            {t("This story couldn’t be loaded.")}{" "}
            <Link href="/news" className="underline">
              {t("Back to news")}
            </Link>
          </p>
        )}

        {article && article.html === null && (
          <div className="flex flex-col gap-4">
            {listed?.summary && <p className="text-[17px] leading-relaxed">{listed.summary}</p>}
            <p className="text-[16px] leading-relaxed">
              {t("This page can’t be shown in reader mode (it may be an app, a video or a paywalled site).")}
            </p>
            <a
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-12 items-center justify-center gap-2 rounded-full bg-ink text-[15px] font-semibold text-on-ink"
            >
              {t("Open {site}", { site: new URL(article.url).hostname.replace(/^www\./, "") })} <ExternalIcon size={16} />
            </a>
          </div>
        )}

        {article?.html && (
          <>
            {!sample && <AiSummary id={id} title={title ?? article.title} html={article.html} source={article.source} />}
            {article.offlineAt && (
              <p className="label mb-3 rounded-xl bg-news-tint px-3.5 py-2.5 text-[10px] text-news-deep">
                {t("Offline copy · saved {when}", { when: newsTime(article.offlineAt) })}
              </p>
            )}
            <TranslateBar shown={shown?.lang ?? null} busy={translating} onPick={translate} onOriginal={() => setShown(null)} />
            {sample ? (
              <SampleCoach
                done={myLines > 0}
                tour={tour}
                onContinue={() => {
                  setWelcomeStep("profile");
                  router.replace("/welcome");
                }}
              />
            ) : (
              <p className="label mb-5 text-[10px] text-muted">{t("See a line you like? Select it to keep it.")}</p>
            )}
            <div
              ref={bodyRef}
              className="prose-stack"
              lang={shown?.lang}
              dir={shown && ["ur", "ar"].includes(shown.lang) ? "rtl" : undefined}
              // Sanitised on the server (see api/article/route.ts); a translation only swaps its text.
              dangerouslySetInnerHTML={{ __html: html ?? "" }}
            />
            <div ref={endRef} aria-hidden className="h-px" />
          </>
        )}
      </div>

      <SelectionToolbar
        container={bodyRef}
        accent="text-news-text"
        onExplain={explain}
        onHighlight={(text) => save(text)}
        onNote={(text) => setNoteQuote(text)}
        onMeaning={setWord}
        onShare={(text) => setSharing({ text, quoted: true, title: title ?? article?.title, label: article?.source })}
      />
      <QuoteCardSheet card={sharing} onClose={() => setSharing(null)} />
      {explainSheet}
      <WordSheet
        word={word}
        onClose={() => setWord(null)}
        onSave={(w, meaning) => {
          saveWord(w, meaning);
          setWord(null);
        }}
        onShare={(w, meaning) => {
          setWord(null);
          setSharing(wordCard(w, meaning, title ?? article?.title));
        }}
      />
      <QuoteNoteSheet
        quote={noteQuote}
        tint="bg-news-tint"
        onClose={() => setNoteQuote(null)}
        onSave={(body) => {
          if (noteQuote) save(noteQuote, body);
          setNoteQuote(null);
        }}
      />
    </main>
  );
}

// Read the story in Hindi with one tap, or in another major language.
function TranslateBar({
  shown,
  busy,
  onPick,
  onOriginal,
}: {
  shown: Lang | null;
  busy: Lang | null;
  onPick: (l: Lang) => void;
  onOriginal: () => void;
}) {
  const t = useT();
  const chip = "label flex h-8 shrink-0 items-center rounded-full px-3.5 text-[10px]";
  return (
    <div className="mb-4 flex items-center gap-2 overflow-x-auto">
      <span className="label shrink-0 text-[10px] text-muted">{busy ? t("Translating…") : t("Read in")}</span>
      {shown ? (
        <button onClick={onOriginal} className={`${chip} border border-rule`}>
          {t("English (original)")}
        </button>
      ) : (
        <button onClick={() => onPick("hi")} disabled={!!busy} className={`${chip} bg-news text-white`}>
          हिंदी
        </button>
      )}
      {shown && <span className={`${chip} bg-news text-white`}>{langName(shown)}</span>}
      <label className={`${chip} relative border border-rule`}>
        {shown ? t("Other language") : t("More languages")} ▾
        <select
          aria-label={t("Translate into")}
          value=""
          disabled={!!busy}
          onChange={(e) => e.target.value && onPick(e.target.value as Lang)}
          className="absolute inset-0 cursor-pointer opacity-0"
        >
          <option value="">{t("Translate into…")}</option>
          {(Object.keys(LANGS) as Lang[]).map((l) => (
            <option key={l} value={l}>
              {LANGS[l]}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

// The sample article's coach: highlight one more line, then see where it goes.
function SampleCoach({ done, tour, onContinue }: { done: boolean; tour: boolean; onContinue: () => void }) {
  const t = useT();
  if (!done) {
    return (
      <p className="mb-5 rounded-2xl bg-news-tint px-4 py-3 text-[14px] leading-relaxed text-news-deep">
        {t("One line is already highlighted.")} <b>{t("Select another line you like and tap Highlight.")}</b>
      </p>
    );
  }
  return (
    <div className="mb-5 flex flex-col gap-3 rounded-2xl bg-ink px-4 py-4 text-on-ink">
      <span className="label text-[10px] text-news-tint">{t("Save → Highlight → Remember")}</span>
      <p className="font-serif text-[20px] leading-snug italic">
        {t("That’s a note. Tomorrow morning, both lines come back in your daily review.")}
      </p>
      {tour ? (
        <button onClick={onContinue} className="h-12 rounded-full bg-on-ink text-[15px] font-semibold text-ink">
          {t("Continue")}
        </button>
      ) : (
        <Link href="/notes" className="flex h-12 items-center justify-center rounded-full bg-on-ink text-[15px] font-semibold text-ink">
          {t("See it in Notes")}
        </Link>
      )}
    </div>
  );
}
