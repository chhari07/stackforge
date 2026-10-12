"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getPdfs, getSaved, getNotes, type PdfMeta, type SavedArticle } from "@/lib/db";
import { useStore } from "@/lib/use-store";
import { todaysReview } from "@/lib/review";
import { getProfile } from "@/lib/profile";
import { SAMPLE_HREF } from "@/lib/sample";
import { folderKey, folderName } from "@/lib/saved-news";
import { clockText, remainingMs } from "@/lib/focus";
import { ago } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { safeImage, type Story } from "@/lib/use-news";
import { useFocus, useTick } from "./focus-provider";
import { PdfCover } from "./pdf-cover";
import { rememberStory, storyHref } from "./story";
import { ClockIcon, PlayIcon, PlusIcon, ShareIcon } from "./icons";
import { NewsIcon } from "./icons";

// Today, context first: the one thing that matters most right now leads the
// screen, picked from what's due, what's half-read, what was saved, the time
// of day and what you read for. Everything else follows below it.
export type Lead =
  | { kind: "focus-live" }
  | { kind: "review"; left: number; quote: string; source?: string }
  | { kind: "news" }
  | { kind: "saved"; story: SavedArticle }
  | { kind: "continue"; pdf: PdfMeta }
  | { kind: "evening"; pdf?: PdfMeta }
  | { kind: "start" }
  | { kind: "done" };

const DAY = 86_400_000;

/** The book you're in the middle of (opened most recently, not finished). */
export const openBook = (pdfs: PdfMeta[]) =>
  [...pdfs].filter((p) => p.lastPage > 1 && p.lastPage < p.pages).sort((a, b) => (b.lastOpenedAt ?? 0) - (a.lastOpenedAt ?? 0))[0];

export function useNow(): Lead | null {
  const { session } = useFocus();
  const [review, reviewReady] = useStore(todaysReview, { items: [], done: [] });
  const [pdfs, pdfsReady] = useStore(getPdfs, []);
  const [saved] = useStore(getSaved, []);
  const [notes, notesReady] = useStore(getNotes, []);
  const [profile] = useStore(getProfile, { id: "me", updatedAt: 0 });
  // The time is read on the client only, so server and client HTML match.
  const [clock, setClock] = useState<{ now: number; hour: number } | null>(null);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setClock({ now: Date.now(), hour: new Date().getHours() }), []);
  if (!clock || !reviewReady || !pdfsReady || !notesReady) return null;

  const { now, hour } = clock;
  if (session && !session.endedAt) return { kind: "focus-live" };
  const left = review.items.filter((n) => !review.done.includes(n.id));
  const morning = hour >= 5 && hour < 11;
  const evening = hour >= 19 || hour < 5;
  // Mornings for "Staying informed" readers start with the news, review right after.
  if (morning && profile.readingFor === "informed") return { kind: "news" };
  if (left.length && !evening) return { kind: "review", left: left.length, quote: left[0].quote ?? "", source: left[0].sourceTitle };
  if (evening) return { kind: "evening", pdf: openBook(pdfs) };
  const story = saved.find((a) => !a.readAt && now - a.savedAt < 3 * DAY);
  const pdf = openBook(pdfs);
  if (pdf && pdf.lastOpenedAt && now - pdf.lastOpenedAt < 3 * DAY) return { kind: "continue", pdf };
  if (story) return { kind: "saved", story };
  if (!pdfs.length && !notes.some((n) => n.quote)) return { kind: "start" };
  if (morning) return { kind: "news" };
  if (pdf) return { kind: "continue", pdf };
  return { kind: "done" };
}

/** The line under the greeting, matching what leads the screen. */
export function nowLine(lead: Lead | null, t: (s: string, v?: Record<string, string | number>) => string) {
  if (!lead) return "";
  switch (lead.kind) {
    case "focus-live":
      return t("Your focus session is running.");
    case "review":
      return t(lead.left === 1 ? "1 highlight is waiting for you." : "{n} highlights are waiting for you.", { n: lead.left });
    case "news":
      return t("Here’s what’s happening today.");
    case "saved":
      return t("You saved a story for later.");
    case "continue":
      return t("Pick up where you left off.");
    case "evening":
      return t("A quiet evening for reading.");
    case "start":
      return t("Let’s start your first stack.");
    default:
      return t("What are we reading?");
  }
}

const pill = "flex h-10 w-fit items-center gap-2 rounded-full px-4 text-[14px] font-semibold";

