"use client";

// What you follow and what you mute in News: words to follow across every
// topic, and words and sources you don't want to see. Kept on this device
// (and in backups); nothing is sent anywhere.
import { emit } from "./db";
import type { Story } from "./news";

const KEY = "stack.news-prefs";

export type NewsPrefs = { follows: string[]; mutedWords: string[]; mutedSources: string[] };
export const NO_PREFS: NewsPrefs = { follows: [], mutedWords: [], mutedSources: [] };

export async function getNewsPrefs(): Promise<NewsPrefs> {
  try {
    return { ...NO_PREFS, ...JSON.parse(localStorage.getItem(KEY) ?? "{}") };
  } catch {
    return NO_PREFS;
  }
}

async function change(fn: (p: NewsPrefs) => NewsPrefs) {
  const next = fn(await getNewsPrefs());
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {}
  emit();
}

const tidy = (word: string) => word.replace(/\s+/g, " ").trim().slice(0, 40);
const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
const add = (list: string[], word: string) => (!word || list.some((w) => same(w, word)) ? list : [...list, word]);
const drop = (list: string[], word: string) => list.filter((w) => !same(w, word));

export type PrefList = keyof NewsPrefs;
export const addPref = (list: PrefList, word: string) => change((p) => ({ ...p, [list]: add(p[list], tidy(word)) }));
export const removePref = (list: PrefList, word: string) => change((p) => ({ ...p, [list]: drop(p[list], word) }));

// A word matches as a whole word ("AI" doesn't match "said"), whatever its case.
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
function matcher(words: string[]) {
  if (!words.length) return null;
  try {
    return new RegExp(`(?<![\\p{L}\\p{N}])(${words.map(escape).join("|")})(?![\\p{L}\\p{N}])`, "iu");
  } catch {
    // An older browser without look-behind: match anywhere.
    return new RegExp(words.map(escape).join("|"), "i");
  }
}
const textOf = (s: Story) => `${s.title} ${s.summary ?? ""}`;

/** Leaves out stories from muted sources and stories with a muted word. */
export function unmuted(stories: Story[], prefs: NewsPrefs) {
  const words = matcher(prefs.mutedWords);
  const sources = new Set(prefs.mutedSources.map((s) => s.toLowerCase()));
  if (!words && !sources.size) return stories;
  return stories.filter((s) => !sources.has(s.source.toLowerCase()) && !words?.test(textOf(s)));
}

/** Only the stories about something you follow. */
export function followed(stories: Story[], prefs: NewsPrefs) {
  const words = matcher(prefs.follows);
  return words ? stories.filter((s) => words.test(textOf(s))) : [];
}
