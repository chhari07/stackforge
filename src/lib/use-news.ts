"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { TOPICS, type Story, type Topic } from "./news";
import { NO_PREFS, followed, getNewsPrefs, unmuted } from "./news-prefs";
import { useStore } from "./use-store";
import { loadNews } from "./platform";
import { cacheNews, getCachedNews, prefetchTop } from "./offline";

export type { Story, Topic };

export function useNews(topic: Topic) {
  const [state, setState] = useState<{
    topic: Topic;
    stories: Story[];
    status: "loading" | "ok" | "error";
    updatedAt?: number; // when these stories were fetched
    offline?: boolean; // no connection: the last list saved on this device
  }>({ topic, stories: [], status: "loading" });
  const current = useRef(topic);

  useEffect(() => {
    current.current = topic;
    let alive = true;
    loadNews(topic)
      .then(async (stories) => {
        // Sources that can't be reached come back empty: show the saved list.
        if (!stories.length) {
          const saved = await getCachedNews(topic);
          if (saved) {
            if (alive) setState({ topic, stories: saved.stories, status: "ok", updatedAt: saved.at, offline: true });
            return;
          }
        }
        if (alive) setState({ topic, stories, status: "ok", updatedAt: Date.now() });
        cacheNews(topic, stories).catch(() => {});
        if (topic === "top") prefetchTop(stories).catch(() => {});
      })
      .catch(async () => {
        const saved = await getCachedNews(topic).catch(() => null);
        if (!alive) return;
        setState(
          saved
            ? { topic, stories: saved.stories, status: "ok", updatedAt: saved.at, offline: true }
            : { topic, stories: [], status: "error" },
        );
      });
    return () => {
      alive = false;
    };
  }, [topic]);

  // Pull to refresh: fetch past the cache, keeping the old stories on screen
  // until the new ones arrive. Resolves to whether it worked.
  const refresh = useCallback(async () => {
    try {
      const stories = await loadNews(topic, true);
      if (!stories.length && topic !== "mine") return false;
      if (current.current === topic) setState({ topic, stories, status: "ok", updatedAt: Date.now() });
      cacheNews(topic, stories).catch(() => {});
      return true;
    } catch {
      return false;
    }
  }, [topic]);

  // While a new topic loads, report loading instead of the old list.
  const shown =
    state.topic === topic ? state : { topic, stories: [], status: "loading" as const };
  // Muted words and sources never show (lib/news-prefs.ts).
  const [prefs] = useStore(getNewsPrefs, NO_PREFS);
  const stories = useMemo(() => unmuted(shown.stories, prefs), [shown.stories, prefs]);
  return { ...shown, stories, refresh };
}

// Every topic but video and your own feeds is searched for what you follow.
const FOLLOW_TOPICS = TOPICS.map((t) => t.value).filter((t) => t !== "video" && t !== "mine");

/**
 * "Following": stories from every topic about the words you follow, newest
 * first. Only loads while `active`. A topic that can't be reached falls back
 * to its saved list.
 */
export function useFollowing(active: boolean) {
  const [prefs, ready] = useStore(getNewsPrefs, NO_PREFS);
  const [state, setState] = useState<{ all: Story[]; status: "loading" | "ok" | "error"; updatedAt?: number; offline?: boolean }>({
    all: [],
    status: "loading",
  });

  const load = useCallback(async (fresh: boolean) => {
    const lists = await Promise.all(
      FOLLOW_TOPICS.map(async (t) => {
        try {
          const stories = await loadNews(t, fresh);
          if (stories.length) return { stories, live: true };
        } catch {}
        return { stories: (await getCachedNews(t).catch(() => null))?.stories ?? [], live: false };
      }),
    );
    const seen = new Set<string>();
    const all = lists
      .flatMap((l) => l.stories)
      .filter((s) => !seen.has(s.id) && seen.add(s.id))
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
    const live = lists.some((l) => l.live);
    setState({ all, status: all.length ? "ok" : "error", updatedAt: Date.now(), offline: !live && all.length > 0 });
    return live;
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (active) load(false);
  }, [active, load]);

  const refresh = useCallback(() => load(true), [load]);
  const stories = useMemo(() => followed(unmuted(state.all, prefs), prefs), [state.all, prefs]);
  return { ...state, status: ready ? state.status : ("loading" as const), stories, follows: prefs.follows, refresh };
}

export const safeImage = (url?: string) => (url && /^https?:\/\//.test(url) ? url : undefined);
