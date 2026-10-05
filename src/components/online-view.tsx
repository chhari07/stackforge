"use client";

import { Marquee } from "./marquee";
import { useEffect, useRef, useState } from "react";
import { useOnlineMusic } from "./online-music-provider";
import {
  ClockIcon,
  CloseIcon,
  NextIcon,
  PauseIcon,
  PlayIcon,
  PrevIcon,
  SearchIcon,
} from "./icons";
import { SWATCHES } from "@/lib/swatches";
import { Vinyl } from "./vinyl";
import { mmss } from "@/lib/format";
import {
  GENRES,
  POPULAR,
  searchOnline,
  suggestOnline,
  trendingOnline,
  type OnlineTrack,
  type Suggestions,
} from "@/lib/audius";
import { useT } from "@/lib/i18n";

const RECENT_KEY = "stack.online-recent";

function readRecent(): string[] {
  try {
    const list = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
    return Array.isArray(list) ? list.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function writeRecent(list: string[]) {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(list));
  } catch {}
}

// Free music streamed from Audius: search, trending and genres.
export function OnlineView() {
  const tt = useT();
  const player = useOnlineMusic();
  const [query, setQuery] = useState("");
  const [genre, setGenre] = useState<string | null>(null);
  const [tracks, setTracks] = useState<OnlineTrack[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const req = useRef(0);
  const input = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);
  const [suggest, setSuggest] = useState<Suggestions | null>(null);
  const sreq = useRef(0);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRecent(readRecent());
  }, []);

  const remember = (term: string) => {
    const t = term.trim();
    if (!t) return;
    const next = [
      t,
      ...recent.filter((r) => r.toLowerCase() !== t.toLowerCase()),
    ].slice(0, 8);
    setRecent(next);
    writeRecent(next);
  };

  const forget = (term: string) => {
    const next = recent.filter((r) => r !== term);
    setRecent(next);
    writeRecent(next);
  };

  // Pick a suggestion: search for it and close the list.
  const choose = (term: string) => {
    setQuery(term);
    remember(term);
    input.current?.blur();
  };

  // Suggestions while typing (quicker than the full search).
  useEffect(() => {
    const q = query.trim();
    const id = ++sreq.current;
    if (!q || !focused) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSuggest(null);
      return;
    }
    const t = setTimeout(() => {
      suggestOnline(q)
        .then((r) => id === sreq.current && setSuggest(r))
        .catch(() => {});
    }, 150);
    return () => clearTimeout(t);
  }, [query, focused]);

  // Search as you type (debounced); trending when the box is empty.
  useEffect(() => {
    const q = query.trim();
    const id = ++req.current;
    const t = setTimeout(
      async () => {
        setBusy(true);
        try {
          const list = q
            ? await searchOnline(q)
            : await trendingOnline(genre ?? undefined);
          if (id === req.current) {
            setTracks(list);
            setError(null);
          }
        } catch (e) {
          if (id === req.current) setError((e as Error).message);
        } finally {
          if (id === req.current) setBusy(false);
        }
      },
      q ? 350 : 0,
    );
    return () => clearTimeout(t);
  }, [query, genre]);

  const t = player.track;
  const pct = player.duration
    ? Math.min(100, (player.position / player.duration) * 100)
    : 0;
  const word = t?.title.toUpperCase() || tt("ONLINE");

  return (
    <div className="">
      <div>
        <h1 className="display -ml-3 mt-3 text-[clamp(96px,35vw,160px)] tracking-[-0.045em]">
          <Marquee speed={90}>{word}</Marquee>
        </h1>
        <div className="mt-2.5 flex justify-between">
          <span className="label truncate text-[10px]">
            {t?.artist || tt("Free music, streamed")}
          </span>
          <span className="label text-[10px] text-muted">{tt("via Audius")}</span>
        </div>

        {t && (
          <>
            <div className="mt-5">
              <Vinyl
                cover={t.art}
                title={t.title}
                artist={t.artist}
                playing={player.playing}
                progress={pct / 100}
                trackKey={t.id}
                onToggle={player.toggle}
              />
            </div>
            <div className="mt-4 flex flex-col gap-1">
              <Marquee className="song text-[20px]">{t.title}</Marquee>
              <span className="label truncate text-[10px] text-muted">
                {[t.artist, t.genre].filter(Boolean).join(" · ")}
                {player.loading && " · Loading…"}
              </span>
            </div>
            <input
              type="range"
              aria-label={tt("Seek")}
              min={0}
              max={Math.max(1, player.duration)}
              value={Math.min(player.position, player.duration)}
              onChange={(e) => player.seek(Number(e.target.value))}
              className="mt-3 w-full accent-[var(--color-music)]"
              style={{
                background: `linear-gradient(to right, var(--color-music) ${pct}%, transparent ${pct}%)`,
              }}
            />
            <div className="label flex justify-between text-[10px] text-muted">
              <span>{mmss(player.position)}</span>
              <span>{mmss(player.duration)}</span>
            </div>
            <div className="mt-2 flex items-center justify-center gap-8">
              <button
                aria-label={tt("Previous track")}
                onClick={player.previous}
                className="flex size-12 items-center justify-center"
              >
                <PrevIcon size={22} />
              </button>
              <button
                aria-label={player.playing ? "Pause" : "Play"}
                onClick={player.toggle}
                className="flex size-16 items-center justify-center rounded-full bg-music text-white"
              >
                {player.playing ? (
                  <PauseIcon size={24} />
                ) : (
                  <PlayIcon size={24} />
                )}
              </button>
              <button
                aria-label={tt("Next track")}
                onClick={player.next}
                className="flex size-12 items-center justify-center"
              >
                <NextIcon size={22} />
              </button>
            </div>
            {player.error && (
              <p className="mt-2 text-center text-[12px] text-music-deep">
                {player.error}
              </p>
            )}
          </>
        )}
      </div>

      <div className="">
        <div className="relative mt-6">
          <label className="flex h-[46px] items-center gap-2.5 rounded-full border border-ink/12 bg-card px-4">
            <SearchIcon size={18} className="text-muted" />
            <input
              ref={input}
              aria-label={tt("Search free music")}
              type="search"
              enterKeyHint="search"
              autoComplete="off"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              onKeyDown={(e) => {
                if (e.key === "Enter") choose(query);
                if (e.key === "Escape") input.current?.blur();
              }}
              placeholder={tt("Search any song or artist")}
              className="grow bg-transparent text-[14px] outline-none"
            />
          </label>
          {focused && (
            <SuggestList
              query={query}
              recent={recent}
              suggest={suggest}
              onChoose={choose}
              onForget={forget}
              onPlay={(x) => {
                remember(query);
                input.current?.blur();
                player.play([x], 0);
              }}
            />
          )}
        </div>

        {!query.trim() && (
          <div className="-mx-5 mt-3 flex gap-2 overflow-x-auto px-5 pb-1">
            {[null, ...GENRES].map((g) => (
              <button
                key={g ?? "all"}
                onClick={() => setGenre(g)}
                className={`label h-8 shrink-0 rounded-full border px-3 text-[10px] ${genre === g ? "border-ink bg-ink text-on-ink" : "border-ink/15"}`}
              >
                {g ?? tt("Trending")}
              </button>
            ))}
          </div>
        )}

        <h2 className="label mt-4 text-[11px] font-medium text-music-text">
          {query.trim()
            ? busy
              ? tt("Searching…")
              : tt("{n} results", { n: tracks?.length ?? 0 })
            : genre
              ? tt("Trending in {genre}", { genre })
              : tt("Trending now")}
        </h2>

        {error && <p className="mt-4 text-[13px] text-music-deep">{error}</p>}
        {tracks && tracks.length === 0 && !busy && !error && (
          <p className="mt-4 text-[14px] text-muted">
            {tt("Nothing found. Try another name.")}
          </p>
        )}
        {!tracks && !error && (
          <p className="mt-4 text-[13px] text-muted">{tt("Loading…")}</p>
        )}

        <ol className="mt-1">
          {tracks?.map((x, i) => {
            const now = x.id === t?.id;
            return (
              <li key={x.id}>
                <button
                  onClick={() => {
                    if (query.trim()) remember(query);
                    player.play(tracks, i);
                  }}
                  className="flex h-14 w-full min-w-0 items-center gap-3 text-left"
                >
                  <span
                    className="relative flex size-10 shrink-0 items-center justify-center overflow-hidden text-[15px] font-bold text-white"
                    style={{
                      background:
                        SWATCHES[
                          (x.title.charCodeAt(0) || 0) % SWATCHES.length
                        ],
                    }}
                  >
                    {x.title.slice(0, 1).toUpperCase()}
                    {x.art && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={x.art}
                        alt=""
                        loading="lazy"
                        className="absolute inset-0 size-full object-cover"
                      />
                    )}
                    {now && player.playing && (
                      <span className="absolute inset-0 flex items-center justify-center bg-black/45">
                        ▶
                      </span>
                    )}
                  </span>
                  <span className="flex min-w-0 grow flex-col">
                    <span
                      className={`song truncate text-[15px] ${now ? "text-music-text" : ""}`}
                    >
                      {x.title}
                    </span>
                    <span className="label truncate text-[9px] text-muted">
                      {[x.artist, x.genre].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                  <span className="label text-[10px]">{mmss(x.duration)}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}

// Dropdown under the search box: recent searches and popular picks when empty;
// matching recents, songs (tap to play) and artists while typing.
function SuggestList({
  query,
  recent,
  suggest,
  onChoose,
  onForget,
  onPlay,
}: {
  query: string;
  recent: string[];
  suggest: Suggestions | null;
  onChoose: (term: string) => void;
  onForget: (term: string) => void;
  onPlay: (track: OnlineTrack) => void;
}) {
  const tt = useT();
  const q = query.trim().toLowerCase();
  const recents = (
    q
      ? recent.filter(
          (r) => r.toLowerCase().includes(q) && r.toLowerCase() !== q,
        )
      : recent
  ).slice(0, q ? 3 : 6);
  const popular = q
    ? POPULAR.filter((p) => p.startsWith(q) && p !== q).slice(0, 3)
    : POPULAR;
  const tracks = q ? (suggest?.tracks ?? []) : [];
  const artists = q ? (suggest?.artists ?? []) : [];
  if (!recents.length && !popular.length && !tracks.length && !artists.length)
    return null;

  // Keep the input focused while tapping, so the tap lands.
  const keep = (e: React.PointerEvent | React.MouseEvent) => e.preventDefault();
  const row = "flex h-11 w-full min-w-0 items-center gap-3 px-4 text-left";

  return (
    <div
      role="listbox"
      aria-label={tt("Search suggestions")}
      onPointerDown={keep}
      onMouseDown={keep}
      className="absolute inset-x-0 top-[52px] z-50 max-h-[60dvh] overflow-y-auto rounded-2xl border border-ink/10 bg-card py-2 shadow-[0_12px_32px_rgba(0,0,0,.18)]"
    >
      {recents.map((r) => (
        <div key={`r-${r}`} className="flex items-center">
          <button
            role="option"
            aria-selected={false}
            onClick={() => onChoose(r)}
            className={row}
          >
            <ClockIcon size={16} className="shrink-0 text-muted" />
            <span className="truncate text-[14px]">{r}</span>
          </button>
          <button
            aria-label={tt("Remove {name} from recent searches", { name: r })}
            onClick={() => onForget(r)}
            className="flex size-11 shrink-0 items-center justify-center text-muted"
          >
            <CloseIcon size={14} />
          </button>
        </div>
      ))}

      {tracks.map((t) => (
        <button
          key={`t-${t.id}`}
          role="option"
          aria-selected={false}
          onClick={() => onPlay(t)}
          className={`${row} h-14`}
        >
          <span className="relative size-9 shrink-0 overflow-hidden rounded bg-music">
            {t.art && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={t.art} alt="" className="size-full object-cover" />
            )}
          </span>
          <span className="flex min-w-0 grow flex-col">
            <span className="song truncate text-[14px]">{t.title}</span>
            <span className="label truncate text-[9px] text-muted">
              {t.artist}
            </span>
          </span>
          <PlayIcon size={16} className="shrink-0 text-music-text" />
        </button>
      ))}

      {artists.map((a) => (
        <button
          key={`a-${a}`}
          role="option"
          aria-selected={false}
          onClick={() => onChoose(a)}
          className={row}
        >
          <span className="label shrink-0 text-[9px] text-muted">ARTIST</span>
          <span className="truncate text-[14px]">{a}</span>
        </button>
      ))}

      {popular.length > 0 && (
        <div className="px-4 pt-2 pb-1">
          {!q && <p className="label mb-2 text-[10px] text-muted">Try</p>}
          <div className="flex flex-wrap gap-2">
            {popular.map((p) => (
              <button
                key={`p-${p}`}
                onClick={() => onChoose(p)}
                className="label h-8 rounded-full border border-ink/15 px-3 text-[10px]"
              >
                <SearchIcon size={12} className="mr-1 inline align-[-2px]" />
                {p}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
