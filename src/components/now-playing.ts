"use client";

import { art as spArt, artists } from "@/lib/spotify";
import { useLocalMusic } from "./local-music-provider";
import { useOnlineMusic } from "./online-music-provider";
import { useSpotify } from "./spotify-provider";

export type NowPlaying = {
  source: "local" | "online" | "spotify";
  title: string;
  artist: string;
  art?: string | null;
  playing: boolean;
  position: number;
  duration: number;
  device?: string;
  toggle: () => void;
  next: () => void;
  previous: () => void;
};

// One "now playing" for the mini player and the PDF reader pill: whatever is
// playing, preferring music on the phone, then online music, then Spotify.
export function useNowPlaying(): NowPlaying | null {
  const local = useLocalMusic();
  const sp = useSpotify();
  const online = useOnlineMusic();
  const l = local.state;
  const track = sp.connected ? sp.player?.item : null;

  const fromLocal: NowPlaying | null = l.uri
    ? {
        source: "local",
        title: l.title || "Unknown track",
        artist: l.artist || "On this phone",
        art: local.art,
        playing: !!l.playing,
        position: l.position ?? 0,
        duration: l.duration ?? 0,
        device: "This phone",
        toggle: local.toggle,
        next: local.next,
        previous: local.previous,
      }
    : null;

  const fromSpotify: NowPlaying | null = track
    ? {
        source: "spotify",
        title: track.name,
        artist: artists(track),
        art: spArt(track.album.images),
        playing: !!sp.player?.is_playing,
        position: sp.progress,
        duration: track.duration_ms,
        device: sp.player?.device?.name ?? "Spotify",
        toggle: sp.toggle,
        next: sp.next,
        previous: sp.previous,
      }
    : null;

  const fromOnline: NowPlaying | null = online.track
    ? {
        source: "online",
        title: online.track.title,
        artist: online.track.artist,
        art: online.track.art,
        playing: online.playing,
        position: online.position,
        duration: online.duration,
        device: "Online",
        toggle: online.toggle,
        next: online.next,
        previous: online.previous,
      }
    : null;

  if (fromLocal?.playing) return fromLocal;
  if (fromOnline?.playing) return fromOnline;
  if (fromSpotify?.playing) return fromSpotify;
  return fromLocal ?? fromOnline ?? fromSpotify;
}
