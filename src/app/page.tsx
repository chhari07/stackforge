"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { TabBar } from "@/components/tab-bar";
import { TopBar } from "@/components/top-bar";
import { MiniPlayer } from "@/components/mini-player";
import { HeroStory, StoryCard } from "@/components/story";
import { NoteCard } from "@/components/note-card";
import { PdfCover } from "@/components/pdf-cover";
import { getNotes, getPdfs } from "@/lib/db";
import { useStore } from "@/lib/use-store";
import { useNews } from "@/lib/use-news";
import { dayStamp, greeting } from "@/lib/format";
import { getProfile, newsFirst } from "@/lib/profile";
import { SAMPLE_HREF } from "@/lib/sample";
import { ClockIcon, PlayIcon, PlusIcon } from "@/components/icons";
import { NotifyPrompt } from "@/components/notify-prompt";
import { WeekCard } from "@/components/week-card";
import { useFocus, useTick } from "@/components/focus-provider";
import { clockText, remainingMs } from "@/lib/focus";
import { reviewStreak, todaysReview } from "@/lib/review";
import { useT } from "@/lib/i18n";

function Section({
  n,
  title,
  href,
  link,
  color = "",
}: {
  n: string;
  title: string;
  href: string;
  link: string;
  color?: string;
}) {
  const t = useT();
  return (
    <div className="mt-[22px] flex items-baseline justify-between">
      <h2 className="label text-[11px] font-medium">
        {n} — {t(title)}
      </h2>
      <Link href={href} className={`label text-[11px] underline ${color}`}>
        {t(link)}
      </Link>
    </div>
  );
}

// Start a focus session, or see the one that's running.
function FocusCard() {
  const { session } = useFocus();
  const live = !!session && !session.endedAt;
  const tick = useTick(live && !session?.pausedAt);
  const t = useT();
  return (
    <Link
      href="/focus"
      className="mt-2.5 flex items-center gap-3.5 rounded-2xl bg-ink px-4 py-3.5 text-on-ink"
    >
      <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-music text-white">
        {live ? <ClockIcon size={20} /> : <PlayIcon size={18} />}
      </span>
      <span className="flex min-w-0 grow flex-col gap-0.5">
        <span className="text-[16px] font-semibold">
          {!session
            ? t("25 minutes. Just you and the page.")
            : session.endedAt
              ? t("Session complete: see summary")
              : t(session.pausedAt ? "{time} paused" : "{time} left", { time: clockText(remainingMs(session, tick)) })}
        </span>
        <span className="label truncate text-[10px] text-on-ink/65">
          {session ? session.target.title : t("One timer, your music, no distractions")}
        </span>
      </span>
    </Link>
  );
}

// Today's highlights to review: the first thing on Today. With no highlights
// yet it opens the sample article to make one.
function ReviewCard({ teach }: { teach: boolean }) {
  const [{ items, done }] = useStore(todaysReview, { items: [], done: [] });
  const t = useT();
  if (items.length === 0) {
    if (!teach)
      return (
        <Link href="/review" className="mt-5 flex items-center justify-between rounded-2xl bg-card px-4 py-3">
          <span className="text-[14px] font-semibold">{t("Daily review")}</span>
          <span className="label text-[10px] text-muted">{t("Nothing due today")}</span>
        </Link>
      );
    return (
      <Link href={SAMPLE_HREF} className="mt-5 flex flex-col gap-2 rounded-2xl bg-card px-4 py-3.5">
        <span className="label text-[10px] font-medium text-news-text">{t("Daily review")}</span>
        <span className="font-serif text-[18px] leading-snug italic">
          {t("Highlight a line today. Tomorrow morning, it comes back here.")}
        </span>
        <span className="label text-[9px] text-muted">{t("Try it on a sample article")}</span>
      </Link>
    );
  }
  const left = items.filter((n) => !done.includes(n.id));
  if (left.length === 0) {
    const streak = reviewStreak();
    return (
      <Link href="/review" className="mt-5 flex items-center justify-between rounded-2xl bg-news-tint px-4 py-3 text-news-deep">
        <span className="text-[14px] font-semibold">{t("Daily review done")}</span>
        <span className="label text-[10px]">{streak > 1 ? t("{n} days in a row", { n: streak }) : t("See you tomorrow")}</span>
      </Link>
    );
  }
  const next = left[0];
  return (
    <Link href="/review" className="mt-5 flex flex-col gap-2 rounded-2xl bg-card px-4 py-3.5">
      <span className="flex items-baseline justify-between">
        <span className="label text-[10px] font-medium text-news-text">{t("Daily review")}</span>
        <span className="label text-[10px] text-muted">
          {t(left.length > 1 ? "{n} things you highlighted" : "{n} thing you highlighted", { n: left.length })}
        </span>
      </span>
      <span className="line-clamp-2 font-serif text-[18px] leading-snug italic">“{next.quote}”</span>
      <span className="label truncate text-[9px] text-muted">{next.sourceTitle ?? t("Highlight")}</span>
    </Link>
  );
}

