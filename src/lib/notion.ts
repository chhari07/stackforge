"use client";

// Export notes and highlights to Notion, with your own Notion integration:
// make one at notion.so/my-integrations, copy its secret, and connect it to
// a page (••• → Connections). Stack makes one Notion page per article, PDF or
// book under that page; exporting again adds only what's new.
// Stack talks to Notion straight from the phone (Android app only: Notion
// doesn't answer browsers). The secret stays on this device.
import { get, set, del } from "idb-keyval";
import type { Note } from "./db";
import { groupBySource, sourceUrl } from "./export-md";
import { pageLabel } from "@/components/note-card";
import { isNative } from "./platform";
import { tr } from "./i18n";

const API = "https://api.notion.com/v1";
const VERSION = "2022-06-28";
const KEY = "stack.notion";
const PAGES = "notion:pages"; // what's been exported: source → Notion page + note ids
const OWN = "own"; // the source key for your own notes

export type NotionLink = { token: string; pageId: string; pageTitle: string };
type Exported = Record<string, { pageId: string; ids: string[] }>;

export const notionWorks = () => isNative();

export class NotionError extends Error {
  constructor(
    public code: "token" | "page" | "network" | "api",
    message: string,
  ) {
    super(message);
  }
}

export function getNotion(): NotionLink | null {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "null");
  } catch {
    return null;
  }
}

export async function disconnectNotion() {
  try {
    localStorage.removeItem(KEY);
  } catch {}
  await del(PAGES);
}

// The page id from a Notion link ("…/Reading-notes-1a2b…" or a bare id).
export function pageIdFrom(link: string) {
  const hex = link.trim().split("?")[0].replace(/-/g, "").match(/[0-9a-f]{32}$/i)?.[0];
  return hex ? `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}` : null;
}

// One API request. Rate limits (Notion allows ~3 a second) and its own 5xx
// errors are retried.
async function call<T>(token: string, method: string, path: string, body?: unknown): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    let res: Response;
    try {
      res = await fetch(`${API}${path}`, {
        method,
        headers: { Authorization: `Bearer ${token}`, "Notion-Version": VERSION, "content-type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(30_000),
      });
    } catch {
      if (attempt < 2) continue;
      throw new NotionError("network", tr("Couldn’t reach Notion. Check your internet and try again."));
    }
    const data = (await res.json().catch(() => null)) as (T & { message?: string }) | null;
    if (res.ok) return data as T;
    if (res.status === 401) throw new NotionError("token", tr("Notion didn’t accept that secret. Copy it again from notion.so/my-integrations."));
    if (res.status === 404 || res.status === 403)
      throw new NotionError("page", tr("Stack can’t see that page. In Notion, open it → ••• → Connections → add your integration."));
    if ((res.status === 429 || res.status >= 500) && attempt < 4) {
      const wait = Number(res.headers.get("retry-after")) || attempt + 1;
      await new Promise((r) => setTimeout(r, Math.min(30, wait) * 1000));
      continue;
    }
    throw new NotionError("api", data?.message ?? tr("Notion error {status}", { status: res.status }));
  }
}

type RichText = { type: "text"; text: { content: string; link?: { url: string } | null }; annotations?: Record<string, unknown> };

// Notion takes at most 2,000 characters per piece of text.
const text = (s: string, annotations?: Record<string, unknown>, url?: string): RichText[] => {
  const out: RichText[] = [];
  for (let i = 0; i < s.length; i += 2000)
    out.push({ type: "text", text: { content: s.slice(i, i + 2000), link: url ? { url } : null }, ...(annotations ? { annotations } : {}) });
  return out;
};
const block = (type: string, rich: RichText[], extra: Record<string, unknown> = {}) => ({
  object: "block",
  type,
  [type]: { rich_text: rich, ...extra },
});
const muted = { color: "gray", italic: true };

function noteBlocks(n: Note, own: boolean) {
  const out: object[] = [];
  if (own) out.push(block("heading_3", text(n.title?.trim() || new Date(n.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }))));
  else if (n.title?.trim()) out.push(block("paragraph", text(n.title.trim(), { bold: true })));
  if (n.quote) {
    const where = pageLabel(n);
    out.push(block("quote", [...text(n.quote.trim()), ...(where ? text(`  (${where})`, muted) : [])]));
  }
  for (const para of (n.body ?? "").split(/\n{2,}/).map((p) => p.trim()).filter(Boolean)) out.push(block("paragraph", text(para)));
  for (const item of n.checklist ?? []) if (item.text.trim()) out.push(block("to_do", text(item.text), { checked: item.done }));
  if (n.tags?.length) out.push(block("paragraph", text(n.tags.map((t) => `#${t}`).join(" "), muted)));
  return out;
}

