"use client";

import { useEffect, useMemo, useState } from "react";
import { TabBar } from "@/components/tab-bar";
import { TopBar } from "@/components/top-bar";
import { ChevronLeft, ChevronRight } from "@/components/icons";
import { CategoryChips, DayFolders, FlashDeck, MonthSelect, RecallCard, useRecallData } from "@/components/recall";
import { cardsOf, dayFolders, recallDays, recallFor, recallMonths, startOfDay } from "@/lib/recall";
import { minutesText, readingOn } from "@/lib/reading";
import { dateLocale, useT } from "@/lib/i18n";

// Recall: what you read, day by day. Pick a month, then a day folder (or a
// day on the grid); the day's lines come back as flash cards, and below them
// is everything read that day. ?day=<timestamp> opens a day (from Library).
export default function RecallPage() {
  const t = useT();
  const { notes, pdfs, saved, ready } = useRecallData();
  const [today, setToday] = useState<number | null>(null);
  const [month, setMonth] = useState<[number, number] | null>(null);
  const [day, setDay] = useState<number | null>(null);
  const [view, setView] = useState<"days" | "grid">("days");
  useEffect(() => {
    const now = startOfDay(Date.now());
    const asked = Number(new URLSearchParams(location.search).get("day"));
    const d = asked && asked <= now ? startOfDay(asked) : now;
    /* eslint-disable react-hooks/set-state-in-effect */
    setToday(now);
    setDay(d);
    setMonth([new Date(d).getFullYear(), new Date(d).getMonth()]);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  const days = useMemo(() => (ready ? recallDays(notes) : new Set<number>()), [ready, notes]);
  const folders = useMemo(
    () => (ready && month ? dayFolders(month[0], month[1], days, notes, pdfs, saved) : []),
    [ready, month, days, notes, pdfs, saved],
  );
  if (!month || day === null || today === null) return <main className="min-h-dvh" />;

  const [year, m] = month;
  const items = ready ? recallFor(day, notes, pdfs, saved) : [];
  const log = readingOn(day);
  const kept = items.reduce((s, it) => s + it.kept.length, 0);
  const cards = cardsOf(items).length;
  const pickMonth = ([y, mo]: [number, number]) => {
    setMonth([y, mo]);
    // Open the newest day with reading in that month (or today, in this month).
    const isNow = y === new Date(today).getFullYear() && mo === new Date(today).getMonth();
    const latest = [...days].filter((d) => new Date(d).getFullYear() === y && new Date(d).getMonth() === mo).sort((a, b) => b - a)[0];
    setDay(isNow ? today : (latest ?? new Date(y, mo, 1).getTime()));
  };

  // The grid
  const first = (new Date(year, m, 1).getDay() + 6) % 7; // Monday first
  const count = new Date(year, m + 1, 0).getDate();
  const cells = [...Array(first).fill(null), ...Array.from({ length: count }, (_, i) => new Date(year, m, i + 1).getTime())];
  const weekdays = Array.from({ length: 7 }, (_, i) => new Date(2026, 0, 5 + i).toLocaleDateString(dateLocale(), { weekday: "narrow" }));
  const isThisMonth = year === new Date(today).getFullYear() && m === new Date(today).getMonth();

  return (
    <main className="min-h-dvh px-(--gutter) pt-1 pb-[190px]">
      <TopBar />
      <div className="flex flex-col items-center">
        <span className="text-[15px] font-semibold">{t("What you read, day by day")}</span>
        <h1 className="font-serif text-[66px] leading-none font-medium tracking-[-0.01em]">{t("RECALL")}</h1>
        <span className="label mt-1 text-[10px] text-muted">
          {t(folders.length === 1 ? "{n} reading day this month" : "{n} reading days this month", { n: folders.length })}
        </span>
      </div>

      <div className="mt-5 flex items-center justify-between gap-2">
        <MonthSelect months={recallMonths(days, today)} value={month} onChange={pickMonth} />
        <div role="tablist" className="flex h-9 rounded-full bg-card p-1">
          {(["days", "grid"] as const).map((v) => (
            <button
              key={v}
              role="tab"
              aria-selected={view === v}
              onClick={() => setView(v)}
              className={`label rounded-full px-3.5 text-[9px] ${view === v ? "bg-ink text-on-ink" : "text-muted"}`}
            >
              {t(v === "days" ? "Days" : "Grid")}
            </button>
          ))}
        </div>
      </div>

      {view === "days" ? (
        <DayFolders folders={folders} selected={day} onPick={setDay} />
      ) : (
        <section className="mt-2.5 rounded-[20px] bg-card p-4">
          <div className="flex items-center justify-between">
            <button aria-label={t("Previous month")} onClick={() => pickMonth(m === 0 ? [year - 1, 11] : [year, m - 1])} className="-ml-2 flex size-10 items-center justify-center">
              <ChevronLeft size={18} />
            </button>
            <span className="text-[15px] font-semibold">{new Date(year, m, 1).toLocaleDateString(dateLocale(), { month: "long", year: "numeric" })}</span>
            <button
              aria-label={t("Next month")}
              onClick={() => pickMonth(m === 11 ? [year + 1, 0] : [year, m + 1])}
              disabled={isThisMonth}
              className="-mr-2 flex size-10 items-center justify-center disabled:opacity-25"
            >
              <ChevronRight size={18} />
            </button>
          </div>
          <div className="mt-2 grid grid-cols-7 text-center">
            {weekdays.map((w, i) => (
              <span key={i} className="label pb-1.5 text-[9px] text-muted">
                {w}
              </span>
            ))}
            {cells.map((c, i) =>
              c === null ? (
                <span key={`e${i}`} />
              ) : (
                <button
                  key={c}
                  onClick={() => setDay(c)}
                  disabled={c > today}
                  aria-pressed={c === day}
                  aria-label={new Date(c).toLocaleDateString(dateLocale(), { weekday: "long", day: "numeric", month: "long" })}
                  className={`mx-auto flex size-10 flex-col items-center justify-center rounded-full text-[14px] disabled:opacity-25 ${
                    c === day ? "bg-ink font-semibold text-on-ink" : c === today ? "font-semibold underline underline-offset-4" : ""
                  }`}
                >
                  {new Date(c).getDate()}
                  <span className={`mt-0.5 size-1 rounded-full ${days.has(c) ? (c === day ? "bg-on-ink" : "bg-news-text") : "bg-transparent"}`} />
                </button>
              ),
            )}
          </div>
        </section>
      )}

      <section className="mt-6">
        <h2 className="label text-[11px] font-medium">
          {day === today ? t("Today") : new Date(day).toLocaleDateString(dateLocale(), { weekday: "long", day: "numeric", month: "long" })}
        </h2>
        {items.length === 0 ? (
          <p className="mt-2.5 rounded-[20px] bg-card px-4 py-3.5 text-[14px] text-muted">
            {log && (log.ms >= 60_000 || log.articles.length)
              ? [
                  log.ms >= 60_000 ? t("{time} of reading", { time: minutesText(Math.round(log.ms / 60_000)) }) : null,
                  log.articles.length ? t(log.articles.length === 1 ? "{n} story read" : "{n} stories read", { n: log.articles.length }) : null,
                ]
                  .filter(Boolean)
                  .join(" · ") + ". " + t("No lines kept this day.")
              : day === today
                ? t("Nothing read yet today.")
                : t("Nothing read this day.")}
          </p>
        ) : (
          <>
            <p className="mt-1.5 text-[13px] text-muted">
              {t(items.length === 1 ? "{n} thing read" : "{n} things read", { n: items.length })} ·{" "}
              {t(kept === 1 ? "{n} line kept" : "{n} lines kept", { n: kept })}
            </p>
            <CategoryChips items={items} />

            <h3 className="label mt-5 text-[10px] font-medium">{t(cards === 1 ? "Flash cards · {n}" : "Flash cards · {n}", { n: cards })}</h3>
            <FlashDeck key={day} items={items} />

            <h3 className="label mt-6 text-[10px] font-medium">{t("Read this day")}</h3>
            <div className="mt-2.5 flex flex-col gap-3">
              {items.map((it) => (
                <RecallCard key={it.key} item={it} />
              ))}
            </div>
          </>
        )}
      </section>

      <TabBar />
    </main>
  );
}
