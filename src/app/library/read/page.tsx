"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist/legacy/build/pdf.mjs";
import { ChevronLeft, ChevronRight, ClockIcon, NoteIcon, PauseIcon, PlayIcon, SearchIcon } from "@/components/icons";
import { FindSheet, type FindSource } from "@/components/book-find";
import { useAiExplain } from "@/components/ai-explain";
import { SelectionToolbar } from "@/components/selection-toolbar";
import { QuoteNoteSheet } from "@/components/quote-note-sheet";
import { WordSheet } from "@/components/word-sheet";
import { QuoteCardSheet } from "@/components/quote-card-sheet";
import { wordCard, type CardText } from "@/lib/quote-card";
import { useNowPlaying } from "@/components/now-playing";
import { useFocus, useTick } from "@/components/focus-provider";
import { clockText, remainingMs } from "@/lib/focus";
import { useToast } from "@/components/toast";
import { addNote, getNotes, getPdf, getPdfs, updatePdf, type Note, type PdfMeta } from "@/lib/db";
import { EpubReader } from "@/components/epub-reader";
import { useStore } from "@/lib/use-store";
import { openPdf, pdfOutline, pdfPageText, pdfjs } from "@/lib/pdf";
import { markPageRead, useReadingTimer } from "@/lib/reading";
import { ListenButton } from "@/components/listen-button";
import { paintHighlights } from "@/lib/highlights";
import { clock } from "@/lib/format";
import { ContrastIcon, NoteAddIcon } from "@/components/stack-icons";
import { BookmarkIcon } from "@/components/icons";
import { BookmarkSheet, Ribbon, Stickies, StickySheet, ViewSheet, pageFilter, patchPdf } from "@/components/pdf-extras";
import { AiPdfButton } from "@/components/ai-pdf-chat";
import { InkLayer, InkPad, InkToolbar, PenIcon, useInk, usePen } from "@/components/ink";
import type { Stroke } from "@/lib/ink";
import { useT } from "@/lib/i18n";

const MIN_PER_PAGE = 1.5; // rough reading pace for the "time left" pill

export default function Page() {
  // useSearchParams needs a Suspense boundary.
  return (
    <Suspense>
      <Reader />
    </Suspense>
  );
}

// PDFs and EPUB books share this address; which reader opens depends on the file.
function Reader() {
  const params = useSearchParams();
  const id = params.get("id") ?? "";
  const [format, setFormat] = useState<"pdf" | "epub" | null>(null);
  useEffect(() => {
    let alive = true;
    getPdfs().then((all) => alive && setFormat(all.find((p) => p.id === id)?.format ?? "pdf"));
    return () => {
      alive = false;
    };
  }, [id]);
  if (!format) return null;
  return format === "epub" ? <EpubReader key={id} id={id} startPage={Number(params.get("page")) || 0} /> : <PdfReader />;
}

