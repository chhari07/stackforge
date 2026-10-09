"use client";

// Word meanings for the reader: English definitions from Wiktionary and a
// Hindi meaning from MyMemory. Only the word you look up is sent, straight
// from this device; there is no account and no key.

export type Meaning = { part: string; definition: string };
export type WordEntry = { word: string; meanings: Meaning[]; hindi?: string };

// One word (letters, with an apostrophe or hyphen inside): what "Meaning" works on.
export const asWord = (text: string) => {
  const t = text.trim().replace(/^[^\p{L}]+|[^\p{L}]+$/gu, "");
  return /^\p{L}[\p{L}'’-]{1,29}$/u.test(t) ? t : null;
};

// Wiktionary definitions come as HTML; keep the words only (not the style
// sheets some carry). A parsed document is inert, and the text is never put
// back into the page as HTML.
const plain = (html: string) => {
  const body = new DOMParser().parseFromString(html, "text/html").body;
  body.querySelectorAll("style, script").forEach((el) => el.remove());
  return (body.textContent ?? "").replace(/\s+/g, " ").trim();
};

type WikiSense = { partOfSpeech: string; definitions: { definition: string }[] };

async function english(word: string): Promise<Meaning[]> {
  const res = await fetch(`https://en.wiktionary.org/api/rest_v1/page/definition/${encodeURIComponent(word)}`);
  if (!res.ok) return [];
  const senses: WikiSense[] = (await res.json()).en ?? [];
  const out: Meaning[] = [];
  for (const s of senses) {
    // The first two senses of each part of speech are the common ones.
    for (const d of s.definitions.slice(0, 2)) {
      const definition = plain(d.definition);
      if (definition) out.push({ part: s.partOfSpeech.toLowerCase(), definition });
    }
  }
  return out.slice(0, 4);
}

async function hindi(word: string): Promise<string | undefined> {
  const res = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(word)}&langpair=en|hi`);
  if (!res.ok) return undefined;
  const text: string | undefined = (await res.json()).responseData?.translatedText;
  // No match comes back as the same word, or as a quota notice in capitals.
  if (!text || text.toLowerCase() === word.toLowerCase() || !/[ऀ-ॿ]/.test(text)) return undefined;
  return text.trim();
}

const cache = new Map<string, WordEntry>();

/** Looks a word up. Null when neither source knows it; throws when offline. */
export async function lookup(word: string): Promise<WordEntry | null> {
  const key = word.toLowerCase();
  const hit = cache.get(key);
  if (hit) return hit;
  const [en, hi] = await Promise.allSettled([english(key).then((m) => (m.length || key === word ? m : english(word))), hindi(key)]);
  if (en.status === "rejected" && hi.status === "rejected") throw en.reason;
  const meanings = en.status === "fulfilled" ? en.value : [];
  const hindiText = hi.status === "fulfilled" ? hi.value : undefined;
  if (!meanings.length && !hindiText) return null;
  const entry = { word: key, meanings, hindi: hindiText };
  cache.set(key, entry);
  return entry;
}

// What a saved word keeps as its note text.
export const entryText = (e: WordEntry) =>
  [...e.meanings.slice(0, 2).map((m) => `(${m.part}) ${m.definition}`), e.hindi && `हिंदी: ${e.hindi}`].filter(Boolean).join("\n");
