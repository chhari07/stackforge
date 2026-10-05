"use client";

import { useEffect, useState } from "react";
import { TabBar } from "@/components/tab-bar";
import { Logo } from "@/components/logo";
import { MiniPlayer } from "@/components/mini-player";
import { LocalView } from "@/components/local-view";
import { OnlineView } from "@/components/online-view";
import { useLocalMusic } from "@/components/local-music-provider";
import { AddToPlaylistSheet } from "@/components/playlist-parts";
import { useT } from "@/lib/i18n";

type Source = "phone" | "online";
const SOURCE_KEY = "stack.music-source";
const SOURCES: Source[] = ["phone", "online"];
const LABEL: Record<Source, string> = { phone: "Local", online: "Online" };

export default function Music() {
  const tt = useT();
  const local = useLocalMusic();
  const [source, setSourceState] = useState<Source>("phone");
  const [naming, setNaming] = useState(false);

  // Reopen the tab you used last (Local on first run in the app, Online on the web).
  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(SOURCE_KEY);
    } catch {}
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSourceState(saved === "phone" || saved === "online" ? saved : local.available ? "phone" : "online");
  }, [local.available]);

  const setSource = (s: Source) => {
    setSourceState(s);
    try {
      localStorage.setItem(SOURCE_KEY, s);
    } catch {}
  };

  // Playlists are made from the songs on the phone.
  const onPhone = source === "phone" && local.available;

  return (
    <main className="overflow-x-hidden px-5 pt-5 pb-[180px]">
      <div className="flex h-8 items-center justify-between">
        <Logo size={26} className="-ml-1" />
        <div role="tablist" aria-label={tt("Music source")} className="flex rounded-full border border-ink/15 p-0.5">
          {SOURCES.map((s) => (
            <button
              key={s}
              role="tab"
              aria-selected={source === s}
              onClick={() => setSource(s)}
              className={`label h-7 rounded-full px-3 text-[10px] ${source === s ? "bg-ink text-on-ink" : ""}`}
            >
              {tt(LABEL[s])}
            </button>
          ))}
        </div>
      </div>

      {source === "phone" ? (
        local.available ? (
          <LocalView />
        ) : (
          <p className="mt-10 text-[14px] leading-relaxed text-muted">
            {tt("Songs stored on your phone play in the Stack Android app. Here, try Online for free music.")}
          </p>
        )
      ) : (
        <OnlineView />
      )}

      <MiniPlayer showTime />
      <AddToPlaylistSheet songs={naming ? [] : null} newOnly onClose={() => setNaming(false)} />
      <TabBar add={onPhone ? { label: "New playlist", onClick: () => setNaming(true) } : undefined} />
    </main>
  );
}
