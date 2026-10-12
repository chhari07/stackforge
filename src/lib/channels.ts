"use client";

// Live, trending and video loading on the device (lib/live.ts does the
// reading), and your own YouTube channels: stored like everything else and
// synced to your account, the same way as your own feeds (lib/feeds.ts).
import { useCallback, useEffect, useRef, useState } from "react";
import { get, update } from "idb-keyval";
import { emit } from "./db";
import { track } from "./sync-state";
import { isNative, loadNews } from "./platform";
import { useStore } from "./use-store";
import { uiLang, tr } from "./i18n";
import {
  channelVideos,
  INDIA_CHANNELS,
  keywords,
  liveNow,
  matchScore,
  resolveChannel,
  trends,
  type Channel,
  type LiveNow,
  type Trend,
} from "./live";
import type { Story, Topic } from "./news";

export type UserChannel = Channel & { addedAt: number; updatedAt: number };

export async function getChannels(): Promise<UserChannel[]> {
  return ((await get<UserChannel[]>("channels")) ?? []).sort((a, b) => a.addedAt - b.addedAt);
}

// The app reads YouTube and Google Trends itself; the website asks /api/yt.
async function getText(url: string): Promise<string | null> {
  try {
    const res = isNative()
      ? await fetch(url, { signal: AbortSignal.timeout(12000) })
      : await fetch(`/api/yt?url=${encodeURIComponent(url)}`);
    return res.ok ? await res.text() : null;
  } catch {
    return null;
  }
}

export async function addChannel(input: string | Channel): Promise<{ channel?: UserChannel; error?: string }> {
  const found = typeof input === "string" ? await resolveChannel(input, getText) : input;
  if (!found) return { error: tr("Couldn’t find that channel. Paste its YouTube link or @handle.") };
  const all = await getChannels();
  if (all.some((c) => c.id === found.id) || INDIA_CHANNELS.some((c) => c.id === found.id))
    return { error: tr("{name} is already in your channels.", { name: found.name }) };
  const now = Date.now();
  const channel: UserChannel = { id: found.id, name: found.name, addedAt: now, updatedAt: now };
  await update<UserChannel[]>("channels", (list) => [...(list ?? []), channel]);
  await track("channels", channel.id);
  forget(VIDEOS_KEY);
  emit();
  return { channel };
}

export async function removeChannel(id: string) {
  await update<UserChannel[]>("channels", (list) => (list ?? []).filter((c) => c.id !== id));
  await track("channels", id, "del");
  forget(VIDEOS_KEY);
  emit();
}

// ---- A small cache, so opening News again doesn't reload everything ----
const LIVE_KEY = "stack.live.now";
const TRENDS_KEY = "stack.live.trends";
const VIDEOS_KEY = "stack.live.videos";

function cached<T>(key: string, maxAge: number): T | null {
  try {
    const c = JSON.parse(localStorage.getItem(key) ?? "null") as { at: number; v: T } | null;
    return c && Date.now() - c.at < maxAge ? c.v : null;
  } catch {
    return null;
  }
}
function keep<T>(key: string, v: T) {
  try {
    localStorage.setItem(key, JSON.stringify({ at: Date.now(), v }));
  } catch {}
}
function forget(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {}
}

type Load<T> = { items: T[]; status: "loading" | "ok" | "error" };

// Runs `load` (or uses its cached answer) while `on`; `refresh` goes past the
// cache. `key` names what's loaded, so a new key loads again.
function useLoad<T>(key: string, maxAge: number, load: () => Promise<T[]>, on: boolean) {
  const [state, setState] = useState<Load<T>>({ items: [], status: "loading" });
  const loader = useRef(load);
  useEffect(() => {
    loader.current = load;
  });
  const run = useCallback(
    async (fresh: boolean) => {
      const hit = fresh ? null : cached<T[]>(key, maxAge);
      if (hit) return setState({ items: hit, status: "ok" });
      try {
        const items = await loader.current();
        if (items.length) keep(key, items);
        setState({ items, status: "ok" });
      } catch {
        setState((s) => ({ items: s.items, status: s.items.length ? "ok" : "error" }));
      }
    },
    [key, maxAge],
  );
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (on) run(false);
  }, [on, run]);
  return { ...state, refresh: () => run(true) };
}

/** Channels to check for Live: Hindi first when Stack is in Hindi, then your own. */
function liveChannels(mine: Channel[]) {
  const hi = uiLang() === "hi";
  const known = [...INDIA_CHANNELS].sort((a, b) => Number(b.lang === (hi ? "hi" : "en")) - Number(a.lang === (hi ? "hi" : "en")));
  return [...known, ...mine];
}

/** Which Indian channels are live right now (checked at most every 10 minutes). */
export function useLive(on: boolean) {
  const [mine, ready] = useStore(getChannels, []);
  const ids = mine.map((c) => c.id).join();
  return useLoad<LiveNow>(LIVE_KEY + ":" + ids, 10 * 60_000, () => liveNow(liveChannels(mine), getText), on && ready);
}

/** What India is searching for that the news is covering (every 30 minutes). */
export function useTrends(on = true) {
  return useLoad<Trend>(TRENDS_KEY, 30 * 60_000, () => trends(getText), on);
}

/** The latest videos: the Indian channels (the Video topic) plus your own channels. */
export function useVideos(on: boolean) {
  const [mine, ready] = useStore(getChannels, []);
  const ids = mine.map((c) => c.id).join();
  return useLoad<Story>(
    VIDEOS_KEY + ":" + ids,
    15 * 60_000,
    async () => {
      const [known, own] = await Promise.all([loadNews("video").catch(() => [] as Story[]), channelVideos(mine, getText)]);
      const seen = new Set<string>();
      return [...known, ...own]
        .filter((s) => !seen.has(s.id) && seen.add(s.id))
        .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
    },
    on && ready,
  );
}

// Topics searched for articles on a trend, or for "Read about this".
const ARTICLE_TOPICS: Topic[] = ["top", "india", "business", "sports", "entertainment", "world", "tech", "science", "health"];

/** Stack's own articles about `text`, best match first. */
export function useArticles(text: string, on = true) {
  const words = keywords(text).join(" ");
  return useLoad<Story>(
    "stack.live.articles:" + words,
    10 * 60_000,
    async () => {
      const lists = await Promise.all(ARTICLE_TOPICS.map((t) => loadNews(t).catch(() => [] as Story[])));
      const w = words.split(" ").filter(Boolean);
      const seen = new Set<string>();
      return lists
        .flat()
        .filter((s) => !s.video && !seen.has(s.id) && seen.add(s.id))
        .map((s) => ({ s, score: matchScore(`${s.title} ${s.summary ?? ""}`, w) }))
        .filter((x) => x.score > 0)
        .sort((a, b) => b.score - a.score || Date.parse(b.s.createdAt) - Date.parse(a.s.createdAt))
        .slice(0, 8)
        .map((x) => x.s);
    },
    on && !!words,
  );
}

// ---- Settings: live video on Wi-Fi only ----
const WIFI_KEY = "stack.live.wifi";
export const wifiOnly = () => {
  try {
    return localStorage.getItem(WIFI_KEY) === "1";
  } catch {
    return false;
  }
};
export const setWifiOnly = (on: boolean) => {
  try {
    if (on) localStorage.setItem(WIFI_KEY, "1");
    else localStorage.removeItem(WIFI_KEY);
  } catch {}
};
/** True when the phone says it's on mobile data (unknown counts as not). */
export const onMobileData = () => {
  const c = (navigator as Navigator & { connection?: { type?: string } }).connection;
  return c?.type === "cellular";
};