function PdfReader() {
  const t = useT();
  const params = useSearchParams();
  const id = params.get("id") ?? "";
  const startPage = Number(params.get("page")) || 0;
  const now = useNowPlaying();
  const { session: focus } = useFocus();
  const focusing = !!focus && !focus.endedAt;
  const tick = useTick(focusing && !focus?.pausedAt);
  const toast = useToast();

  const [meta, setMeta] = useState<PdfMeta | null>(null);
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [missing, setMissing] = useState(false);
  const [page, setPage] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [rendered, setRendered] = useState(0); // bumps after each page paint
  const [noteQuote, setNoteQuote] = useState<string | null>(null);
  const [word, setWord] = useState<string | null>(null);
  const [explain, explainSheet] = useAiExplain({ kind: "pdf", title: meta?.title, label: `PDF · ${t("p. {n}", { n: page })}`, href: `/library/read?id=${id}&page=${page}` });
  const [sharing, setSharing] = useState<CardText | null>(null); // what the Share sheet is showing
  const [notes] = useStore(getNotes, []);
  const [size, setSize] = useState({ w: 0, h: 0 }); // the painted page, in CSS pixels
  const [panel, setPanel] = useState<"view" | "bookmarks" | "sticky" | "find" | null>(null);
  const [found, setFound] = useState<string | null>(null); // words from a search, marked on the page
  const [editing, setEditing] = useState<Note | null>(null); // the sticky being changed
  const [showStickies, setShowStickies] = useState(true);
  const [drawing, setDrawing] = useState(false); // handwriting on the page (components/ink.tsx)
  const [pen, setPen] = usePen();

  // This page's handwriting, saved with the PDF (meta.ink, by page number).
  const ink = useInk(
    meta?.ink?.[page] ?? [],
    (strokes: Stroke[]) =>
      setMeta((m) => {
        if (!m) return m;
        const all = { ...m.ink };
        if (strokes.length) all[page] = strokes;
        else delete all[page];
        updatePdf(m.id, { ink: all });
        return { ...m, ink: all };
      }),
    `${id}:${page}:${!!meta}`,
  );

  const wrap = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const sheet = useRef<HTMLDivElement>(null); // the page itself: it follows the finger

  // Load the file from IndexedDB and open it with pdf.js.
  useEffect(() => {
    let alive = true;
    let opened: PDFDocumentProxy | null = null;
    getPdf(id).then(async (found) => {
      if (!found) return alive && setMissing(true);
      const d = await openPdf(await found.blob.arrayBuffer());
      if (!alive) return d.loadingTask.destroy();
      opened = d;
      setMeta(found.meta);
      setPage(Math.min(Math.max(1, startPage || found.meta.lastPage), d.numPages));
      setDoc(d);
      updatePdf(id, { lastOpenedAt: Date.now() });
    });
    return () => {
      alive = false;
      opened?.loadingTask.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Paint the current page: canvas for the image, text layer for selection.
  useEffect(() => {
    if (!doc || !wrap.current || !canvasRef.current || !textRef.current) return;
    let task: RenderTask | null = null;
    let cancelled = false;
    (async () => {
      const { TextLayer } = await pdfjs();
      const p = await doc.getPage(page);
      if (cancelled) return;
      const width = wrap.current!.clientWidth * zoom;
      const base = p.getViewport({ scale: 1 });
      const viewport = p.getViewport({ scale: width / base.width });
      const ratio = window.devicePixelRatio || 1;

      const canvas = canvasRef.current!;
      canvas.width = Math.floor(viewport.width * ratio);
      canvas.height = Math.floor(viewport.height * ratio);
      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;
      task = p.render({
        canvas,
        viewport,
        transform: ratio !== 1 ? [ratio, 0, 0, ratio, 0, 0] : undefined,
      });
      await task.promise.catch(() => {});
      if (cancelled) return;
      setSize({ w: viewport.width, h: viewport.height });

      const layer = textRef.current!;
      layer.replaceChildren();
      layer.style.setProperty("--total-scale-factor", String(viewport.scale));
      const text = new TextLayer({
        textContentSource: p.streamTextContent(),
        container: layer,
        viewport,
      });
      await text.render();
      if (!cancelled) setRendered((r) => r + 1);
    })();
    return () => {
      cancelled = true;
      task?.cancel();
    };
  }, [doc, page, zoom]);

  // Reading stats: time in the PDF, and a page counts as read after 8 seconds on it.
  useReadingTimer(!!doc);
  useEffect(() => {
    if (!doc) return;
    const t = setTimeout(() => markPageRead(id, page), 8000);
    return () => clearTimeout(t);
  }, [doc, id, page]);

  // Remember where the reader is.
  useEffect(() => {
    if (!meta) return;
    const t = setTimeout(() => updatePdf(id, { lastPage: page }), 400);
    return () => clearTimeout(t);
  }, [id, page, meta]);

  const pageNotes = notes.filter((n) => n.pdfId === id && n.page === page);
  const quotesKey = pageNotes.map((n) => (n.word ? "" : n.quote)).join("\u0000");
  useEffect(() => {
    paintHighlights(
      "stack-pdf",
      textRef.current,
      pageNotes.filter((n) => n.quote && !n.word).map((n) => n.quote!),
    );
    return () => paintHighlights("stack-pdf", null, []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rendered, quotesKey]);

  // What a search found is marked on the page it was found on.
  useEffect(() => {
    paintHighlights("stack-find", found ? textRef.current : null, found ? [found] : []);
    return () => paintHighlights("stack-find", null, []);
  }, [rendered, found]);

  // Search, contents and "go to page" (components/book-find.tsx).
  const findSource = useMemo<FindSource | null>(
    () =>
      doc && {
        pages: doc.numPages,
        unit: "p.",
        pageText: (p) => pdfPageText(doc, p),
        outline: () => pdfOutline(doc),
      },
    [doc],
  );

  const total = doc?.numPages ?? meta?.pages ?? 1;
  const go = useCallback(
    (delta: number) => {
      setPage((p) => Math.min(Math.max(1, p + delta), total));
      window.scrollTo({ top: 0 });
    },
    [total],
  );

  // Swipe the page left or right to turn it, like a book. The page follows the
  // finger and turns once it's dragged far enough; a short or mostly vertical
  // drag is left to scrolling, and selecting text never turns the page.
  // Zoomed in, a swipe first pans across the page and turns it only from the edge.
  useEffect(() => {
    const el = sheet.current;
    const box = wrap.current;
    if (!el || !box || !doc || drawing) return;
    let start: { x: number; y: number; atLeft: boolean; atRight: boolean } | null = null;
    let axis: "x" | "y" | null = null;
    const selecting = () => window.getSelection()?.isCollapsed === false;
    const settle = (animate: boolean) => {
      el.style.transition = animate ? "transform .18s ease-out" : "";
      el.style.transform = "";
    };
    // Where this swipe may turn to: +1, -1, or 0 when it should pan or do nothing.
    const turnFor = (dx: number, s: NonNullable<typeof start>) => {
      const delta = dx < 0 ? 1 : -1;
      if (zoom !== 1 && !(delta > 0 ? s.atRight : s.atLeft)) return 0;
      return delta;
    };
    const onStart = (e: TouchEvent) => {
      if (e.touches.length !== 1 || selecting()) return void (start = null);
      // Dragging a sticky note moves the note, not the page.
      if ((e.target as HTMLElement).closest("[data-sticky]")) return void (start = null);
      const t = e.touches[0];
      start = {
        x: t.clientX,
        y: t.clientY,
        atLeft: box.scrollLeft <= 1,
        atRight: box.scrollLeft + box.clientWidth >= box.scrollWidth - 1,
      };
      axis = null;
      el.style.transition = "";
    };
    const onMove = (e: TouchEvent) => {
      if (!start) return;
      if (e.touches.length !== 1 || selecting()) {
        start = null;
        return settle(true);
      }
      const dx = e.touches[0].clientX - start.x;
      const dy = e.touches[0].clientY - start.y;
      if (!axis) {
        if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
        axis = Math.abs(dx) > Math.abs(dy) * 1.2 ? "x" : "y";
      }
      if (axis !== "x") return;
      const delta = turnFor(dx, start);
      if (!delta) return;
      // Nothing to turn to at the first and last page: the page resists.
      const end = delta > 0 ? page >= total : page <= 1;
      el.style.transform = `translateX(${end ? dx / 5 : dx}px)`;
    };
    const onEnd = (e: TouchEvent) => {
      if (!start) return;
      const s = start;
      start = null;
      const dx = e.changedTouches[0].clientX - s.x;
      const delta = axis === "x" && !selecting() ? turnFor(dx, s) : 0;
      const far = Math.abs(dx) >= Math.min(90, box.clientWidth * 0.22);
      if (!delta || !far || (delta > 0 ? page >= total : page <= 1)) return settle(true);
      settle(false);
      box.scrollLeft = 0;
      go(delta);
      // The new page slides in from the side it came from.
      if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches)
        el.animate(
          [{ transform: `translateX(${delta * 28}%)`, opacity: 0.35 }, { transform: "none", opacity: 1 }],
          { duration: 200, easing: "ease-out" },
        );
    };
    const onCancel = () => {
      start = null;
      settle(true);
    };
    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: true });
    el.addEventListener("touchend", onEnd, { passive: true });
    el.addEventListener("touchcancel", onCancel, { passive: true });
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
      el.removeEventListener("touchcancel", onCancel);
      settle(false);
    };
  }, [doc, page, total, zoom, go, drawing]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest("input, textarea, dialog")) return;
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go]);

  const save = async (quote: string, body?: string) => {
    if (!meta) return;
    await addNote({
      kind: "pdf",
      quote,
      body: body || undefined,
      highlight: !body,
      sourceTitle: meta.title,
      sourceLabel: "PDF",
      pdfId: id,
      page,
      href: `/library/read?id=${id}&page=${page}`,
    });
    toast({ text: t("Saved to Notes · p. {n}", { n: page }), href: "/notes" });
  };

  const saveWord = async (w: string, meaning: string) => {
    if (!meta) return;
    await addNote({
      kind: "pdf",
      word: true,
      quote: w,
      body: meaning,
      sourceTitle: meta.title,
      sourceLabel: "PDF",
      pdfId: id,
      page,
      href: `/library/read?id=${id}&page=${page}`,
    });
    toast({ text: t("“{word}” saved to My words", { word: w }), href: "/notes" });
  };

  const listed = pageNotes.filter((n) => n.body && !n.sticky && !n.word); // stickies are on the page already
  const marked = !!meta?.bookmarks?.some((b) => b.page === page);

  const minutesLeft = Math.round((total - page) * MIN_PER_PAGE);
  const left =
    minutesLeft >= 60
      ? `${Math.floor(minutesLeft / 60)}:${String(minutesLeft % 60).padStart(2, "0")}`
      : t("{n}m", { n: minutesLeft });

  if (missing) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-8 text-center">
        <p className="font-serif text-[24px] italic">{t("This PDF isn’t on this device.")}</p>
        <Link href="/library" className="label rounded-full bg-ink px-5 py-3 text-[11px] text-on-ink">
          {t("Back to Library")}
        </Link>
      </main>
    );
  }

  return (
    <main className="min-h-dvh bg-paper pb-40">
      <div className="sticky top-0 z-20 -mt-[env(safe-area-inset-top)] bg-paper px-[max(20px,calc((100%-880px)/2))] pt-[calc(env(safe-area-inset-top)+20px)]">
        <div className="flex h-11 items-center gap-1">
          <Link href="/library" aria-label={t("Back to library")} className="-ml-2 flex size-11 items-center justify-center">
            <ChevronLeft size={22} />
          </Link>
          <span className="label grow truncate text-center text-[10px]">
            {meta?.title ?? t("Loading…")} · {t("p. {n}", { n: page })}
          </span>
          {!focusing && meta && (
            <Link
              href={`/focus?kind=pdf&id=${id}&title=${encodeURIComponent(meta.title)}`}
              aria-label={t("Start a focus session with this PDF")}
              className="flex size-11 items-center justify-center"
            >
              <ClockIcon size={20} />
            </Link>
          )}
          {meta && doc && (
            <ListenButton
              label={t("Listen from this page")}
              title={`${meta.title} · ${t("from p. {n}", { n: page })}`}
              source="PDF"
              getText={() => pdfText(doc, page, Math.min(doc.numPages, page + 29))}
            />
          )}
          {meta && <AiPdfButton id={id} title={meta.title} page={page} onPage={setPage} />}
          <button
            aria-label={drawing ? t("Stop drawing") : t("Draw and write on the page")}
            aria-pressed={drawing}
            onClick={() => setDrawing((d) => !d)}
            className={`flex size-11 items-center justify-center rounded-full ${drawing ? "bg-ink text-on-ink" : ""}`}
          >
            <PenIcon size={20} />
          </button>
          <button aria-label={t("Bookmarks")} onClick={() => setPanel("bookmarks")} className="flex size-11 items-center justify-center">
            <BookmarkIcon size={20} filled={marked} />
          </button>
          <button aria-label={t("Page view: contrast, zoom and cover")} onClick={() => setPanel("view")} className="flex size-11 items-center justify-center">
            <ContrastIcon size={21} />
          </button>
        </div>
        <div className="mt-1.5 h-0.5 bg-rule">
          <div className="h-0.5 bg-ink transition-[width]" style={{ width: `${(page / total) * 100}%` }} />
        </div>
      </div>

      <div ref={wrap} className="mx-auto mt-4 max-w-[880px] overflow-x-auto px-3">
        {/* At normal size a sideways drag belongs to the page turn, not to the browser's panning. */}
        <div
          ref={sheet}
          style={{ touchAction: zoom === 1 ? "pan-y pinch-zoom" : undefined }}
          className="relative mx-auto w-fit bg-white shadow-[0_4px_18px_rgba(0,0,0,.08)]"
        >
          <canvas ref={canvasRef} className="block" style={{ filter: pageFilter(meta?.view) }} />
          <div ref={textRef} className="textLayer" />
          {!drawing && <InkLayer strokes={ink.strokes} w={size.w} h={size.h} className="z-[1]" />}
          {showStickies && (
            <Stickies
              notes={pageNotes.filter((n) => n.sticky)}
              pageW={size.w}
              pageH={size.h}
              onEdit={(n) => {
                setEditing(n);
                setPanel("sticky");
              }}
            />
          )}
          {marked && <Ribbon key={page} onClick={() => setPanel("bookmarks")} />}
          {drawing && size.w > 0 && (
            <InkPad
              strokes={ink.strokes}
              onChange={ink.change}
              w={size.w}
              h={size.h}
              pen={pen}
              onPan={(dx, dy) => {
                window.scrollBy(0, -dy);
                if (wrap.current) wrap.current.scrollLeft -= dx;
              }}
            />
          )}
        </div>
      </div>

      {listed.length > 0 && (
        <div className="mt-4 flex flex-col gap-2.5 px-5">
          {listed.map((n) => (
            <div key={n.id} className="flex items-start gap-2.5 rounded-xl bg-card px-3.5 py-3 shadow-[0_4px_14px_rgba(0,0,0,.06)]">
              <NoteIcon size={18} className="mt-0.5 shrink-0 text-pdf-deep" />
              <div className="flex flex-col gap-1">
                <span className="text-[14px] leading-snug">{n.body}</span>
                <span className="label text-[9px] text-muted">Saved to Notes · {clock(n.createdAt)}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-5 flex items-center justify-between px-5">
        <button
          onClick={() => go(-1)}
          disabled={page <= 1}
          className="label flex h-11 items-center gap-1 rounded-full border border-ink/15 px-4 text-[10px] disabled:opacity-30"
        >
          <ChevronLeft size={14} /> {t("Prev")}
        </button>
        <button
          onClick={() => setPanel("find")}
          aria-label={t("Page {n} of {total}. Search, contents and go to page", { n: page, total })}
          className="label flex h-11 items-center gap-2 rounded-full border border-ink/15 px-4 text-[10px]"
        >
          <SearchIcon size={14} /> {page} / {total}
        </button>
        <button
          onClick={() => go(1)}
          disabled={page >= total}
          className="label flex h-11 items-center gap-1 rounded-full border border-ink/15 px-4 text-[10px] disabled:opacity-30"
        >
          {t("Next")} <ChevronRight size={14} />
        </button>
      </div>

      {drawing && (
        <InkToolbar
          pen={pen}
          onPen={setPen}
          ink={ink}
          onClear={() => ink.strokes.length && ink.change([])}
          onDone={() => setDrawing(false)}
          className="fixed inset-x-3 bottom-[max(env(safe-area-inset-bottom),16px)] z-40 mx-auto max-w-[460px] shadow-[0_8px_24px_rgba(0,0,0,.25)]"
        />
      )}

      {/* Reading-time + music pill from the design */}
      <div hidden={drawing} className="fixed inset-x-4 bottom-[max(env(safe-area-inset-bottom),24px)] z-30 mx-auto flex h-[60px] max-w-[448px] items-center gap-2.5 rounded-full bg-ink pr-2 pl-[18px] text-on-ink">
        {focusing && focus ? (
          // During a focus session the pill counts down the session instead.
          <Link href="/focus" aria-label={t("Focus session")} className="flex items-center gap-2.5">
            <span className={`size-2 rounded-full ${focus.pausedAt ? "bg-pdf" : "animate-pulse bg-music"}`} />
            <span className="text-[15px] font-semibold tabular-nums">{clockText(remainingMs(focus, tick))}</span>
            <span className="label text-[9px] text-on-ink/65">{focus.pausedAt ? t("paused") : t("focus")}</span>
          </Link>
        ) : (
          <>
            <ClockIcon size={18} />
            <span className="text-[15px] font-semibold">{left}</span>
            <span className="label text-[9px] text-on-ink/65">{t("left")}</span>
          </>
        )}
        <span className="mx-1 h-[26px] w-px bg-on-ink/20" />
        <Link href="/music" className="flex min-w-0 grow items-center gap-2">
          <span className={`size-2 shrink-0 rounded-full ${now?.playing ? "bg-music" : "bg-[#6B6862]"}`} />
          <span className="label truncate text-[10px]">
            {now ? `${now.title} · ${now.artist}` : t("Add music")}
          </span>
        </Link>
        {now && (
          <button
            aria-label={now.playing ? t("Pause music") : t("Play music")}
            onClick={now.toggle}
            className="flex size-11 shrink-0 items-center justify-center rounded-full bg-music text-white"
          >
            {now.playing ? <PauseIcon size={14} /> : <PlayIcon size={14} />}
          </button>
        )}
      </div>

      <button
        hidden={drawing}
        aria-label={t("Add a sticky note to this page")}
        onClick={() => {
          setEditing(null);
          setShowStickies(true);
          setPanel("sticky");
        }}
        className="fixed right-4 bottom-[calc(max(env(safe-area-inset-bottom),24px)+72px)] z-30 flex size-12 items-center justify-center rounded-full bg-[#FFE08A] text-[#111] shadow-[0_4px_12px_rgba(0,0,0,.25)]"
      >
        <NoteAddIcon size={21} />
      </button>
      {meta && (
        <>
          <ViewSheet
            open={panel === "view"}
            onClose={() => setPanel(null)}
            meta={meta}
            onMeta={(patch) => patchPdf(meta, patch, setMeta)}
            zoom={zoom}
            onZoom={setZoom}
            showStickies={showStickies}
            onShowStickies={setShowStickies}
            canvas={canvasRef}
            page={page}
          />
          <BookmarkSheet
            open={panel === "bookmarks"}
            onClose={() => setPanel(null)}
            bookmarks={meta.bookmarks ?? []}
            onChange={(bookmarks) => patchPdf(meta, { bookmarks }, setMeta)}
            page={page}
            onPage={setPage}
          />
          <StickySheet open={panel === "sticky"} onClose={() => setPanel(null)} editing={editing} pdf={meta} page={page} />
        </>
      )}

      <FindSheet
        open={panel === "find"}
        onClose={() => setPanel(null)}
        source={findSource}
        page={page}
        onPage={(p) => {
          setPage(p);
          window.scrollTo({ top: 0 });
        }}
        onFound={setFound}
      />
      <SelectionToolbar
        container={textRef}
        accent="text-pdf-deep"
        onExplain={explain}
        onHighlight={(t) => save(t)}
        onNote={(t) => setNoteQuote(t)}
        onMeaning={setWord}
        onShare={(text) => setSharing({ text, quoted: true, title: meta?.title, label: `PDF · ${t("p. {n}", { n: page })}` })}
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
          setSharing(wordCard(w, meaning, meta?.title));
        }}
      />
      <QuoteNoteSheet
        quote={noteQuote}
        tint="bg-pdf-tint"
        onClose={() => setNoteQuote(null)}
        onSave={(body) => {
          if (noteQuote) save(noteQuote, body);
          setNoteQuote(null);
        }}
      />
    </main>
  );
}

// The text of pages `from`..`to`, for Listen mode.
async function pdfText(doc: PDFDocumentProxy, from: number, to: number) {
  const pages: string[] = [];
  for (let i = from; i <= to; i++) pages.push(await pdfPageText(doc, i));
  return pages.join("\n\n");
}
