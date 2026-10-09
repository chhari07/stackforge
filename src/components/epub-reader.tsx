"use client";

// The reader for EPUB books (lib/epub.ts). One chapter is on screen at a
// time and counts as a "page": bookmarks, notes, highlights, search and
// progress work the way they do in the PDF reader.
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BookmarkIcon, ChevronLeft, ChevronRight, SearchIcon } from "@/components/icons";
import { FindSheet, type FindSource } from "@/components/book-find";
import { ListenButton } from "@/components/listen-button";
import { BookmarkSheet, Ribbon, patchPdf } from "@/components/pdf-extras";
import { QuoteCardSheet } from "@/components/quote-card-sheet";
import { QuoteNoteSheet } from "@/components/quote-note-sheet";
import { useAiExplain } from "@/components/ai-explain";
import { SelectionToolbar } from "@/components/selection-toolbar";
import { TextSizeIcon } from "@/components/stack-icons";
import { useToast } from "@/components/toast";
import { WordSheet } from "@/components/word-sheet";
import { addNote, getNotes, getPdf, updatePdf, type PdfMeta } from "@/lib/db";
import { chapterHtml, chapterText, openEpub, type Epub } from "@/lib/epub";
import { findRange, paintHighlights } from "@/lib/highlights";
import { wordCard, type CardText } from "@/lib/quote-card";
import { markPageRead, useReadingTimer } from "@/lib/reading";
import { useStore } from "@/lib/use-store";
import { useT } from "@/lib/i18n";

const SIZES = [16, 18, 20, 23];
const SIZE_KEY = "stack.book-size";
const PLACE_KEY = "stack.book-place"; // how far down the chapter you were, per book

type Place = Record<string, { page: number; at: number }>;
const places = (): Place => {
  try {
    return JSON.parse(localStorage.getItem(PLACE_KEY) ?? "{}");
  } catch {
    return {};
  }
};

