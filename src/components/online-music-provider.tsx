"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { streamUrl, type OnlineTrack } from "@/lib/audius";
import { useLocalMusic } from "./local-music-provider";
import { tr } from "@/lib/i18n";

type State = {
  track: OnlineTrack | null;
  playing: boolean;
  loading: boolean;
  position: number; // ms
  duration: number; // ms
  error: string | null;
};

type Ctx = State & {
  queue: OnlineTrack[];
  index: number;
  play: (tracks: OnlineTrack[], index: number) => void;
  toggle: () => void;
  next: () => void;
  previous: () => void;
  seek: (ms: number) => void;
};

const OnlineCtx = createContext<Ctx | null>(null);

export function useOnlineMusic() {
  const ctx = useContext(OnlineCtx);
  if (!ctx) throw new Error("useOnlineMusic must be inside OnlineMusicProvider");
  return ctx;
}

// Streams free online music through one <audio> element, with lock-screen
// controls through the Media Session API.
export function OnlineMusicProvider({ children }: { children: ReactNode }) {
  const audio = useRef<HTMLAudioElement | null>(null);
  const [queue, setQueue] = useState<OnlineTrack[]>([]);
  const [index, setIndex] = useState(-1);
  const [s, setS] = useState<State>({ track: null, playing: false, loading: false, position: 0, duration: 0, error: null });
  const skips = useRef(0);
  const local = useLocalMusic();
  const localRef = useRef(local);
  useEffect(() => {
    localRef.current = local;
  });

  // Only one thing plays at a time: phone music starting pauses the stream.
  useEffect(() => {
    if (local.state.playing) audio.current?.pause();
  }, [local.state.playing]);

  const load = useCallback(async (list: OnlineTrack[], i: number) => {
    const t = list[i];
    const a = (audio.current ??= new Audio());
    if (!t) return;
    if (localRef.current.state.playing) localRef.current.toggle();
    setQueue(list);
    setIndex(i);
    setS((p) => ({ ...p, track: t, loading: true, position: 0, duration: t.duration, error: null }));
    a.src = await streamUrl(t.id);
    a.play().catch(() => setS((p) => ({ ...p, loading: false, playing: false })));
  }, []);

  const step = useCallback(
    (dir: 1 | -1) => {
      if (!queue.length) return;
      const a = audio.current;
      // "Previous" restarts the song if it's a few seconds in.
      if (dir === -1 && a && a.currentTime > 3) {
        a.currentTime = 0;
        return;
      }
      load(queue, (index + dir + queue.length) % queue.length);
    },
    [queue, index, load],
  );

  const stepRef = useRef(step);
  useEffect(() => {
    stepRef.current = step;
  }, [step]);

  useEffect(() => {
    const a = (audio.current ??= new Audio());
    a.preload = "auto";
    const sync = () =>
      setS((p) => ({
        ...p,
        playing: !a.paused,
        position: a.currentTime * 1000,
        duration: Number.isFinite(a.duration) ? a.duration * 1000 : p.duration,
      }));
    const onPlaying = () => {
      skips.current = 0;
      setS((p) => ({ ...p, loading: false, error: null }));
      sync();
    };
    const onEnded = () => stepRef.current(1);
    // A track that won't play: move on, but don't loop forever if the network is down.
    const onError = () => {
      if (!a.src) return;
      setS((p) => ({ ...p, loading: false, playing: false, error: tr("Couldn't play that song.") }));
      if (skips.current++ < 3) stepRef.current(1);
    };
    const events: [string, () => void][] = [
      ["timeupdate", sync],
      ["play", sync],
      ["pause", sync],
      ["durationchange", sync],
      ["playing", onPlaying],
      ["waiting", () => setS((p) => ({ ...p, loading: true }))],
      ["ended", onEnded],
      ["error", onError],
    ];
    events.forEach(([e, f]) => a.addEventListener(e, f));
    return () => events.forEach(([e, f]) => a.removeEventListener(e, f));
  }, []);

  const toggle = useCallback(() => {
    const a = audio.current;
    if (!a?.src) return;
    if (a.paused) {
      if (localRef.current.state.playing) localRef.current.toggle();
      a.play().catch(() => {});
    }
    else a.pause();
  }, []);

  const seek = useCallback((ms: number) => {
    if (audio.current) audio.current.currentTime = ms / 1000;
  }, []);

  // Lock screen / notification / headset controls.
  useEffect(() => {
    if (!("mediaSession" in navigator) || !s.track) return;
    const t = s.track;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: t.title,
      artist: t.artist,
      artwork: t.art ? [{ src: t.art, sizes: "480x480", type: "image/jpeg" }] : [],
    });
    const ms = navigator.mediaSession;
    ms.setActionHandler("play", toggle);
    ms.setActionHandler("pause", toggle);
    ms.setActionHandler("nexttrack", () => stepRef.current(1));
    ms.setActionHandler("previoustrack", () => stepRef.current(-1));
  }, [s.track, toggle]);

  const value: Ctx = {
    ...s,
    queue,
    index,
    play: load,
    toggle,
    next: () => step(1),
    previous: () => step(-1),
    seek,
  };

  return <OnlineCtx.Provider value={value}>{children}</OnlineCtx.Provider>;
}
