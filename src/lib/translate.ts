"use client";

// Free article translation for the reader: Google's public translate endpoint
// (the one its Chrome extension uses; no key, no account), with MyMemory as a
// fallback. Only the article's text is sent, straight from this device.

export const LANGS = {
  hi: "हिंदी · Hindi",
  bn: "বাংলা · Bengali",
  mr: "मराठी · Marathi",
  te: "తెలుగు · Telugu",
  ta: "தமிழ் · Tamil",
  gu: "ગુજરાતી · Gujarati",
  kn: "ಕನ್ನಡ · Kannada",
  ml: "മലയാളം · Malayalam",
  pa: "ਪੰਜਾਬੀ · Punjabi",
  or: "ଓଡ଼ିଆ · Odia",
  ur: "اردو · Urdu",
  es: "Español · Spanish",
  fr: "Français · French",
  de: "Deutsch · German",
  pt: "Português · Portuguese",
  ru: "Русский · Russian",
  ar: "العربية · Arabic",
  "zh-CN": "中文 · Chinese",
  ja: "日本語 · Japanese",
  ko: "한국어 · Korean",
} as const;
export type Lang = keyof typeof LANGS;

// The short native name, for buttons ("हिंदी", "Español").
export const langName = (l: Lang) => LANGS[l].split(" · ")[0];

// Groups texts into requests of at most ~4000 characters.
function batches(texts: string[], max = 4000) {
  const out: string[][] = [];
  let cur: string[] = [];
  let size = 0;
  for (const t of texts) {
    if (cur.length && size + t.length > max) {
      out.push(cur);
      cur = [];
      size = 0;
    }
    cur.push(t);
    size += t.length;
  }
  if (cur.length) out.push(cur);
  return out;
}

async function google(texts: string[], to: Lang): Promise<string[]> {
  const body = new URLSearchParams();
  for (const t of texts) body.append("q", t);
  const res = await fetch(`https://clients5.google.com/translate_a/t?client=dict-chrome-ex&sl=auto&tl=${to}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      // In the app, requests go out natively as "Dalvik/…", which Google turns
      // away; a browser's own fetch ignores this and sends its real one.
      "User-Agent": "Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Mobile Safari/537.36",
    },
    body: body.toString(), // a string: the app's native HTTP doesn't send URLSearchParams
  });
  if (!res.ok) throw new Error(`translate ${res.status}`);
  // Each item is ["translation", "detected language"], or just the translation.
  const data: (string | [string, string])[] = await res.json();
  if (!Array.isArray(data) || data.length !== texts.length) throw new Error("translate: bad reply");
  return data.map((d) => (Array.isArray(d) ? d[0] : d));
}

// MyMemory takes up to 500 characters a request, so long text goes by sentence.
async function myMemory(text: string, to: Lang): Promise<string> {
  const parts = text.match(/[^.!?]+[.!?]*\s*/g) ?? [text];
  const chunks: string[] = [];
  for (const p of parts) {
    const last = chunks.length - 1;
    if (last >= 0 && chunks[last].length + p.length <= 450) chunks[last] += p;
    else chunks.push(p.slice(0, 450));
  }
  const out: string[] = [];
  for (const c of chunks) {
    const res = await fetch(
      `https://api.mymemory.translated.net/get?q=${encodeURIComponent(c)}&langpair=en|${to.split("-")[0]}`,
    );
    const json = await res.json();
    if (!res.ok || json.quotaFinished) throw new Error("translate: limit reached");
    out.push(json.responseData?.translatedText ?? c);
  }
  return out.join(" ");
}

async function translateTexts(texts: string[], to: Lang): Promise<string[]> {
  const out: string[] = [];
  for (const b of batches(texts)) {
    try {
      out.push(...(await google(b, to)));
    } catch (e) {
      console.warn("Google Translate failed, using MyMemory", e);
      for (const t of b) out.push(await myMemory(t, to));
    }
  }
  return out;
}

// Text blocks of an article: paragraphs, headings, list items… (only the
// innermost ones, so nothing is translated twice).
const BLOCKS = "p, h1, h2, h3, h4, h5, h6, li, blockquote, figcaption, td, th, dt, dd, pre";

export type Translated = { title: string; html: string; lang: Lang };
const cache = new Map<string, Translated>();

/** Translates an article's title and body. Inline links and bold become plain text. */
export async function translateArticle(id: string, title: string, html: string, to: Lang): Promise<Translated> {
  const key = `${id}:${to}`;
  const hit = cache.get(key);
  if (hit) return hit;

  // A parsed document is inert; translations go back in as text, never as HTML.
  const doc = new DOMParser().parseFromString(html, "text/html");
  const blocks = [...doc.body.querySelectorAll<HTMLElement>(BLOCKS)].filter(
    (el) => !el.querySelector(BLOCKS) && el.textContent?.trim(),
  );
  const texts = blocks.map((el) => el.textContent!.replace(/\s+/g, " ").trim());
  const [tTitle, ...tBlocks] = await translateTexts([title, ...texts], to);
  blocks.forEach((el, i) => (el.textContent = tBlocks[i]));

  const result = { title: tTitle, html: doc.body.innerHTML, lang: to };
  cache.set(key, result);
  return result;
}