const chunks = <T>(list: T[], size: number) => Array.from({ length: Math.ceil(list.length / size) }, (_, i) => list.slice(i * size, (i + 1) * size));

/** Checks the secret and the page, and remembers both on this device. */
export async function connectNotion(token: string, link: string): Promise<NotionLink> {
  const t = token.trim();
  if (!/^(secret_|ntn_)\w{20,}$/.test(t)) throw new NotionError("token", tr("That doesn’t look like a Notion secret (it starts with ntn_ or secret_)."));
  const pageId = pageIdFrom(link);
  if (!pageId) throw new NotionError("page", tr("Paste the link of a Notion page (Share → Copy link)."));
  const page = await call<{ properties?: Record<string, { type: string; title?: { plain_text: string }[] }> }>(t, "GET", `/pages/${pageId}`);
  const titleProp = Object.values(page.properties ?? {}).find((p) => p.type === "title");
  const pageTitle = titleProp?.title?.map((x) => x.plain_text).join("") || tr("Untitled");
  // Another page: start the record of what's exported afresh.
  if (getNotion()?.pageId !== pageId) await del(PAGES);
  const linked = { token: t, pageId, pageTitle };
  try {
    localStorage.setItem(KEY, JSON.stringify(linked));
  } catch {}
  return linked;
}

export type NotionResult = { notes: number; pages: number };

/** Sends the notes that aren't in Notion yet. `onProgress` gets (done, total) sources. */
export async function exportToNotion(notes: Note[], onProgress?: (done: number, total: number) => void): Promise<NotionResult> {
  const link = getNotion();
  if (!link) throw new NotionError("token", tr("Connect Notion first."));
  const exported = (await get<Exported>(PAGES)) ?? {};
  const { bySource, own } = groupBySource(notes);
  const groups = [...bySource.entries(), ...(own.length ? [[OWN, own] as [string, Note[]]] : [])];
  const result: NotionResult = { notes: 0, pages: 0 };
  let done = 0;

  for (const [key, group] of groups) {
    const before = exported[key];
    const fresh = group.filter((n) => !before?.ids.includes(n.id));
    if (fresh.length) {
      let pageId: string | undefined = before?.pageId;
      // Add to the page made last time; if it was deleted in Notion, make a new one.
      if (pageId) {
        try {
          const blocks = fresh.flatMap((n) => noteBlocks(n, key === OWN));
          for (const part of chunks(blocks, 100)) await call(link.token, "PATCH", `/blocks/${pageId}/children`, { children: part });
        } catch (e) {
          if (!(e instanceof NotionError && e.code === "page") && !(e instanceof NotionError && /archived/i.test(e.message))) throw e;
          pageId = undefined;
        }
      }
      if (!pageId) {
        const first = group[0];
        const url = key === OWN ? undefined : sourceUrl(first);
        const about = key === OWN ? "" : [first.author, first.sourceLabel].filter(Boolean).join(" · ");
        const head = [
          ...(about ? [block("paragraph", text(about, muted))] : []),
          ...(url ? [block("paragraph", text(tr("Original"), undefined, url))] : []),
        ];
        // A new page holds the whole group. The first 100 blocks make the page, the rest are added after.
        const all = [...head, ...group.flatMap((n) => noteBlocks(n, key === OWN))];
        const [firstPart, ...rest] = chunks(all, 100);
        const page = await call<{ id: string }>(link.token, "POST", "/pages", {
          parent: { page_id: link.pageId },
          icon: { type: "emoji", emoji: key === OWN ? "📝" : first.kind === "article" ? "📰" : "📖" },
          properties: { title: { title: text(key === OWN ? tr("My notes") : (first.sourceTitle ?? tr("Untitled")).slice(0, 2000)) } },
          children: firstPart ?? [],
        });
        for (const part of rest) await call(link.token, "PATCH", `/blocks/${page.id}/children`, { children: part });
        pageId = page.id;
        result.pages++;
        result.notes += group.length;
        exported[key] = { pageId, ids: group.map((n) => n.id) };
      } else {
        result.notes += fresh.length;
        exported[key] = { pageId, ids: [...before!.ids, ...fresh.map((n) => n.id)] };
      }
      // Saved after each page, so a dropped connection never sends anything twice.
      await set(PAGES, exported);
    }
    onProgress?.(++done, groups.length);
  }
  return result;
}
