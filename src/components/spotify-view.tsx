"use client";
/* eslint-disable @next/next/no-img-element -- artwork comes from Spotify URLs */

import { Marquee } from "./marquee";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useSpotify } from "./spotify-provider";
import { SpotifyLoginNote, SpotifySetup, SpotifyTroubleshooting } from "./spotify-setup";
import { useToast } from "./toast";
import { NoteIcon, RepeatIcon } from "./icons";
import { ModeButton } from "./local-view";
import { Vinyl } from "./vinyl";
import { addNote } from "@/lib/db";
import { mmss } from "@/lib/format";
import {
  api,
  art,
  artists,
  login,
  type SpPlaylist,
  type SpTrack,
} from "@/lib/spotify";
import { HeartFilledIcon } from "./stack-icons";
import { ConnectionDot } from "./connection-dot";
import { useT } from "@/lib/i18n";

type Queue = { queue: SpTrack[] };
type Recent = { items: { track: SpTrack; played_at: string }[] };

export const SWATCHES = [
  "#5B3F7A",
  "#C8321F",
  "#2C3E57",
  "#2F4B3A",
  "#F2C230",
  "#54473A",
];

export function SpotifyView() {
  const tt = useT();
  const sp = useSpotify();
  const toast = useToast();
  const [playlists, setPlaylists] = useState<SpPlaylist[]>([]);
  const [queue, setQueue] = useState<SpTrack[]>([]);
  const [recent, setRecent] = useState<SpTrack[]>([]);
  const [contextName, setContextName] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const track = sp.player?.item ?? null;
  const contextUri = sp.player?.context?.uri;

  useEffect(() => {
    if (!sp.connected) return;
    api<{ items: SpPlaylist[] }>("/me/playlists?limit=50")
      .then((d) => {
        setPlaylists((d?.items ?? []).filter(Boolean));
        setLoadError(null);
      })
      .catch((e: Error) => setLoadError(e.message));
    api<Recent>("/me/player/recently-played?limit=10")
      .then((d) => {
        const seen = new Set<string>();
        setRecent(
          (d?.items ?? [])
            .map((i) => i.track)
            .filter((t) => !seen.has(t.id) && seen.add(t.id)),
        );
      })
      .catch(() => {});
  }, [sp.connected]);

  // What's up next changes whenever the track changes.
  useEffect(() => {
    if (!sp.connected || !track) return;
    api<Queue>("/me/player/queue")
      .then((d) => setQueue(d?.queue ?? []))
      .catch(() => setQueue([]));
  }, [sp.connected, track?.id, track]);

  // Name the big wordmark after the playlist that's playing.
  useEffect(() => {
    if (!contextUri?.startsWith("spotify:playlist:")) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setContextName(null);
      return;
    }
    const pid = contextUri.split(":")[2];
    const known = playlists.find((p) => p.id === pid);
    if (known) return setContextName(known.name);
    api<{ name: string }>(`/playlists/${pid}?fields=name`)
      .then((d) => setContextName(d?.name ?? null))
      .catch(() => setContextName(null));
  }, [contextUri, playlists]);

  const word = (contextName ?? track?.album.name ?? tt("Music")).toUpperCase();
  const list = queue.length ? queue : recent;
  const listTitle = queue.length ? tt("Up next") : tt("Recently played");
  const cover = track ? art(track.album.images, true) : undefined;

  const noteTrack = async () => {
    if (!track) return;
    await addNote({
      kind: "music",
      body: tt("Listening to {track} — {artist}", { track: track.name, artist: artists(track) }),
      sourceTitle: track.name,
      sourceLabel: "Spotify",
      href: "/music",
    });
    toast({ text: tt("Track saved to Notes"), href: "/notes" });
  };

  return (
    <div className="">
      {/* Tablets: now playing on the left, queue and playlists on the right */}
      <div>
        <h1 className="display -ml-3 mt-3 text-[clamp(96px,35vw,160px)] tracking-[-0.045em]">
          <Marquee speed={90}>{sp.connected ? word : "FOCUS"}</Marquee>
        </h1>
        <div className="mt-2.5 flex justify-between">
          <span className="label truncate text-[10px]">
            {contextName ?? (track ? track.album.name : tt("Music while you read"))}
          </span>
          {sp.connected ? (
            <button
              onClick={sp.disconnect}
              className="label flex items-center gap-1.5 text-[10px]"
            >
              <ConnectionDot state={sp.reachable ? "ok" : "unreachable"} />{" "}
              {sp.reachable ? tt("Connected") : tt("Can’t reach Spotify")} · {tt("Log out")}
            </button>
          ) : sp.lost ? (
            <span className="label flex items-center gap-1.5 text-[10px]">
              <ConnectionDot state="lost" /> {tt("Logged out")}
            </span>
          ) : (
            <span className="label text-[10px]">
              {track ? mmss(track.duration_ms) : ""}
            </span>
          )}
        </div>

        {!sp.configured && <SpotifySetup />}

        {sp.configured && !sp.connected && (
          <div className="mt-8 flex flex-col items-start gap-4">
            <p className="text-[15px] leading-relaxed text-muted">
              {sp.lost
                ? tt("Spotify ended Stack’s login (it was removed in your Spotify account, or it expired). Reconnect to pick up where you left off.")
                : tt("Log in to see your playlists and Liked Songs, what’s playing, and control it while you read.")}
            </p>
            <button
              onClick={login}
              className="flex h-14 items-center gap-2 rounded-full bg-[#1DB954] px-6 text-[16px] font-semibold text-black"
            >
              {sp.lost ? tt("Reconnect Spotify") : tt("Connect Spotify")}
            </button>
            {sp.error && (
              <p className="text-[13px] text-music-deep">{sp.error}</p>
            )}
            <SpotifyLoginNote />
            <SpotifyTroubleshooting />
            <Link
              href="/settings"
              className="label text-[10px] text-muted underline"
            >
              {tt("Use a different Spotify app (Client ID)")}
            </Link>
          </div>
        )}

        {sp.connected && (
          <>
            <span className="label mt-[18px] block text-[10px]">01</span>
            {track ? (
              <div className="mt-1.5">
                <Vinyl
                  cover={cover}
                  title={track.name}
                  artist={artists(track)}
                  playing={!!sp.player?.is_playing}
                  progress={track.duration_ms ? sp.progress / track.duration_ms : 0}
                  trackKey={track.id}
                  onToggle={sp.toggle}
                />
              </div>
            ) : (
              <div className="mt-1.5 flex size-[230px] items-center justify-center bg-music p-6 text-center shadow-[0_10px_24px_rgba(0,0,0,.18)]">
                <span className="label text-[11px] text-white">
                  {tt("Silence is fine. Music is better. Start Spotify on a device or pick a playlist below.")}
                </span>
              </div>
            )}

            <div className="mt-3 flex items-start justify-between gap-3">
              <div className="flex min-w-0 flex-col gap-0.5">
                <Marquee className="song text-[20px]">
                  {track?.name ?? "—"}
                </Marquee>
                <span className="label truncate text-[10px] text-muted">
                  {track ? artists(track) : ""}
                </span>
              </div>
              {track && (
                <ModeButton
                  label={
                    sp.player?.repeat_state === "track"
                      ? "Repeat: this song"
                      : sp.player?.repeat_state === "context"
                        ? "Repeat: all songs"
                        : "Repeat: off"
                  }
                  on={!!sp.player?.repeat_state && sp.player.repeat_state !== "off"}
                  onClick={sp.cycleRepeat}
                >
                  <RepeatIcon size={22} one={sp.player?.repeat_state === "track"} />
                </ModeButton>
              )}
              {track && (
                <button
                  onClick={noteTrack}
                  aria-label={tt("Save this track to notes")}
                  className="flex size-11 shrink-0 items-center justify-center rounded-full border border-ink/15"
                >
                  <NoteIcon size={18} />
                </button>
              )}
            </div>

            {sp.error && (
              <p
                role="alert"
                className="mt-3 rounded-xl bg-music-tint px-3.5 py-2.5 text-[13px] text-music-deep"
              >
                {sp.error}
              </p>
            )}
            {sp.status && (
              <p
                role="status"
                className="mt-3 rounded-xl bg-news-tint px-3.5 py-2.5 text-[13px] text-news-deep"
              >
                {sp.status}
              </p>
            )}
            {loadError && (
              <p
                role="alert"
                className="mt-3 rounded-xl bg-music-tint px-3.5 py-2.5 text-[13px] text-music-deep"
              >
                {tt("Couldn’t load your playlists: {error}. If this says “not registered”, add your account in the Spotify app’s User Management.", { error: loadError })}
              </p>
            )}
          </>
        )}
      </div>
      <div className="">
        {sp.connected && (
          <>
            {list.length > 0 && (
              <>
                <div className="mt-4 flex items-baseline justify-between">
                  <h2 className="label text-[11px] font-medium text-music-text">
                    {listTitle}
                  </h2>
                  {list.length > 4 && (
                    <button
                      onClick={() => setShowAll((s) => !s)}
                      className="label h-8 text-[10px] underline"
                    >
                      {showAll ? tt("Show less") : tt("See more")}
                    </button>
                  )}
                </div>
                <ol>
                  {(showAll ? list : list.slice(0, 4)).map((t, i) => {
                    const img = art(t.album.images);
                    return (
                      <li
                        key={`${t.id}-${i}`}
                        className="flex h-11 items-center gap-3"
                      >
                        <span className="label w-[18px] text-[10px]">
                          {String(i + 2).padStart(2, "0")}
                        </span>
                        <span
                          className="size-[34px] shrink-0 overflow-hidden"
                          style={{ background: SWATCHES[i % SWATCHES.length] }}
                        >
                          {img && (
                            <img
                              src={img}
                              alt=""
                              className="size-full object-cover"
                            />
                          )}
                        </span>
                        <div className="flex min-w-0 grow flex-col">
                          <span className="song truncate text-[15px]">
                            {t.name}
                          </span>
                          <span className="label truncate text-[9px] text-muted">
                            {t.album.name}
                          </span>
                        </div>
                        <span className="label text-[10px]">
                          {mmss(t.duration_ms)}
                        </span>
                      </li>
                    );
                  })}
                </ol>
              </>
            )}

            <h2 className="label mt-6 text-[11px] font-medium">
              {tt("Your playlists")}
            </h2>
            <div className="rail -mx-5 mt-3 gap-3 px-5">
              <Link
                href="/music/playlist?id=liked"
                className="flex w-[120px] shrink-0 flex-col gap-1.5 text-left"
              >
                <span className="flex size-[120px] items-center justify-center bg-[#5B3F7A] text-white">
                  <HeartFilledIcon size={46} />
                </span>
                <span className="song truncate text-[13px]">
                  {tt("Liked Songs")}
                </span>
                <span className="label text-[9px] text-muted">
                  {tt("Your library")}
                </span>
              </Link>
              {playlists.map((p, i) => {
                const img = art(p.images, true);
                const total = p.items?.total ?? p.tracks?.total;
                return (
                  <Link
                    key={p.id}
                    href={`/music/playlist?id=${p.id}`}
                    className="flex w-[120px] shrink-0 flex-col gap-1.5 text-left"
                  >
                    <span
                      className="block size-[120px] overflow-hidden"
                      style={{ background: SWATCHES[i % SWATCHES.length] }}
                    >
                      {img && (
                        <img
                          src={img}
                          alt=""
                          className="size-full object-cover"
                        />
                      )}
                    </span>
                    <span className="song truncate text-[13px]">
                      {p.name}
                    </span>
                    {total !== undefined && (
                      <span className="label text-[9px] text-muted">
                        {tt("{n} tracks", { n: total })}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
