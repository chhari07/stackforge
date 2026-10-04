"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { BackIcon, CheckIcon, ExternalIcon } from "@/components/icons";
import { canGoBack } from "@/lib/nav";
import { grade, reviewStreak, todaysReview, type Grade } from "@/lib/review";
import { useStore } from "@/lib/use-store";
import { getNotes } from "@/lib/db";
import { SAMPLE_HREF } from "@/lib/sample";
import { noteTime } from "@/lib/format";
import type { Note } from "@/lib/db";
import { QuoteCardSheet } from "@/components/quote-card-sheet";
import { cardOf } from "@/lib/quote-card";
import { pageLabel } from "@/components/note-card";
import { TabBar } from "@/components/tab-bar";
import { useT } from "@/lib/i18n";

export default function Review() {
  const router = useRouter();
  const [{ items, done }, ready] = useStore(todaysReview, { items: [], done: [] });
  const [notes, notesReady] = useStore(getNotes, []);
  const fresh = notesReady && !notes.some((n) => n.quote); // no highlights yet
  const [busy, setBusy] = useState(false);
  const [shown, setShown] = useState<string | null>(null); // the word whose meaning is showing
  const [card, setCard] = useState<Note | null>(null);
  const t = useT();
  const back = () => (canGoBack() ? router.back() : router.push("/"));

  const left = items.filter((n) => !done.includes(n.id));
  const current = left[0];
  const position = items.length - left.length + 1;

  const answer = async (g: Grade) => {
    if (!current || busy) return;
    setBusy(true);
    await grade(current, g);
    setBusy(false);
  };

  return (
    <main className="screen flex flex-col px-5 pt-5 pb-[calc(var(--above-tabs)+16px)]">
      <div className="flex h-8 items-center justify-between">
        <button aria-label={t("Back")} onClick={back} className="-ml-2.5 flex size-11 items-center justify-center">
          <BackIcon size={22} />
        </button>
        {current && (
          <span className="label text-[10px]">
            {position} / {items.length}
          </span>
        )}
      </div>

      <div className="mx-auto flex w-full max-w-[600px] grow flex-col">
        <h1 className="display -ml-1.5 mt-3 text-[clamp(84px,28vw,150px)]">{t("RECALL")}</h1>
        <p className="label mt-2.5 text-[10px] text-muted">
          {t("Daily review")} · {items.length ? t("{n} highlights today", { n: items.length }) : t("no highlights today")}
        </p>

        {/* Progress dots */}
        {items.length > 0 && (
          <div className="mt-5 flex gap-1.5" aria-hidden>
            {items.map((n) => (
              <span
                key={n.id}
                className={`h-1 grow rounded-full ${done.includes(n.id) ? "bg-news" : n.id === current?.id ? "bg-ink" : "bg-rule"}`}
              />
            ))}
          </div>
        )}

        {current && (
          <>
            <figure
              key={current.id}
              className={`mt-6 flex flex-col gap-4 rounded-[22px] p-6 ${current.kind === "pdf" ? "bg-pdf-tint" : "bg-news-tint"}`}
            >
              {current.word ? (
                <>
                  <p className="text-[34px] leading-tight font-bold [font-stretch:87%]">{current.quote}</p>
                  {shown === current.id ? (
                    <p className="border-t border-ink/10 pt-3 text-[15px] leading-relaxed whitespace-pre-line text-prose">
                      {current.body}
                    </p>
                  ) : (
                    <button
                      onClick={() => setShown(current.id)}
                      className="label h-10 self-start rounded-full border border-ink/25 px-4 text-[10px]"
                    >
                      {t("Show meaning")}
                    </button>
                  )}
                </>
              ) : (
                <>
                  <blockquote
                    className={
                      current.kind === "pdf"
                        ? "font-serif text-[24px] leading-[1.3] italic"
                        : "text-[21px] leading-[1.4] font-semibold"
                    }
                  >
                    “{current.quote}”
                  </blockquote>
                  {current.body && (
                    <p className="border-t border-ink/10 pt-3 text-[15px] leading-relaxed text-prose">{current.body}</p>
                  )}
                </>
              )}
              <figcaption className="label text-[10px] text-muted">
                {current.sourceTitle ?? t("Highlight")}
                {current.page ? ` · ${pageLabel(current)}` : ""} · {noteTime(current.createdAt)}
              </figcaption>
            </figure>
            <div className="mt-3 flex items-center justify-between">
              {current.href ? (
                <Link href={current.href} className="label flex items-center gap-1.5 text-[10px] underline">
                  {t("Open where you read it")} <ExternalIcon size={12} />
                </Link>
              ) : (
                <span />
              )}
              <button onClick={() => setCard(current)} className="label text-[10px] underline">
                {t("Share as a card")}
              </button>
            </div>

            <div className="mt-auto flex flex-col gap-2.5 pt-8">
              <p className="text-center text-[14px] text-muted">
                {current.word ? t("Do you remember what it means?") : t("Why did you keep this?")}
              </p>
              <div className="flex gap-2.5">
                <button
                  disabled={busy}
                  onClick={() => answer("again")}
                  className="h-14 grow rounded-full border border-ink/20 text-[15px] font-semibold"
                >
                  {t("Show again soon")}
                </button>
                <button
                  disabled={busy}
                  onClick={() => answer("got")}
                  className="flex h-14 grow items-center justify-center gap-2 rounded-full bg-ink text-[15px] font-semibold text-on-ink"
                >
                  <CheckIcon size={18} /> {t("Got it")}
                </button>
              </div>
              <button
                disabled={busy}
                onClick={() => answer("off")}
                className="label h-10 text-[10px] text-muted underline"
              >
                {t("Stop showing this one")}
              </button>
            </div>
          </>
        )}

        {ready && !current && items.length > 0 && (
          <div className="mt-10 flex flex-col gap-3">
            <p className="font-serif text-[30px] leading-tight italic">{t("Done for today. Brain: fed.")}</p>
            <p className="text-[15px] leading-relaxed text-muted">
              {t(items.length > 1 ? "{n} highlights reviewed today." : "{n} highlight reviewed today.", { n: items.length })}
              {reviewStreak() > 1 ? ` ${t("{n} days in a row. You’re stacking.", { n: reviewStreak() })}` : ""}{" "}
              {t("The next ones come tomorrow.")}
            </p>
            <Link href="/" className="mt-4 flex h-12 items-center justify-center rounded-full bg-ink text-[15px] font-semibold text-on-ink">
              {t("Back to Today")}
            </Link>
          </div>
        )}

        {ready && items.length === 0 && (
          <div className="mt-10 flex flex-col gap-3">
            <p className="font-serif text-[26px] leading-tight italic">
              {fresh ? t("Highlight a line today. It comes back here tomorrow.") : t("Nothing to recall today. Go find a good line.")}
            </p>
            <p className="text-[15px] leading-relaxed text-muted">
              {t("Highlight lines in articles and PDFs. Every morning, three of them come back here, so what you read stays with you.")}
            </p>
            {fresh && (
              <Link
                href={SAMPLE_HREF}
                className="mt-2 flex h-12 items-center justify-center rounded-full bg-ink text-[15px] font-semibold text-on-ink"
              >
                {t("Try it on a sample article")}
              </Link>
            )}
          </div>
        )}
      </div>
      <QuoteCardSheet card={card ? cardOf(card) : null} onClose={() => setCard(null)} />
      <TabBar />
    </main>
  );
}
