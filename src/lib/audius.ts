import { tr } from "./i18n";
// Free, full-length music from Audius (audius.co): an open catalogue with a
// public API that needs no key and allows browser requests, so it works on
// the website and inside the Android app alike.

const APP = "stack";
const DISCOVERY = "https://api.audius.co";

export type OnlineTrack = {
  id: string;
  title: string;
  artist: string;
  art: string | null;
  duration: number; // ms
  genre?: string;
};

type RawTrack = {
  id: string;
  title: string;
  duration: number;
  genre?: string;
  artwork?: Record<string, string> | null;
  user?: { name?: string };
  access?: { stream?: boolean };
  stream_conditions?: unknown;
};

let host: Promise<string> | null = null;

// Audius lists its API hosts; pick one and keep it for the session.
function apiHost() {
  host ??= fetch(DISCOVERY)
    .then((r) => r.json())
    .then((j: { data?: string[] }) => {
      const list = j.data?.length ? j.data : [DISCOVERY];
      return list[Math.floor(Math.random() * list.length)];
    })
    .catch(() => DISCOVERY);
  return host;
}

async function get<T = { data?: RawTrack[] }>(path: string, params: Record<string, string | number> = {}) {
  const q = new URLSearchParams({ app_name: APP, ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])) });
  let base = await apiHost();
  let res = await fetch(`${base}/v1${path}?${q}`).catch(() => null);
  // A bad host: fall back to the main one once.
  if (!res?.ok && base !== DISCOVERY) {
    host = Promise.resolve(DISCOVERY);
    base = DISCOVERY;
    res = await fetch(`${base}/v1${path}?${q}`);
  }
  if (!res?.ok) throw new Error(tr("Online music is unreachable right now."));
  return (await res.json()) as T;
}

// Only tracks anyone can stream in full (no paywalls or token gates).
const toTracks = (raw: RawTrack[] = []): OnlineTrack[] =>
  raw
    .filter((t) => t.access?.stream !== false && !t.stream_conditions)
    .map((t) => ({
      id: t.id,
      title: t.title,
      artist: t.user?.name ?? tr("Unknown artist"),
      art: t.artwork?.["480x480"] ?? t.artwork?.["150x150"] ?? null,
      duration: (t.duration ?? 0) * 1000,
      genre: t.genre,
    }));

export async function searchOnline(query: string) {
  const { data } = await get("/tracks/search", { query, limit: 40 });
  return toTracks(data);
}

export async function trendingOnline(genre?: string) {
  const { data } = await get("/tracks/trending", genre ? { genre, limit: 40 } : { limit: 40 });
  return toTracks(data);
}

export type Suggestions = { tracks: OnlineTrack[]; artists: string[] };

// Matches for a half-typed word: songs and artists, for the search box.
export async function suggestOnline(query: string): Promise<Suggestions> {
  const { data } = await get<{ data?: { tracks?: RawTrack[]; users?: { name: string; track_count?: number }[] } }>(
    "/search/autocomplete",
    { query, limit: 6 },
  );
  return {
    tracks: toTracks(data?.tracks).slice(0, 5),
    artists: [...new Set((data?.users ?? []).filter((u) => (u.track_count ?? 0) > 0).map((u) => u.name))].slice(0, 3),
  };
}

// Starting points shown under an empty search box.
export const POPULAR = ["lofi", "bollywood", "punjabi", "arijit singh", "chill", "study beats", "devotional", "remix", "piano", "workout"];

export async function streamUrl(id: string) {
  return `${await apiHost()}/v1/tracks/${id}/stream?app_name=${APP}`;
}

export const GENRES = ["Lo-Fi", "Electronic", "Hip-Hop/Rap", "Pop", "Ambient", "Classical", "Acoustic", "Jazz", "World"];