export function EpubReader({ id, startPage }: { id: string; startPage: number }) {
  const t = useT();
  const toast = useToast();

  const [meta, setMeta] = useState<PdfMeta | null>(null);
  const [book, setBook] = useState<Epub | null>(null);
  const [missing, setMissing] = useState(false);
  const [page, setPage] = useState(1);
  const [shown, setShown] = useState<{ page: number; html: string } | null>(null);
  const [size, setSize] = useState(1); // index into SIZES
  const [panel, setPanel] = useState<"bookmarks" | "find" | null>(null);
  const [found, setFound] = useState<string | null>(null); // words from a search, marked in the chapter
  const [noteQuote, setNoteQuote] = useState<string | null>(null);
  const [word, setWord] = useState<string | null>(null);
  const [explain, explainSheet] = useAiExplain({ kind: "pdf", title: meta?.title, label: `EPUB · ${t("ch. {n}", { n: page })}`, href: `/library/read?id=${id}&page=${page}` });
  const [sharing, setSharing] = useState<CardText | null>(null);
  const [notes] = useStore(getNotes, []);
  const bodyRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const jump = useRef<string | null>(null); // an anchor to scroll to once the chapter is in

  useEffect(() => {
    try {
      const s = Number(localStorage.getItem(SIZE_KEY));
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (s >= 0 && s < SIZES.length && localStorage.getItem(SIZE_KEY) !== null) setSize(s);
    } catch {}
  }, []);

  // Load the file from IndexedDB and open it.
  useEffect(() => {
    let alive = true;
    getPdf(id)
      .then(async (got) => {
        if (!got) return alive && setMissing(true);
        const b = await openEpub(await got.blob.arrayBuffer());
        if (!alive) return;
        setMeta(got.meta);
        setPage(Math.min(Math.max(1, startPage || got.meta.lastPage), b.chapters.length));
        setBook(b);
        updatePdf(id, { lastOpenedAt: Date.now() });
      })
      .catch(() => alive && setMissing(true));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // The chapter on screen.
  useEffect(() => {
    if (!book) return;
    let alive = true;
    chapterHtml(book, page)
      .catch(() => `<p>${t("This chapter couldn’t be opened.")}</p>`)
      .then((html) => alive && setShown({ page, html }));
    return () => {
      alive = false;
    };
  }, [book, page, t]);

  // Once a chapter is in: go to the link's anchor, the search match, or where you left off.
  useEffect(() => {
    if (!shown || shown.page !== page) return;
    const body = bodyRef.current;
    const anchor = jump.current && body?.querySelector(`#${CSS.escape(jump.current)}`);
    jump.current = null;
    const match = found && body ? findRange(body, found) : null;
    if (anchor) anchor.scrollIntoView({ block: "start" });
    else if (match) window.scrollTo({ top: window.scrollY + match.getBoundingClientRect().top - window.innerHeight / 3 });
    else {
      const left = places()[id];
      const top = left?.page === page ? left.at * (document.documentElement.scrollHeight - window.innerHeight) : 0;
      window.scrollTo({ top });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shown]);

  // Remember the chapter, and how far down it you are.
  useEffect(() => {
    if (!meta) return;
    const t = setTimeout(() => updatePdf(id, { lastPage: page }), 400);
    return () => clearTimeout(t);
  }, [id, page, meta]);
  useEffect(() => {
    if (!shown) return;
    let t: ReturnType<typeof setTimeout>;
    const onScroll = () => {
      clearTimeout(t);
      t = setTimeout(() => {
        const room = document.documentElement.scrollHeight - window.innerHeight;
        try {
          localStorage.setItem(PLACE_KEY, JSON.stringify({ ...places(), [id]: { page: shown.page, at: room > 0 ? window.scrollY / room : 0 } }));
        } catch {}
      }, 500);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      clearTimeout(t);
      window.removeEventListener("scroll", onScroll);
    };
  }, [id, shown]);

  // Reading stats: time in the book, and a chapter counts as read at its end.
  useReadingTimer(!!shown);
  useEffect(() => {
    const el = endRef.current;
    if (!shown || !el) return;
    const seen = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) {
        markPageRead(id, shown.page);
        seen.disconnect();
      }
    });
    seen.observe(el);
    return () => seen.disconnect();
  }, [id, shown]);

  // Saved highlights, and what a search found.
  const pageNotes = notes.filter((n) => n.pdfId === id && n.page === page);
  const quotesKey = pageNotes.map((n) => (n.word ? "" : n.quote)).join("\u0000");
  useEffect(() => {
    paintHighlights(
      "stack-pdf",
      bodyRef.current,
      pageNotes.filter((n) => n.quote && !n.word).map((n) => n.quote!),
    );
    return () => paintHighlights("stack-pdf", null, []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shown, quotesKey]);
  useEffect(() => {
    paintHighlights("stack-find", found ? bodyRef.current : null, found ? [found] : []);
    return () => paintHighlights("stack-find", null, []);
  }, [shown, found]);

  const total = book?.chapters.length ?? meta?.pages ?? 1;
  const go = useCallback(
    (to: number, anchor?: string) => {
      jump.current = anchor ?? null;
      setFound(null);
      setPage(Math.min(Math.max(1, to), total));
    },
    [total],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest("input, textarea, dialog")) return;
      if (e.key === "ArrowRight") go(page + 1);
      if (e.key === "ArrowLeft") go(page - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, page]);

  const findSource = useMemo<FindSource | null>(
    () =>
      book && {
        pages: book.chapters.length,
        unit: "ch.",
        pageText: (p) => chapterText(book, p),
        outline: async () => book.toc,
      },
    [book],
  );

  const keep = async (quote: string, extra: { body?: string; word?: boolean }) => {
    if (!meta) return;
    await addNote({
      kind: "pdf",
      quote,
      body: extra.body || undefined,
      word: extra.word,
      highlight: !extra.body && !extra.word,
      sourceTitle: meta.title,
      sourceLabel: "EPUB",
      pdfId: id,
      page,
      href: `/library/read?id=${id}&page=${page}`,
    });
    toast(
      extra.word
        ? { text: t("“{word}” saved to My words", { word: quote }), href: "/notes" }
        : { text: t("Saved to Notes · ch. {n}", { n: page }), href: "/notes" },
    );
  };

  // Links inside the book turn to their chapter; web links open outside Stack.
  const onLink = (e: React.MouseEvent) => {
    const a = (e.target as HTMLElement).closest("a");
    if (!a) return;
    e.preventDefault();
    const ch = Number(a.getAttribute("data-ch"));
    const href = a.getAttribute("href");
    if (ch) go(ch, a.getAttribute("data-at") ?? undefined);
    else if (href && /^https?:/i.test(href)) window.open(href, "_blank", "noopener,noreferrer");
  };

  if (missing) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-8 text-center">
        <p className="font-serif text-[24px] italic">{t("This book isn’t on this device.")}</p>
        <Link href="/library" className="label rounded-full bg-ink px-5 py-3 text-[11px] text-on-ink">
          {t("Back to Library")}
        </Link>
      </main>
    );
  }

  const marked = !!meta?.bookmarks?.some((b) => b.page === page);
  const chapter = book?.chapters[page - 1]?.title;
  const ready = shown?.page === page;
  const turn = "label flex h-11 items-center gap-1 rounded-full border border-ink/15 px-4 text-[10px] disabled:opacity-30";

  return (
    <main className="min-h-dvh bg-paper pb-28">
      <div className="sticky top-0 z-20 -mt-[env(safe-area-inset-top)] bg-paper px-[max(20px,calc((100%-760px)/2))] pt-[calc(env(safe-area-inset-top)+20px)]">
        <div className="flex h-11 items-center gap-1">
          <Link href="/library" aria-label={t("Back to library")} className="-ml-2 flex size-11 items-center justify-center">
            <ChevronLeft size={22} />
          </Link>
          <span className="label grow truncate text-center text-[10px]">
            {meta?.title ?? t("Loading…")} · {t("ch. {n}", { n: page })}
          </span>
          {meta && book && (
            <ListenButton
              label={t("Listen to this chapter")}
              title={`${meta.title} · ch. ${page}`}
              source="Book"
              getText={() => chapterText(book, page)}
            />
          )}
          <button
            aria-label={t("Text size")}
            onClick={() => {
              const next = (size + 1) % SIZES.length;
              setSize(next);
              try {
                localStorage.setItem(SIZE_KEY, String(next));
              } catch {}
            }}
            className="flex size-11 items-center justify-center"
          >
            <TextSizeIcon size={21} />
          </button>
          <button aria-label={t("Search, contents and go to chapter")} onClick={() => setPanel("find")} className="flex size-11 items-center justify-center">
            <SearchIcon size={20} />
          </button>
          <button aria-label={t("Bookmarks")} onClick={() => setPanel("bookmarks")} className="flex size-11 items-center justify-center">
            <BookmarkIcon size={20} filled={marked} />
          </button>
        </div>
        <div className="mt-1.5 h-0.5 bg-rule">
          <div className="h-0.5 bg-ink transition-[width]" style={{ width: `${(page / total) * 100}%` }} />
        </div>
      </div>

      <div className="relative mx-auto mt-5 max-w-[760px] px-[26px]">
        {marked && <Ribbon key={page} onClick={() => setPanel("bookmarks")} />}
        {chapter && <p className="label mb-4 text-[10px] text-muted">{chapter}</p>}
        {!ready && (
          <div aria-hidden className="flex animate-pulse flex-col gap-3">
            {Array.from({ length: 8 }, (_, i) => (
              <div key={i} className="h-4 rounded bg-rule" style={{ width: `${70 + ((i * 37) % 30)}%` }} />
            ))}
          </div>
        )}
        {ready && (
          <div
            ref={bodyRef}
            onClick={onLink}
            className="prose-stack book font-serif"
            style={{ fontSize: SIZES[size] }}
            // Cleaned in lib/epub.ts: no scripts, styles or outside pictures.
            dangerouslySetInnerHTML={{ __html: shown.html }}
          />
        )}
        <div ref={endRef} aria-hidden className="h-px" />
      </div>

      <div className="mx-auto mt-8 flex max-w-[760px] items-center justify-between px-5">
        <button onClick={() => go(page - 1)} disabled={page <= 1} className={turn}>
          <ChevronLeft size={14} /> {t("Prev")}
        </button>
        <button
          onClick={() => setPanel("find")}
          aria-label={t("Chapter {n} of {total}. Search, contents and go to chapter", { n: page, total })}
          className={turn}
        >
          <SearchIcon size={14} /> {page} / {total}
        </button>
        <button onClick={() => go(page + 1)} disabled={page >= total} className={turn}>
          {t("Next")} <ChevronRight size={14} />
        </button>
      </div>

      {meta && (
        <BookmarkSheet
          open={panel === "bookmarks"}
          onClose={() => setPanel(null)}
          bookmarks={meta.bookmarks ?? []}
          onChange={(bookmarks) => patchPdf(meta, { bookmarks }, setMeta)}
          page={page}
          onPage={go}
          unit="ch."
        />
      )}
      <FindSheet
        open={panel === "find"}
        onClose={() => setPanel(null)}
        source={findSource}
        page={page}
        onPage={(p) => {
          jump.current = null;
          if (p === page) setShown((s) => s && { ...s }); // same chapter: scroll to the match
          else setPage(p);
        }}
        onFound={setFound}
      />

      <SelectionToolbar
        container={bodyRef}
        accent="text-pdf-deep"
        onExplain={explain}
        onHighlight={(t) => keep(t, {})}
        onNote={(t) => setNoteQuote(t)}
        onMeaning={setWord}
        onShare={(text) => setSharing({ text, quoted: true, title: meta?.title, label: `EPUB · ${t("ch. {n}", { n: page })}` })}
      />
      <QuoteCardSheet card={sharing} onClose={() => setSharing(null)} />
      {explainSheet}
      <WordSheet
        word={word}
        onClose={() => setWord(null)}
        onSave={(w, meaning) => {
          keep(w, { body: meaning, word: true });
          setWord(null);
        }}
        onShare={(w, meaning) => {
          setWord(null);
          setSharing(wordCard(w, meaning, meta?.title));
        }}
      />
      <QuoteNoteSheet
        quote={noteQuote}
        tint="bg-pdf-tint"
        onClose={() => setNoteQuote(null)}
        onSave={(body) => {
          if (noteQuote) keep(noteQuote, { body });
          setNoteQuote(null);
        }}
      />
    </main>
  );
}
