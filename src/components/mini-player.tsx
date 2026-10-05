"use client";

import { Marquee } from "./marquee";
import Link from "next/link";
import { mmss } from "@/lib/format";
import { useLocalMusic } from "./local-music-provider";
import { useNowPlaying } from "./now-playing";
import { NextIcon, PauseIcon, PlayIcon, PrevIcon } from "./icons";
import { useT } from "@/lib/i18n";

// Slim floating now-playing pill that sits above the tab bar.
export function MiniPlayer({ showTime = false }: { showTime?: boolean }) {
  const tt = useT();
  const local = useLocalMusic();
  const now = useNowPlaying();

  const shell =
    "fixed inset-x-6 bottom-[calc(var(--above-tabs)+6px)] z-30 mx-auto flex h-[46px] max-w-[420px] items-center gap-2.5 overflow-hidden rounded-full bg-card pr-1.5 pl-3 shadow-[0_8px_24px_rgba(0,0,0,.12)]";
  const square = "size-[22px] shrink-0 overflow-hidden rounded-[5px] bg-music";

  if (!now) {
    return (
      <Link href="/music" className={shell}>
        <span className={square} />
        <span className="song min-w-0 grow truncate text-[13px]">
          {local.available ? tt("Press play. Then read.") : tt("Silence is fine. Music is better.")}
        </span>
        <span className="flex size-9 shrink-0 items-center justify-center">
          <PlayIcon size={14} />
        </span>
      </Link>
    );
  }

  const pct = now.duration ? Math.min(100, (now.position / now.duration) * 100) : 0;

  return (
    <div className={shell}>
      <div className="absolute bottom-0 left-0 h-0.5 bg-music" style={{ width: `${pct}%` }} />
      <Link href="/music" className={square}>
        {now.art && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={now.art} alt="" className="size-full object-cover" />
        )}
      </Link>
      <Link href="/music" className="flex min-w-0 grow items-baseline gap-2">
        <Marquee className="song min-w-0 text-[13px]">{now.title}</Marquee>
        {showTime && (
          <span className="label shrink-0 text-[10px] text-muted">
            {mmss(now.position)} / {mmss(now.duration)}
          </span>
        )}
      </Link>
      {showTime && (
        <button aria-label={tt("Previous track")} onClick={now.previous} className="flex size-9 shrink-0 items-center justify-center">
          <PrevIcon size={14} />
        </button>
      )}
      <button
        aria-label={now.playing ? "Pause" : "Play"}
        onClick={now.toggle}
        className="flex size-9 shrink-0 items-center justify-center"
      >
        {now.playing ? <PauseIcon size={14} /> : <PlayIcon size={14} />}
      </button>
      {showTime && (
        <button aria-label={tt("Next track")} onClick={now.next} className="flex size-9 shrink-0 items-center justify-center">
          <NextIcon size={14} />
        </button>
      )}
    </div>
  );
}