export default function Today() {
  const [stamp, setStamp] = useState<{ day: string; date: string; hello: string } | null>(
    null,
  );
  // Date is read on the client only, so server and client HTML match.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setStamp({ ...dayStamp(), hello: greeting() }), []);
  const [profile] = useStore(getProfile, { id: "me", updatedAt: 0 });
  const t = useT();
  const firstName = profile.name?.trim().split(/\s+/)[0];
  const newsUp = newsFirst(profile);

  const news = useNews("top");
  const [notes, notesReady] = useStore(getNotes, []);
  const [pdfs] = useStore(getPdfs, []);

  const top = news.stories[0];
  const more = news.stories.slice(1, 10);
  const reading = [...pdfs]
    .sort((a, b) => (b.lastOpenedAt ?? b.addedAt) - (a.lastOpenedAt ?? a.addedAt))
    .slice(0, 10);
  const recent = notes.slice(0, 8);
  // Rails bleed to the screen edge on phones; tablets keep them in the column.
  const rail = "rail -mx-5 mt-2 gap-3 px-5";

  return (
    <main className="px-5 pt-1 pb-[180px]">
      <TopBar animate />
      <h1 className="display -ml-2.5 mt-1 text-[clamp(96px,33vw,150px)]">
        STACK
      </h1>
      <p className="mt-3 font-serif text-[19px] leading-snug italic">{t("Stack makes you remember what you read.")}</p>
      <div className="mt-2.5 flex items-start justify-between">
        <span className="label flex min-w-0 flex-col gap-0.5 pr-3 text-[11px]">
          <span className="truncate">{stamp ? (firstName ? `${t(stamp.hello)}, ${firstName}.` : `${t(stamp.hello)}.`) : ""}</span>
          {stamp && <span className="text-muted">{t("What are we reading?")}</span>}
        </span>
        <span className="label shrink-0 text-[11px]">
          {stamp ? `${stamp.day} ${stamp.date}` : ""}
        </span>
      </div>

      <ReviewCard teach={notesReady && !notes.some((n) => n.quote)} />
      <FocusCard />
      <WeekCard />
      <NotifyPrompt />

      {/* Your own reading first; the news first for "Staying informed". */}
      <div className="flex flex-col">
        <div className={newsUp ? "" : "order-last"}>
          <Section
            n={newsUp ? "01" : "03"}
            title="Today’s top story"
            href="/news"
            link="All news"
            color="text-news-text"
          />
          <div className="mt-2 flex flex-col">
            {top ? (
              <HeroStory story={top} height={180} />
            ) : (
              <div className="flex h-[180px] items-center justify-center rounded-2xl bg-soft">
                <span className="label text-[10px] text-[#BDBAB2]">
                  {news.status === "error"
                    ? t("Couldn't load news")
                    : t("Loading news…")}
                </span>
              </div>
            )}
          </div>
          {more.length > 0 && (
            <>
              <Section
                n={newsUp ? "02" : "04"}
                title="More for you"
                href="/news"
                link="See all"
                color="text-news-text"
              />
              <div role="list" aria-label={t("More stories")} className={rail}>
                {more.map((st) => (
                  <div key={st.id} role="listitem">
                    <StoryCard story={st} />
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
        <div>
          <Section
            n={newsUp ? "03" : "01"}
            title="Pick up where you left off"
            href="/library"
            link="Library"
          />
          {reading.length > 0 ? (
            <div role="list" aria-label={t("Your PDFs")} className={rail}>
              {reading.map((p) => (
                <Link
                  key={p.id}
                  role="listitem"
                  href={`/library/read?id=${p.id}`}
                  className="flex w-[112px] flex-col gap-1.5"
                >
                  <PdfCover id={p.id} title={p.title} plain={p.coverStyle === "stack"} marked={!!p.bookmarks?.length} progress={p.lastPage > 1 ? p.lastPage / p.pages : 0} className="h-[152px] w-[112px]" />
                  <span className="line-clamp-2 font-serif text-[14px] leading-[1.15] font-semibold">
                    {p.title}
                  </span>
                  <div className="h-[3px] rounded-sm bg-rule">
                    <div
                      className="h-[3px] rounded-sm bg-ink"
                      style={{ width: `${(p.lastPage / Math.max(1, p.pages)) * 100}%` }}
                    />
                  </div>
                  <span className="label text-[9px] text-muted">
                    {t("p. {n} / {total}", { n: p.lastPage, total: p.pages })}
                  </span>
                </Link>
              ))}
              <Link
                href="/library"
                className="flex h-[152px] w-[112px] flex-col items-center justify-center gap-2 rounded-md border border-dashed border-ink/25 text-muted"
              >
                <PlusIcon size={20} />
                <span className="label text-[9px]">{t("Add PDF")}</span>
              </Link>
            </div>
          ) : (
            <Link
              href="/library"
              className="mt-2 flex h-[88px] items-center justify-center rounded-xl border border-dashed border-ink/25"
            >
              <span className="label text-[10px] text-muted">
                {t("Add a PDF to highlight and review")}
              </span>
            </Link>
          )}

          <Section n={newsUp ? "04" : "02"} title="What you kept" href="/notes" link="Notes" />
          {recent.length > 0 ? (
            <div role="list" aria-label={t("Recent notes")} className={`${rail} items-start`}>
              {recent.map((n) => (
                <div key={n.id} role="listitem" className="w-[216px]">
                  <NoteCard note={n} compact />
                </div>
              ))}
              <Link
                href="/notes/edit"
                className="flex h-[120px] w-[150px] flex-col items-center justify-center gap-2 rounded-[14px] border border-dashed border-ink/25 text-muted"
              >
                <PlusIcon size={20} />
                <span className="label text-[9px]">{t("New note")}</span>
              </Link>
            </div>
          ) : (
            <Link
              href="/notes/edit"
              className="mt-2 flex h-[88px] items-center justify-center rounded-xl border border-dashed border-ink/25"
            >
              <span className="label text-[10px] text-muted">{t("Write a note to keep what you learn")}</span>
            </Link>
          )}
        </div>
      </div>

      <MiniPlayer />
      <TabBar />
    </main>
  );
}
