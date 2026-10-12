// Live Indian news on YouTube, trending topics in India, and your own channels.
// All free and without API keys:
// - Live: a channel's /live page names the stream it's showing right now.
// - Videos: each channel's public feed (lib/news.ts parseChannel).
// - Trending: Google Trends' daily feed for India.
// Everything plays in YouTube's own player (app/watch). The website reads
// these pages through /api/yt; the Android app reads them directly.
import { parseChannel, type Story } from "./news";

export type Channel = { id: string; name: string; lang?: "hi" | "en" };
type GetText = (url: string) => Promise<string | null>;

export const isChannelId = (id: string) => /^UC[\w-]{22}$/.test(id);

// Well-known 24×7 Indian news channels. Their IDs were checked against each
// channel's own feed.
export const INDIA_CHANNELS: Channel[] = [
  { id: "UCKwucPzHZ7zCUIf7If-Wo1g", name: "DD News", lang: "hi" },
  { id: "UCt4t-jeY85JegMlZ-E5UWtA", name: "Aaj Tak", lang: "hi" },
  { id: "UC9CYT9gSNLevX5ey2_6CK0Q", name: "NDTV India", lang: "hi" },
  { id: "UCRWFSbif-RFENbBrSiez1DA", name: "ABP News", lang: "hi" },
  { id: "UCttspZesZIDEwwpVIgoZtWQ", name: "India TV", lang: "hi" },
  { id: "UCIvaYmXn910QMdemBG3v1pQ", name: "Zee News", lang: "hi" },
  { id: "UCZFMm1mMw0F81Z37aaEzTUA", name: "NDTV 24x7", lang: "en" },
  { id: "UCYPvAwZP8pZhSMW8qs7cVCw", name: "India Today", lang: "en" },
  { id: "UC_gUM8rL-Lrg6O3adPW9K1g", name: "WION", lang: "en" },
  { id: "UC6RJ7-PaXg6TIH2BzZfTV7w", name: "Times Now", lang: "en" },
  { id: "UCwqusr8YDwM-3mEYTDeJHzw", name: "Republic World", lang: "en" },
];

// Independent news, offered in "Add a channel" and only added when the person
// picks them. Chosen from across the spectrum, listed A–Z.
export const SUGGESTED_CHANNELS: Channel[] = [
  { id: "UCustbySVJGb659WDpdkeATg", name: "Newslaundry" },
  { id: "UCWt3UbeNDgNd97-VREMtS4g", name: "OpIndia" },
  { id: "UCrdPiSPVW0rtRsI002BX8iw", name: "Mojo Story" },
  { id: "UC0yXUUIaPVAqZLgRjvtMftw", name: "Ravish Kumar Official" },
  { id: "UCvXXqqFxmyI0YFewhOMJqxQ", name: "Swarajya" },
  { id: "UCZjxPbi3AeB6YGKCfQ2TroQ", name: "The Jaipur Dialogues" },
  { id: "UCx8Z14PpntdaxCt2hakbQLQ", name: "The Lallantop" },
  { id: "UChWtJey46brNr7qHQpN6KLQ", name: "The Wire" },
  { id: "UCuyRsHZILrU7ZDIAbGASHdA", name: "ThePrint" },
].sort((a, b) => a.name.localeCompare(b.name));

const decode = (s: string) =>
  s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .trim();

// ---- Live now ----

export type LiveNow = { channel: Channel; video: string; title: string; embeddable: boolean };

/** What a channel's /live page is showing, or null when it isn't live. */
export function parseLivePage(html: string): Omit<LiveNow, "channel"> | null {
  const video = html.match(/<link rel="canonical" href="https:\/\/www\.youtube\.com\/watch\?v=([\w-]{11})"/)?.[1];
  if (!video || !/"isLive":true/.test(html)) return null;
  const title = decode(html.match(/<meta property="og:title" content="([^"]*)"/)?.[1] ?? "");
  return { video, title, embeddable: !/"playableInEmbed":false/.test(html) };
}

export async function liveNow(channels: Channel[], getText: GetText): Promise<LiveNow[]> {
  const found = await Promise.all(
    channels.map(async (channel) => {
      const html = await getText(`https://www.youtube.com/channel/${channel.id}/live`).catch(() => null);
      const live = html ? parseLivePage(html) : null;
      return live ? { channel, ...live } : null;
    }),
  );
  return found.filter((l): l is LiveNow => l !== null);
}

// ---- Videos ----

