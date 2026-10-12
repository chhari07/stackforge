"use client";

// Breaking-news alerts (Android app only): a background check of the feeds of
// the topics you pick, about every 30 minutes, with at most one alert an hour
// (native/android/NewsAlertWorker.java). Each alert has the topic on top
// ("AI news"), the headline as its title, the story's summary below, and
// Read / Save for later buttons. Its words come from here, in the app's
// language, since the background check can't read the app's translations.
import { registerPlugin, type PluginListenerHandle } from "@capacitor/core";
import { ALERT_TOPICS, alertFeeds, TOPICS, type Topic } from "./news";
import { isNative } from "./platform";
import { addSaved, getSaved, updateSaved } from "./db";
import { downloadArticle, getCachedArticle } from "./offline";
import { tr } from "./i18n";
import { topicNews } from "./saved-news";

type SavedFromAlert = { id: string; title: string; source: string; summary?: string; url: string; topic: string; image?: string };
type AlertsPlugin = {
  configure(opts: { on: boolean; feeds: { source: string; url: string; topic: string }[]; labels: Labels }): Promise<void>;
  test(): Promise<void>;
  /** Stories saved with "Save for later" on an alert, waiting to be added to the Library. */
  takeSaves(): Promise<{ items: SavedFromAlert[] }>;
  /** Drops the first `count` of them, once saved. */
  ackSaves(opts: { count: number }): Promise<void>;
  addListener(event: "saved", fn: () => void): Promise<PluginListenerHandle>;
};
export const NewsAlertsNative = registerPlugin<AlertsPlugin>("NewsAlerts");

export type NewsAlerts = { on: boolean; topics: Topic[] };
const KEY = "stack.news-alerts";
const DEFAULT: NewsAlerts = { on: false, topics: ["top"] };

export function getNewsAlerts(): NewsAlerts {
  try {
    return { ...DEFAULT, ...JSON.parse(localStorage.getItem(KEY) ?? "{}") };
  } catch {
    return DEFAULT;
  }
}

/** Saves the choice and (re)schedules the background check. */
export async function setNewsAlerts(a: NewsAlerts) {
  try {
    localStorage.setItem(KEY, JSON.stringify(a));
  } catch {}
  await applyNewsAlerts(a);
}

// The alert's words in the app's language. {topic} and {source} are filled in on the phone.
type Labels = Record<string, string | Record<string, string>>;
function labels(): Labels {
  return {
    group: tr("News"),
    topics: Object.fromEntries(ALERT_TOPICS.map((t) => [t, topicNews(t)])),
    channel: tr("New stories in {topic}"),
    read: tr("Read"),
    save: tr("Save for later"),
    saved: tr("Saved to your Library"),
    savedIn: tr("In {topic} · readable offline"),
    tap: tr("{source} · tap to read in Stack"),
    test: tr("Test alert"),
  };
}

/** Sends the topics and the alert's words to the phone. Run again when the language changes. */
export async function applyNewsAlerts(a = getNewsAlerts()) {
  if (!isNative()) return;
  await NewsAlertsNative.configure({ on: a.on && a.topics.length > 0, feeds: alertFeeds(a.topics), labels: labels() });
}

export async function testNewsAlert() {
  await applyNewsAlerts();
  await NewsAlertsNative.test();
}

/**
 * Adds the stories saved from alerts to the Library: the card right away, then
 * the full story for offline reading. Returns how many were added.
 */
let busy: Promise<number> = Promise.resolve(0);
export function importAlertSaves() {
  busy = busy.then(async () => {
    if (!isNative()) return 0;
    const { items } = await NewsAlertsNative.takeSaves().catch(() => ({ items: [] as SavedFromAlert[] }));
    for (const it of items) {
      await addSaved({
        id: it.id,
        title: it.title,
        source: it.source,
        image: it.image || undefined,
        summary: it.summary || undefined,
        url: it.url,
        topic: TOPICS.some((x) => x.value === it.topic) ? it.topic : undefined,
        via: "alert",
      });
      // Confirm each one as it's saved, so none is lost or saved twice.
      await NewsAlertsNative.ackSaves({ count: 1 }).catch(() => {});
      keepOffline(it.id);
    }
    return items.length;
  });
  return busy;
}

/** Downloads a saved story to read offline, and puts its reading time on the card. */
export function keepOffline(id: string) {
  downloadArticle(id)
    .then(async (ok) => {
      if (!ok) return;
      const a = await getCachedArticle(id);
      const card = (await getSaved()).find((s) => s.id === id);
      if (a && card && !card.readMinutes) await updateSaved(id, { readMinutes: a.readMinutes });
    })
    .catch(() => {});
}
