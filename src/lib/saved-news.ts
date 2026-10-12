// Library → Saved news: which folder a saved story sits in, and its name.
// A story goes in its topic's folder ("India news", "AI news") unless the
// reader moved it to a folder of their own.
import type { SavedArticle } from "./db";
import { TOPICS } from "./news";
import { tr } from "./i18n";

export const ALL = "all";

/** "topic:india", "folder:GATE notes", "shared" or "articles". */
export function folderKey(a: SavedArticle) {
  if (a.folder) return `folder:${a.folder}`;
  if (a.topic && TOPICS.some((x) => x.value === a.topic)) return `topic:${a.topic}`;
  return a.shared ? "shared" : "articles";
}

/** The name of a topic's news, in the app's language: "India news", "AI news". */
export function topicNews(topic: string, t: (s: string, v?: Record<string, string | number>) => string = tr) {
  const label = TOPICS.find((x) => x.value === topic)?.label ?? topic;
  return topic === "mine" ? t("My feeds") : t("{topic} news", { topic: t(label) });
}

export function folderName(key: string, t: (s: string, v?: Record<string, string | number>) => string = tr) {
  if (key === ALL) return t("All");
  if (key.startsWith("folder:")) return key.slice(7);
  if (key.startsWith("topic:")) return topicNews(key.slice(6), t);
  return key === "shared" ? t("Shared to Stack") : t("Articles");
}

/** Folders with their stories, biggest first; folders the reader made come first. */
export function folders(saved: SavedArticle[]) {
  const map = new Map<string, SavedArticle[]>();
  for (const a of saved) map.set(folderKey(a), [...(map.get(folderKey(a)) ?? []), a]);
  return [...map.entries()].sort(
    ([a, x], [b, y]) => Number(b.startsWith("folder:")) - Number(a.startsWith("folder:")) || y.length - x.length,
  );
}

/** Folders the reader made, for "Move to". */
export const ownFolders = (saved: SavedArticle[]) =>
  [...new Set(saved.map((a) => a.folder).filter((f): f is string => !!f))].sort();
