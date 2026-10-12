"use client";

// Highlights from Kindle and Readwise, into Stack's notes and daily review.
// - Kindle: the "My Clippings.txt" file on the Kindle (plug it in by USB).
// - Readwise: the CSV export (readwise.io/export), or the API with your own
//   access token (Android app only: Readwise doesn't answer browsers). The
//   token stays on this device, like the Telegram bot.
// Each highlight gets an importKey from its book and text, so importing the
// same file again (or Kindle highlights that Readwise also has) adds nothing twice.
import { addNotes, getNotes, uid, type Note } from "./db";
import { isNative } from "./platform";
import { tr } from "./i18n";

export type ImportSource = "kindle" | "readwise";

export type ImportItem = {
  book: string;
  author?: string;
  quote: string;
  note?: string;
  page?: number;
  loc?: number;
  at?: number; // when it was highlighted (ms)
  url?: string;
  tags?: string[];
  article?: boolean; // from a web article, not a book
};

const squash = (s: string) => s.replace(/\s+/g, " ").trim();

// A short stable hash (FNV-1a) of a book + highlight, for spotting repeats.
export function importKey(book: string, quote: string) {
  const s = `${squash(book).toLowerCase()}|${squash(quote).toLowerCase().slice(0, 300)}`;
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return `imp:${(h >>> 0).toString(36)}:${s.length}`;
}

const when = (s?: string) => {
  if (!s) return undefined;
  // "Saturday, 12 March 2022 10:11:12" → drop the weekday, Date reads the rest.
  const t = Date.parse(s.replace(/^[A-Za-z]+,\s*/, "").trim());
  return Number.isNaN(t) ? undefined : t;
};

// ---- Kindle: My Clippings.txt ----

type Clip = ImportItem & { type: "highlight" | "note" | "bookmark"; locEnd?: number };

function parseClip(block: string): Clip | null {
  const lines = block.replace(/^﻿/, "").split(/\r?\n/);
  while (lines.length && !lines[0].trim()) lines.shift();
  if (lines.length < 2) return null;
  // "Title (Author)": the last brackets are the author.
  const head = lines[0].trim();
  const m = head.match(/^(.*?)\s*\(([^()]*)\)\s*$/);
  const book = (m ? m[1] : head).trim();
  const author = m?.[2].trim() || undefined;
  // "- Your Highlight on page 23 | Location 345-347 | Added on Saturday, 12 March 2022 10:11:12"
  const meta = lines[1];
  const type = /bookmark/i.test(meta) ? "bookmark" : /note/i.test(meta) ? "note" : "highlight";
  const page = meta.match(/page\s+(\d+)/i)?.[1];
  const loc = meta.match(/location\s+(\d+)(?:-(\d+))?/i);
  const added = meta.match(/added on\s+(.*)$/i)?.[1];
  const text = lines.slice(2).join("\n").trim();
  if (!book || (!text && type !== "bookmark")) return null;
  return {
    type,
    book,
    author,
    quote: text,
    page: page ? Number(page) : undefined,
    loc: loc ? Number(loc[1]) : undefined,
    locEnd: loc ? Number(loc[2] ?? loc[1]) : undefined,
    at: when(added),
  };
}

const item = (c: Clip): ImportItem => ({ book: c.book, author: c.author, quote: c.quote, note: c.note, page: c.page, loc: c.loc, at: c.at });

export function parseKindle(text: string): ImportItem[] {
  const clips = text.split(/^={5,}\s*$/m).map(parseClip).filter((c): c is Clip => !!c);
  const highlights: Clip[] = [];
  const notes: Clip[] = [];
  for (const c of clips) {
    if (c.type === "bookmark") continue;
    if (c.type === "note") {
      notes.push(c);
      continue;
    }
    // Editing a highlight on a Kindle keeps the old one too: keep the longest.
    const same = highlights.findIndex(
      (h) => h.book === c.book && h.loc !== undefined && h.loc === c.loc && (h.quote.includes(c.quote) || c.quote.includes(h.quote)),
    );
    if (same < 0) highlights.push(c);
    else if (c.quote.length > highlights[same].quote.length) highlights[same] = c;
  }
  // A Kindle note sits at the end of the highlight it's about.
  const loose: ImportItem[] = [];
  for (const n of notes) {
    const h = highlights.find((h) => h.book === n.book && h.loc !== undefined && n.loc !== undefined && n.loc >= h.loc && n.loc <= (h.locEnd ?? h.loc));
    if (h) h.note = h.note ? `${h.note}\n${n.quote}` : n.quote;
    else loose.push({ ...item(n), note: n.quote, quote: "" });
  }
  return [...highlights.map(item), ...loose];
}

// ---- Readwise: CSV export ----