// The "Right now" card: the first thing on Today, whatever the moment calls for.
export function NowCard({ lead, stories = [] }: { lead: Lead | null; stories?: Story[] }) {
  const t = useT();
  const { session } = useFocus();
  const tick = useTick(!!session && !session.endedAt && !session.pausedAt);
  if (!lead) return <div aria-hidden className="mt-4 h-[150px] animate-pulse rounded-[26px] bg-card" />;
  const head = (label: string) => (
    <span className="label flex items-center gap-1.5 text-[10px] font-medium text-news-text">
      <span className="size-1.5 rounded-full bg-news shadow-[0_0_0_3px_rgb(79_192_122/.2)]" />
      {t("Right now")} · {t(label)}
    </span>
  );
  const box = "mt-4 flex flex-col gap-3 rounded-[26px] bg-card p-4 shadow-[0_14px_30px_rgb(0_0_0/.12)]";

  switch (lead.kind) {
    case "review":
      return (
        <Link href="/review" className={box}>
          {head("Daily review")}
          <span className="line-clamp-3 font-serif text-[21px] leading-snug italic">“{lead.quote}”</span>
          <span className="label truncate text-[9px] text-muted">
            {lead.source ?? t("Highlight")} · {t(lead.left === 1 ? "1 to remember" : "{n} to remember", { n: lead.left })}
          </span>
          <span className={`${pill} bg-ink text-on-ink`}>{t("Start review")}</span>
        </Link>
      );
    case "news": {
      const brief = stories.slice(0, 3);
      return (
        <div className={box}>
          {head("Morning brief")}
          {brief.length === 0 ? (
            <span className="text-[14px] text-muted">{t("Loading news…")}</span>
          ) : (
            <div className="flex flex-col gap-2.5">
              {brief.map((s, i) => {
                const img = i === 0 ? safeImage(s.image) : undefined;
                return (
                  <Link key={s.id} href={storyHref(s)} onClick={() => rememberStory(s)} className="flex items-center gap-3">
                    {img ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={img} alt="" className="size-12 shrink-0 rounded-xl object-cover" />
                    ) : (
                      <span className="display flex size-12 shrink-0 items-center justify-center rounded-xl bg-ink/8 text-[24px]">{i + 1}</span>
                    )}
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span className="line-clamp-2 text-[14px] leading-snug font-semibold">{s.title}</span>
                      <span className="label truncate text-[8px] text-muted">
                        {s.source} · {ago(s.createdAt)}
                      </span>
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
          <Link href="/news" className={`${pill} bg-ink text-on-ink`}>
            <NewsIcon size={16} /> {t("All news")}
          </Link>
        </div>
      );
    }
    case "focus-live":
      return (
        <Link href="/focus" className={box}>
          {head("Focus")}
          <span className="flex items-center gap-3">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-music text-white">
              <ClockIcon size={22} />
            </span>
            <span className="flex min-w-0 flex-col">
              <span className="display text-[34px] leading-none">{session ? clockText(remainingMs(session, tick)) : ""}</span>
              <span className="label truncate text-[9px] text-muted">
                {session?.pausedAt ? t("Paused") : t("Left")} · {session?.target.title}
              </span>
            </span>
          </span>
          <span className={`${pill} bg-ink text-on-ink`}>{t("Open the timer")}</span>
        </Link>
      );
    case "evening":
    case "done":
      return (
        <Link
          href="/focus"
          className={`${box} ${lead.kind === "evening" ? "bg-[linear-gradient(140deg,rgb(214_47_38/.22),transparent_70%)]" : ""}`}
        >
          {head(lead.kind === "evening" ? "Wind down" : "Focus")}
          <span className="flex items-center gap-3">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-music text-white">
              <PlayIcon size={20} />
            </span>
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="text-[17px] leading-snug font-bold">
                {lead.kind === "evening" && lead.pdf ? t("25 minutes with {title}", { title: lead.pdf.title }) : t("25 minutes. Just you and the page.")}
              </span>
              <span className="label text-[9px] text-muted">{t("One timer, your music, no distractions")}</span>
            </span>
          </span>
          <span className={`${pill} bg-music text-white`}>
            <PlayIcon size={14} /> {t("Start focus")}
          </span>
        </Link>
      );
    case "saved": {
      const img = safeImage(lead.story.image);
      return (
        <Link href={`/read?id=${lead.story.id}`} className={`${box} flex-row gap-3.5`}>
          <span className="flex min-w-0 grow flex-col gap-2">
            {head("Saved for later")}
            <span className="line-clamp-3 text-[18px] leading-snug font-bold">{lead.story.title}</span>
            <span className="label truncate text-[9px] text-muted">
              {folderName(folderKey(lead.story), t)} · {lead.story.source}
              {lead.story.readMinutes ? ` · ${t("{n} min read", { n: lead.story.readMinutes })}` : ""}
            </span>
            <span className={`${pill} bg-ink text-on-ink`}>{t("Read it now")}</span>
          </span>
          {img && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={img} alt="" className="size-[92px] shrink-0 rounded-2xl object-cover" />
          )}
        </Link>
      );
    }
    case "continue": {
      const p = lead.pdf;
      return (
        <Link href={`/library/read?id=${p.id}`} className={`${box} flex-row gap-4`}>
          <PdfCover id={p.id} title={p.title} plain={p.coverStyle === "stack"} marked={!!p.bookmarks?.length} progress={p.lastPage / Math.max(1, p.pages)} className="h-[124px] w-[90px] shrink-0" />
          <span className="flex min-w-0 grow flex-col gap-2">
            {head("Continue reading")}
            <span className="line-clamp-2 font-serif text-[20px] leading-tight font-semibold">{p.title}</span>
            <span className="label text-[9px] text-muted">
              {t("p. {n} / {total}", { n: p.lastPage, total: p.pages })} · {Math.round((p.lastPage / Math.max(1, p.pages)) * 100)}%
            </span>
            <span className={`${pill} mt-auto bg-ink text-on-ink`}>{t("Continue")}</span>
          </span>
        </Link>
      );
    }
    case "start":
      return (
        <div className={box}>
          {head("Your first step")}
          <span className="font-serif text-[22px] leading-snug italic">{t("Save one thing you want to remember.")}</span>
          <div className="flex flex-col gap-2">
            <Link href="/library" className="flex h-11 items-center gap-2.5 rounded-full bg-ink px-4 text-[14px] font-semibold text-on-ink">
              <PlusIcon size={16} /> {t("Add a PDF or book")}
            </Link>
            <span className="flex h-11 items-center gap-2.5 rounded-full bg-card px-4 text-[14px] font-semibold">
              <ShareIcon size={16} /> {t("Share an article to Stack")}
            </span>
            <Link href={SAMPLE_HREF} className="flex h-11 items-center gap-2.5 rounded-full bg-card px-4 text-[14px] font-semibold">
              <span className="w-4 text-center">✦</span> {t("Try a sample article")}
            </Link>
          </div>
        </div>
      );
  }
}
