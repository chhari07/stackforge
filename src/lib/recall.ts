// Recall: what you read on a day, one item per PDF or article, with the lines
// you kept from it. Today's recall on Today shows today's; the Recall calendar
// (app/recall) shows any day. Built from the reading log (lib/reading.ts) and
// your notes, so there's nothing new to store.
import type { Note, PdfMeta, SavedArticle } from "./db";
import { readingOn, readingDays } from "./reading";

export type RecallItem = {
  key: string;
  kind: "pdf" | "article" | "other";
  title: string;
  category: string; // the PDF's shelf, or where the article came from
  href?: string;
  pages: number; // PDF pages read that day
  kept: Note[]; // highlights and notes made that day, oldest first
  last: number;
};

export const DAY = 86_400_000;

export function startOfDay(t: number) {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

const nextDay = (day: number) => {
  const d = new Date(day);
  d.setDate(d.getDate() + 1);
  return d.getTime();
};

// Lines kept while reading. Imported Kindle / Readwise highlights belong to the day they were read, not imported.
const isKept = (n: Note) => (n.kind === "pdf" || n.kind === "article") && !n.importKey && !!(n.quote || n.body);

export function recallFor(day: number, notes: Note[], pdfs: PdfMeta[], saved: SavedArticle[]): RecallItem[] {
  const end = nextDay(day);
  const pdfById = new Map(pdfs.map((p) => [p.id, p]));
  const savedById = new Map(saved.map((a) => [a.id, a]));
  const items = new Map<string, RecallItem>();
  const get = (key: string, make: () => Omit<RecallItem, "key" | "pages" | "kept" | "last">, at: number) => {
    let it = items.get(key);
    if (!it) items.set(key, (it = { key, pages: 0, kept: [], last: at, ...make() }));
    it.last = Math.max(it.last, at);
    return it;
  };
  const pdfItem = (id: string, at: number, fallback?: string) => {
    const p = pdfById.get(id);
    return get(`pdf:${id}`, () => ({ kind: "pdf", title: p?.title ?? fallback ?? "PDF", category: p?.shelf || "PDF", href: `/library/read?id=${id}` }), at);
  };
  const articleItem = (id: string, at: number, n?: Note) => {
    const a = savedById.get(id);
    return get(
      `article:${id}`,
      () => ({ kind: "article", title: n?.sourceTitle ?? a?.title ?? "Article", category: n?.sourceLabel ?? a?.source ?? "Article", href: n?.href ?? `/read?id=${id}` }),
      at,
    );
  };

  for (const n of notes) {
    if (n.createdAt < day || n.createdAt >= end || !isKept(n)) continue;
    const it = n.pdfId
      ? pdfItem(n.pdfId, n.createdAt, n.sourceTitle)
      : n.articleId
        ? articleItem(n.articleId, n.createdAt, n)
        : get(`source:${n.sourceTitle ?? n.id}`, () => ({ kind: "other", title: n.sourceTitle ?? "Note", category: n.sourceLabel ?? "Note", href: n.href }), n.createdAt);
    it.kept.push(n);
  }

  const log = readingOn(day);
  if (log) {
    const pages = new Map<string, number>();
    for (const k of log.pages) {
      const id = k.slice(0, k.lastIndexOf(":"));
      pages.set(id, (pages.get(id) ?? 0) + 1);
    }
    for (const [id, count] of pages) {
      const p = pdfById.get(id);
      if (!p) continue; // deleted since
      const at = p.lastOpenedAt && p.lastOpenedAt < end ? p.lastOpenedAt : day;
      pdfItem(id, at).pages = count;
    }
    for (const id of log.articles) if (savedById.has(id) || items.has(`article:${id}`)) articleItem(id, savedById.get(id)?.readAt ?? day);
  }

  for (const it of items.values()) it.kept.sort((a, b) => a.createdAt - b.createdAt);
  // Things you kept lines from first, then the latest.
  return [...items.values()].sort((a, b) => Number(b.kept.length > 0) - Number(a.kept.length > 0) || b.last - a.last);
}

/** Categories on a day, most items first: [["Medical", 2], ["Hacker News", 1]]. */
export function categoriesOf(items: RecallItem[]): [string, number][] {
  const c = new Map<string, number>();
  for (const it of items) c.set(it.category, (c.get(it.category) ?? 0) + 1);
  return [...c].sort((a, b) => b[1] - a[1]);
}

/** Day starts that have anything to recall: reading, or lines kept. */
export function recallDays(notes: Note[]): Set<number> {
  const days = new Set(readingDays().map(startOfDay));
  for (const n of notes) if (isKept(n)) days.add(startOfDay(n.createdAt));
  return days;
}

// ---- Flash cards and day folders ----

const STOP = new Set(
  "about above after again against because before being below between could does doing during each every from have having into itself just more most other over same should some such than that their them then there these they this those through under until very what when where which while will with would your".split(" "),
);

/**
 * A flash card's front: the line with its one or two most telling words hidden.
 * "Top-down: start from the ____, then narrow by segment."
 */
export function cloze(quote: string): { front: string; hidden: string[] } {
  const words = [...quote.matchAll(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu)].map((m) => m[0]);
  const picks = [...new Set(words)]
    .filter((w) => w.length >= 5 && !STOP.has(w.toLowerCase()))
    .sort((a, b) => b.length - a.length)
    .slice(0, words.length >= 12 ? 2 : 1);
  if (picks.length === 0) return { front: "", hidden: [] }; // too short: the whole line is the answer
  let front = quote;
  for (const w of picks) front = front.replace(new RegExp(`(^|[^\\p{L}\\p{N}])${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\p{L}\\p{N}])`, "u"), "$1____");
  return { front, hidden: picks };
}

/** Lines kept on a day that make a flash card (they have a highlighted line). */
export const cardsOf = (items: RecallItem[]) => items.flatMap((it) => it.kept.filter((n) => n.quote).map((n) => ({ note: n, item: it })));

export type DayFolder = { day: number; items: RecallItem[]; cards: number };

/** One folder per day in a month that has anything to recall, newest first. */
export function dayFolders(year: number, month: number, days: Set<number>, notes: Note[], pdfs: PdfMeta[], saved: SavedArticle[]): DayFolder[] {
  const out: DayFolder[] = [];
  const count = new Date(year, month + 1, 0).getDate();
  for (let d = count; d >= 1; d--) {
    const day = new Date(year, month, d).getTime();
    if (!days.has(day)) continue;
    const items = recallFor(day, notes, pdfs, saved);
    out.push({ day, items, cards: cardsOf(items).length });
  }
  return out;
}

/** Months that have reading, newest first, always including this month: [year, month][] */
export function recallMonths(days: Set<number>, now: number): [number, number][] {
  const n = new Date(now);
  const keys = new Set([n.getFullYear() * 12 + n.getMonth()]);
  for (const d of days) {
    const x = new Date(d);
    keys.add(x.getFullYear() * 12 + x.getMonth());
  }
  return [...keys].sort((a, b) => b - a).map((k) => [Math.floor(k / 12), k % 12]);
}