// RFC 4180 CSV: quoted fields can hold commas, quotes ("") and new lines.
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const s = text.replace(/^﻿/, "");
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (quoted) {
      if (c === '"' && s[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && s[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((f) => f.trim()));
}

const tagList = (s?: string) =>
  (s ?? "")
    .split(/[,;]/)
    .map((t) => t.trim().replace(/^#/, "").replace(/\s+/g, "-").toLowerCase())
    .filter(Boolean);

export function parseReadwiseCsv(text: string): ImportItem[] {
  const [head, ...rows] = parseCsv(text);
  if (!head) return [];
  const col = (name: string) => head.findIndex((h) => h.trim().toLowerCase() === name);
  const c = {
    quote: col("highlight"),
    book: col("book title"),
    author: col("book author"),
    note: col("note"),
    tags: col("tags"),
    locType: col("location type"),
    loc: col("location"),
    at: col("highlighted at"),
  };
  if (c.quote < 0 || c.book < 0) throw new Error(tr("This isn’t a Readwise CSV export. In Readwise: Export → CSV."));
  return rows
    .map((r) => {
      const n = Number(r[c.loc]);
      const type = r[c.locType]?.trim().toLowerCase();
      return {
        book: r[c.book]?.trim() || tr("Untitled"),
        author: r[c.author]?.trim() || undefined,
        quote: r[c.quote]?.trim() ?? "",
        note: r[c.note]?.trim() || undefined,
        page: type === "page" && n ? n : undefined,
        loc: type === "location" && n ? n : undefined,
        at: when(r[c.at]),
        tags: tagList(r[c.tags]),
      };
    })
    .filter((i) => i.quote);
}

// ---- Readwise: API ----

const RW = "https://readwise.io/api/v2";
const RW_KEY = "stack.readwise";

export const readwiseApiWorks = () => isNative();

export function getReadwiseToken(): string | null {
  try {
    return localStorage.getItem(RW_KEY);
  } catch {
    return null;
  }
}

export function forgetReadwise() {
  try {
    localStorage.removeItem(RW_KEY);
  } catch {}
}

type RwHighlight = {
  id: number;
  text: string;
  note?: string;
  location?: number;
  location_type?: string;
  highlighted_at?: string;
  created_at?: string;
  url?: string | null;
  is_discard?: boolean;
  tags?: { name: string }[];
};
type RwBook = {
  title: string;
  readable_title?: string;
  author?: string;
  category?: string;
  source_url?: string | null;
  highlights: RwHighlight[];
};

async function rw<T>(token: string, path: string): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    let res: Response;
    try {
      res = await fetch(`${RW}${path}`, { headers: { Authorization: `Token ${token}` }, signal: AbortSignal.timeout(30_000) });
    } catch {
      throw new Error(tr("Couldn’t reach Readwise. Check your internet and try again."));
    }
    if (res.status === 401 || res.status === 403) throw new Error(tr("Readwise didn’t accept that token. Copy it again from readwise.io/access_token."));
    // Readwise allows a few export requests a minute: wait as long as it asks.
    if (res.status === 429 && attempt < 4) {
      const wait = Number(res.headers.get("retry-after")) || 20;
      await new Promise((r) => setTimeout(r, Math.min(60, wait) * 1000));
      continue;
    }
    if (!res.ok) throw new Error(tr("Readwise error {status}", { status: res.status }));
    return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
  }
}

/** Checks the token, remembers it on this device, and downloads every highlight. */
export async function fetchReadwise(token: string, onPage?: (books: number) => void): Promise<ImportItem[]> {
  const t = token.trim();
  await rw(t, "/auth/");
  try {
    localStorage.setItem(RW_KEY, t);
  } catch {}
  const items: ImportItem[] = [];
  let cursor: string | null = null;
  let books = 0;
  do {
    const page: { results: RwBook[]; nextPageCursor: string | null } = await rw(
      t,
      `/export/${cursor ? `?pageCursor=${encodeURIComponent(cursor)}` : ""}`,
    );
    for (const b of page.results) {
      for (const h of b.highlights) {
        if (h.is_discard || !h.text?.trim()) continue;
        items.push({
          book: b.readable_title || b.title || tr("Untitled"),
          author: b.author || undefined,
          quote: h.text.trim(),
          note: h.note?.trim() || undefined,
          page: h.location_type === "page" && h.location ? h.location : undefined,
          loc: h.location_type === "location" && h.location ? h.location : undefined,
          at: when(h.highlighted_at ?? h.created_at),
          url: h.url || b.source_url || undefined,
          tags: (h.tags ?? []).map((x) => x.name.replace(/\s+/g, "-").toLowerCase()),
          article: b.category !== undefined && b.category !== "books",
        });
      }
    }
    books += page.results.length;
    onPage?.(books);
    cursor = page.nextPageCursor;
  } while (cursor);
  return items;
}

// ---- Into Stack ----

const LABEL: Record<ImportSource, string> = { kindle: "Kindle", readwise: "Readwise" };

export type ImportResult = { added: number; skipped: number; books: number };

/** Adds the highlights that aren't in Stack yet. They join the daily review. */
export async function importHighlights(items: ImportItem[], from: ImportSource): Promise<ImportResult> {
  const have = new Set<string>();
  for (const n of await getNotes()) {
    if (n.importKey) have.add(n.importKey);
    else if (n.quote && n.sourceTitle) have.add(importKey(n.sourceTitle, n.quote));
  }
  const now = Date.now();
  const fresh: Note[] = [];
  for (const i of items) {
    const key = importKey(i.book, i.quote || i.note || "");
    if (have.has(key)) continue;
    have.add(key);
    const tags = [...new Set(i.tags ?? [])];
    fresh.push({
      id: uid(),
      kind: !i.quote ? "idea" : i.article ? "article" : "pdf",
      color: !i.quote ? "default" : undefined,
      quote: i.quote || undefined,
      body: i.note,
      highlight: !!i.quote && !i.note,
      sourceTitle: i.book,
      sourceLabel: LABEL[from],
      author: i.author,
      sourceUrl: i.url,
      page: i.page,
      loc: i.loc,
      tags: tags.length ? tags : undefined,
      importKey: key,
      createdAt: Math.min(i.at ?? now, now),
    });
  }
  await addNotes(fresh);
  return {
    added: fresh.length,
    skipped: items.length - fresh.length,
    books: new Set(fresh.map((n) => n.sourceTitle)).size,
  };
}
