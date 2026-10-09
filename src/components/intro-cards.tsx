"use client";

import { useRef, useState, type ReactNode } from "react";
import { useT } from "@/lib/i18n";

// First launch: what Stack does, in three swipeable cards (Save → Highlight →
// Remember). The little animations are in globals.css ("First launch").

function SaveArt() {
  return (
    <div className="relative mx-auto h-[150px] w-[150px]">
      {[2, 1].map((i) => (
        <div
          key={i}
          className="absolute inset-x-0 bottom-0 mx-auto h-[110px] w-[96px] rounded-lg border border-ink/10 bg-card"
          style={{ transform: `translate(${i * 7}px, ${-i * 7}px)` }}
        />
      ))}
      <div className="intro-save absolute inset-x-0 bottom-0 mx-auto flex h-[110px] w-[96px] flex-col gap-1.5 rounded-lg bg-ink p-3">
        <span className="h-1.5 w-3/4 rounded-full bg-on-ink/70" />
        <span className="h-1.5 w-full rounded-full bg-on-ink/30" />
        <span className="h-1.5 w-5/6 rounded-full bg-on-ink/30" />
        <span className="h-1.5 w-2/3 rounded-full bg-on-ink/30" />
      </div>
    </div>
  );
}

function HighlightArt() {
  const t = useT();
  return (
    <div className="relative mx-auto flex h-[150px] w-[220px] flex-col justify-center gap-2.5">
      <span className="h-2 w-full rounded-full bg-ink/15" />
      <span className="relative h-2 w-[88%]">
        <span className="intro-mark absolute -inset-x-1 -inset-y-1.5 rounded bg-news-tint" />
        <span className="absolute inset-0 rounded-full bg-ink/60" />
      </span>
      <span className="h-2 w-[70%] rounded-full bg-ink/15" />
      <div className="intro-note absolute -right-2 bottom-0 flex w-[118px] flex-col gap-1 rounded-xl bg-ink px-3 py-2 text-on-ink shadow-[0_10px_24px_rgba(0,0,0,.18)]">
        <span className="label text-[8px] text-news-tint">{t("Note")}</span>
        <span className="h-1.5 w-full rounded-full bg-on-ink/70" />
        <span className="h-1.5 w-2/3 rounded-full bg-on-ink/40" />
      </div>
    </div>
  );
}

function MorningArt() {
  return (
    <div className="relative mx-auto flex h-[150px] w-[220px] items-end justify-center gap-2.5 overflow-hidden">
      <span className="intro-sun absolute top-1 right-6 size-9 rounded-full bg-pdf" />
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="intro-rise flex h-[96px] w-[62px] flex-col gap-1.5 rounded-lg bg-card p-2 shadow-[0_6px_16px_rgba(0,0,0,.08)]"
          style={{ animationDelay: `${i * 180}ms` }}
        >
          <span className="h-1.5 w-full rounded-full bg-news" />
          <span className="h-1.5 w-full rounded-full bg-ink/20" />
          <span className="h-1.5 w-2/3 rounded-full bg-ink/20" />
        </div>
      ))}
    </div>
  );
}

const CARDS: { step: string; line: string; art: ReactNode }[] = [
  { step: "Save", line: "Save from any app", art: <SaveArt /> },
  { step: "Highlight", line: "Select a line, and it becomes a note", art: <HighlightArt /> },
  { step: "Remember", line: "Every morning, three come back", art: <MorningArt /> },
];

export function IntroCards({ onDone }: { onDone: () => void }) {
  const track = useRef<HTMLDivElement>(null);
  const [at, setAt] = useState(0);
  const last = at === CARDS.length - 1;
  const t = useT();

  const go = (i: number) => {
    const el = track.current;
    el?.scrollTo({ left: i * el.clientWidth, behavior: "smooth" });
  };

  return (
    <div className="flex grow flex-col">
      <div className="flex items-center justify-between">
        <span className="label text-[10px] text-muted">
          {CARDS.map((c, i) => (
            <span key={c.step} className={i === at ? "text-ink" : ""}>
              {i > 0 && " → "}
              {t(c.step)}
            </span>
          ))}
        </span>
        <button onClick={onDone} className="label -mr-2 h-11 px-2 text-[11px] text-muted underline">
          {t("Skip")}
        </button>
      </div>

      <div
        ref={track}
        onScroll={(e) => {
          const el = e.currentTarget;
          setAt(Math.round(el.scrollLeft / Math.max(1, el.clientWidth)));
        }}
        className="no-scrollbar -mx-5 mt-4 flex grow snap-x snap-mandatory overflow-x-auto"
        aria-roledescription={t("carousel")}
      >
        {CARDS.map((c, i) => (
          <section
            key={c.step}
            aria-roledescription={t("slide")}
            aria-label={t("{n} of {total}", { n: i + 1, total: CARDS.length })}
            className="flex w-full shrink-0 snap-center flex-col justify-center gap-8 px-5"
          >
            <div className="rounded-[26px] bg-paper-2 py-10">{c.art}</div>
            <p className="font-serif text-[30px] leading-[1.15] italic">
              <span className="label mb-2 block text-[11px] font-medium not-italic text-news-text">
                0{i + 1} — {t(c.step)}
              </span>
              {t(c.line)}
            </p>
          </section>
        ))}
      </div>

      <div className="mt-6 flex items-center justify-between gap-4">
        <div className="flex gap-1.5" aria-hidden>
          {CARDS.map((c, i) => (
            <span key={c.step} className={`h-1.5 rounded-full transition-all ${i === at ? "w-6 bg-ink" : "w-1.5 bg-ink/20"}`} />
          ))}
        </div>
        <button
          onClick={() => (last ? onDone() : go(at + 1))}
          className="h-14 grow rounded-full bg-ink text-[16px] font-semibold text-on-ink"
        >
          {last ? t("Get started") : t("Next")}
        </button>
      </div>
    </div>
  );
}