export async function channelVideos(channels: Channel[], getText: GetText, each = 8): Promise<Story[]> {
  const lists = await Promise.all(
    channels.map(async (c) => {
      const xml = await getText(`https://www.youtube.com/feeds/videos.xml?channel_id=${c.id}`).catch(() => null);
      return xml ? parseChannel(xml, c.name).slice(0, each) : [];
    }),
  );
  return lists.flat().sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

// ---- Your own channels: a link, an @handle or a channel id ----

export function channelUrl(input: string): string | null {
  const s = input.trim();
  if (isChannelId(s)) return `https://www.youtube.com/channel/${s}`;
  const handle = s.match(/^@?([\w.-]{3,30})$/)?.[1];
  if (handle) return `https://www.youtube.com/@${handle}`;
  try {
    const u = new URL(/^https?:/i.test(s) ? s : `https://${s}`);
    if (!/(^|\.)youtube\.com$/i.test(u.hostname)) return null;
    const id = u.pathname.match(/^\/channel\/(UC[\w-]{22})/)?.[1];
    if (id) return `https://www.youtube.com/channel/${id}`;
    const h = u.pathname.match(/^\/@([\w.-]{3,30})/)?.[1];
    return h ? `https://www.youtube.com/@${h}` : null;
  } catch {
    return null;
  }
}

/** The channel a page belongs to: its id (from the page's own feed link) and name. */
export function channelFromPage(html: string): Channel | null {
  const id = html.match(/feeds\/videos\.xml\?channel_id=(UC[\w-]{22})/)?.[1];
  const name = decode(html.match(/<meta property="og:title" content="([^"]*)"/)?.[1] ?? "");
  return id && name ? { id, name } : null;
}

export async function resolveChannel(input: string, getText: GetText): Promise<Channel | null> {
  const url = channelUrl(input);
  const html = url ? await getText(url).catch(() => null) : null;
  return html ? channelFromPage(html) : null;
}

// ---- Trending in India ----

export type Trend = {
  tag: string; // "#IndiaAustraliaOdiMatch"
  query: string; // what was searched: "india australia odi match"
  traffic?: string; // "200+"
  picture?: string;
  news: { title: string; url: string; source: string }[];
};

// Searches in other scripts (Bengali, Tamil, Telugu…) and daily routines
// (horoscopes, lottery results) aren't news for this list.
const OTHER_SCRIPT = /[ঀ-෿]/;
const NOT_NEWS = /horoscope|rashifal|राशिफल|lottery|lotto|satta|matka|wordle|weather today/i;

export const hashtag = (q: string) =>
  "#" +
  q
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => (/^[a-z]/i.test(w) ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w))
    .join("")
    .replace(/[^\p{L}\p{M}\p{N}]/gu, "")
    .slice(0, 32);

export function parseTrends(xml: string): Trend[] {
  const out: Trend[] = [];
  for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const item = m[1];
    const query = decode(item.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? "");
    if (!query || OTHER_SCRIPT.test(query) || NOT_NEWS.test(query)) continue;
    const news = [...item.matchAll(/<ht:news_item>([\s\S]*?)<\/ht:news_item>/g)]
      .map((n) => ({
        title: decode(n[1].match(/<ht:news_item_title>([\s\S]*?)<\/ht:news_item_title>/)?.[1] ?? ""),
        url: decode(n[1].match(/<ht:news_item_url>([\s\S]*?)<\/ht:news_item_url>/)?.[1] ?? ""),
        source: decode(n[1].match(/<ht:news_item_source>([\s\S]*?)<\/ht:news_item_source>/)?.[1] ?? ""),
      }))
      .filter((n) => n.title && /^https:\/\//.test(n.url));
    // Only searches the news is covering.
    if (!news.length) continue;
    out.push({
      tag: hashtag(query),
      query,
      traffic: decode(item.match(/<ht:approx_traffic>([\s\S]*?)<\/ht:approx_traffic>/)?.[1] ?? "") || undefined,
      picture: decode(item.match(/<ht:picture>([\s\S]*?)<\/ht:picture>/)?.[1] ?? "") || undefined,
      news: news.slice(0, 4),
    });
  }
  return out;
}

export const TRENDS_URL = "https://trends.google.com/trending/rss?geo=IN";

export async function trends(getText: GetText): Promise<Trend[]> {
  const xml = await getText(TRENDS_URL).catch(() => null);
  return xml ? parseTrends(xml) : [];
}

// ---- Matching a topic to titles ----

const STOP = new Set(
  "the and for with from that this into over about after what when where will have has are was were its their they news live today latest india update updates video vs के की का में है और से को पर ने भी लाइव".split(" "),
);

/** The words worth matching in `text`, lower-cased. */
export function keywords(text: string) {
  return [
    ...new Set(
      text
        .toLowerCase()
        .replace(/[^\p{L}\p{M}\p{N}\s]/gu, " ")
        .split(/\s+/)
        .filter((w) => w.length >= 3 && !STOP.has(w)),
    ),
  ];
}

/** How well `title` matches the words: 0 is no match. Needs two words when there are two to find. */
export function matchScore(title: string, words: string[]) {
  if (!words.length) return 0;
  const t = title.toLowerCase();
  const hits = words.filter((w) => t.includes(w)).length;
  return hits >= Math.min(2, words.length) ? hits / words.length : 0;
}

/** Only these addresses may go through the website's /api/yt. */
export function allowedYtUrl(url: string) {
  return (
    url === TRENDS_URL ||
    /^https:\/\/www\.youtube\.com\/channel\/UC[\w-]{22}(\/live)?$/.test(url) ||
    /^https:\/\/www\.youtube\.com\/feeds\/videos\.xml\?channel_id=UC[\w-]{22}$/.test(url) ||
    /^https:\/\/www\.youtube\.com\/@[\w.-]{3,30}$/.test(url)
  );
}
