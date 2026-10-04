"use client";

// "Go to" in the PDF and book readers: search the whole text, the table of
// contents, or a page number. The reader says how to get a page's text and
// its contents, so the same sheet serves PDFs (pages) and EPUBs (chapters).
import { useEffect, useRef, useState } from "react";
import { SearchIcon } from "./icons";
import { Chips, Sheet } from "./sheet";
import { useT } from "@/lib/i18n";

export type OutlineItem = { title: string; page: number; depth: number };
export type FindSource = {
  pages: number;
  unit: string; // "p." or "ch."
  pageText: (page: number) => Promise<string>; // 1-based
  outline: () => Promise<OutlineItem[]>;
};
type Hit = { page: number; before: string; match: string; after: string };
type Tab = "search" | "contents" | "page";

const MAX_HITS = 150;
const fold = (s: string) => s.toLowerCase();

export function FindSheet({
  open,
  onClose,
  source,
  page,
  onPage,
  onFound,
}: {
  open: boolean;
  onClose: () => void;
  source: FindSource | null;
  page: number;
  onPage: (page: number) => void;
  onFound: (text: string | null) => void; // the words to mark on the page
}) {
  const t = useT();
  const [tab, setTab] = useState<Tab>("search");
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [searched, setSearched] = useState(0); // pages looked at so far; 0 before a search
  const [busy, setBusy] = useState(false);
  const [outline, setOutline] = useState<OutlineItem[] | null>(null);
  const [goto, setGoto] = useState("");
  const texts = useRef(new Map<number, string>()); // each page is read once
  const run = useRef(0);
  const src = useRef(source);
  useEffect(() => {
    // Another book: forget the last one's pages and contents.
    if (src.current !== source) {
      src.current = source;
      texts.current.clear();
      run.current++;
      setOutline(null);
      setHits([]);
      setSearched(0);
    }
  }, [source]);

  useEffect(() => {
    if (!open || tab !== "contents" || outline || !source) return;
    let alive = true;
    source
      .outline()
      .catch(() => [])
      .then((o) => alive && setOutline(o));
    return () => {
      alive = false;
    };
  }, [open, tab, outline, source]);

  const search = async () => {
    const q = fold(query.replace(/\s+/g, " ").trim());
    if (!source || q.length < 2) return;
    const mine = ++run.current;
    setHits([]);
    setSearched(0);
    setBusy(true);
    const found: Hit[] = [];
    for (let p = 1; p <= source.pages && found.length < MAX_HITS; p++) {
      let text = texts.current.get(p);
      if (text === undefined) {
        text = (await source.pageText(p).catch(() => "")).replace(/\s+/g, " ");
        texts.current.set(p, text);
      }
      if (mine !== run.current) return; // a newer search took over
      const lower = fold(text);
      for (let at = lower.indexOf(q); at >= 0 && found.length < MAX_HITS; at = lower.indexOf(q, at + q.length)) {
        found.push({
          page: p,
          before: text.slice(Math.max(0, at - 40), at),
          match: text.slice(at, at + q.length),
          after: text.slice(at + q.length, at + q.length + 70),
        });
      }
      // Show progress every few pages, so a long book doesn't look stuck.
      if (p % 8 === 0 || p === source.pages) {
        setHits([...found]);
        setSearched(p);
      }
    }
    setHits([...found]);
    setSearched(source.pages);
    setBusy(false);
  };

  const go = (p: number, mark: string | null = null) => {
    onFound(mark);
    onPage(p);
    onClose();
  };
  const unit = source?.unit ?? "p.";

  return (
    <Sheet open={open} onClose={onClose} title="Go to">
      <Chips
        label="Go to"
        options={[
          { value: "search", label: "Search" },
          { value: "contents", label: "Contents" },
          { value: "page", label: unit === "ch." ? "Chapter" : "Page" },
        ]}
        value={tab}
        onChange={setTab}
      />

      {tab === "search" && (
        <>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              search();
            }}
            className="flex gap-2"
          >
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("Words to find")}
              aria-label={t("Search in this book")}
              enterKeyHint="search"
              className="h-12 min-w-0 grow rounded-full border border-ink/15 bg-card px-4 text-[15px] outline-none focus:border-ink"
            />
            <button
              disabled={query.trim().length < 2}
              aria-label={t("Search")}
              className="flex h-12 w-14 shrink-0 items-center justify-center rounded-full bg-ink text-on-ink disabled:opacity-40"
            >
              <SearchIcon size={18} />
            </button>
          </form>
          {searched > 0 && (
            <p className="label -mt-1 text-[10px] text-muted">
              {busy
                ? t("Looking… {n} of {total}", { n: searched, total: source?.pages ?? 0 })
                : hits.length === 0
                  ? t("Not found in this book")
                  : hits.length >= MAX_HITS
                    ? t("First {n} matches", { n: MAX_HITS })
                    : t(hits.length === 1 ? "{n} match" : "{n} matches", { n: hits.length })}
            </p>
          )}
          {hits.length > 0 && (
            <ul className="-mt-1 flex max-h-[44dvh] flex-col overflow-y-auto">
              {hits.map((h, i) => (
                <li key={i} className="border-b border-line last:border-0">
                  <button onClick={() => go(h.page, h.match)} className="flex w-full items-baseline gap-3 py-2.5 text-left">
                    <span className="min-w-0 grow text-[14px] leading-snug">
                      <span className="text-muted">…{h.before}</span>
                      <mark className="rounded-[3px] bg-pdf/40 px-0.5 font-semibold text-ink">{h.match}</mark>
                      <span className="text-muted">{h.after}…</span>
                    </span>
                    <span className="label shrink-0 text-[10px] text-muted">
                      {unit} {h.page}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {tab === "contents" &&
        (outline === null ? (
          <p className="label py-6 text-center text-[10px] text-muted">{t("Reading the contents…")}</p>
        ) : outline.length === 0 ? (
          <p className="py-4 text-[14px] text-muted">{t("This file has no table of contents.")}</p>
        ) : (
          <ul className="flex max-h-[52dvh] flex-col overflow-y-auto">
            {outline.map((o, i) => {
              const next = outline.slice(i + 1).find((x) => x.page > o.page)?.page ?? Infinity;
              const here = page >= o.page && page < next;
              return (
                <li key={i} className="border-b border-line last:border-0">
                  <button
                    onClick={() => go(o.page)}
                    style={{ paddingLeft: o.depth * 16 }}
                    className={`flex min-h-11 w-full items-center gap-3 py-2 text-left ${o.depth ? "text-[14px]" : "text-[15px] font-semibold"} ${here ? "text-pdf-deep" : ""}`}
                  >
                    <span className="min-w-0 grow">{o.title}</span>
                    <span className="label shrink-0 text-[10px] text-muted">
                      {unit} {o.page}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        ))}

      {tab === "page" && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const p = Math.round(Number(goto));
            if (source && p >= 1 && p <= source.pages) go(p);
          }}
          className="flex gap-2"
        >
          <input
            value={goto}
            onChange={(e) => setGoto(e.target.value)}
            type="number"
            inputMode="numeric"
            min={1}
            max={source?.pages}
            placeholder={t("1 to {total} (now {n})", { total: source?.pages ?? 1, n: page })}
            aria-label={unit === "ch." ? t("Chapter number") : t("Page number")}
            className="h-12 min-w-0 grow rounded-full border border-ink/15 bg-card px-4 text-[15px] outline-none focus:border-ink"
          />
          <button
            disabled={!(Number(goto) >= 1 && Number(goto) <= (source?.pages ?? 0))}
            className="h-12 shrink-0 rounded-full bg-ink px-6 text-[15px] font-semibold text-on-ink disabled:opacity-40"
          >
            {t("Go")}
          </button>
        </form>
      )}
    </Sheet>
  );
}
