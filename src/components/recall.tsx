"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getNotes, getPdfs, getSaved, type Note } from "@/lib/db";
import { grade, type Grade } from "@/lib/review";
import { useStore } from "@/lib/use-store";
import { cardsOf, categoriesOf, cloze, dayFolders, recallDays, recallFor, recallMonths, startOfDay, type DayFolder, type RecallItem } from "@/lib/recall";
import { minutesText, readingOn } from "@/lib/reading";
import { dateLocale, useT } from "@/lib/i18n";
import { noteHref } from "./note-card";
import { HomeSection } from "./home-sections";

// The three lists recall is built from, loaded once and kept fresh.
export function useRecallData() {
  const [notes, a] = useStore(getNotes, []);
  const [pdfs, b] = useStore(getPdfs, []);
  const [saved, c] = useStore(getSaved, []);
  return { notes, pdfs, saved, ready: a && b && c };
}

/** Category chips with counts: "Medical · 2". */
export function CategoryChips({ items }: { items: RecallItem[] }) {
  const cats = categoriesOf(items);
  if (cats.length === 0) return null;
  return (
    <div className="rail bleed mt-2.5 gap-1.5">
      {cats.map(([name, n]) => (
        <span key={name} className="label flex h-7 shrink-0 items-center gap-1.5 rounded-full bg-card px-3 text-[9px]">
          {name}
          <span className="text-muted">{n}</span>
        </span>
      ))}
    </div>
  );
}

/** One thing you read: where it's from, what you read and the lines you kept. */
export function RecallCard({ item }: { item: RecallItem }) {
  const t = useT();
  const [all, setAll] = useState(false);
  const shown = all ? item.kept : item.kept.slice(0, 2);
  const meta = [
    item.kind === "pdf" ? "PDF" : item.kind === "article" ? t("Article") : t("Note"),
    item.pages ? t(item.pages === 1 ? "{n} page read" : "{n} pages read", { n: item.pages }) : null,
    item.kept.length ? t(item.kept.length === 1 ? "{n} line kept" : "{n} lines kept", { n: item.kept.length }) : null,
  ].filter(Boolean);
  return (
    <article className="flex flex-col gap-2.5 rounded-[20px] bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="label truncate text-[9px] text-news-text">{item.category}</span>
        {item.href && (
          <Link href={item.href} className="label shrink-0 text-[9px] underline underline-offset-3">
            {t("Open")}
          </Link>
        )}
      </div>
      <h3 className="line-clamp-2 text-[16px] leading-snug font-semibold">{item.title}</h3>
      <span className="label text-[8px] text-muted">{meta.join(" · ")}</span>
      {shown.length > 0 ? (
        <ul className="flex flex-col gap-2 border-l-2 border-ink/15 pl-3">
          {shown.map((n) => (
            <li key={n.id}>
              <Link href={noteHref(n.id)} className="flex flex-col gap-0.5">
                {n.quote && <span className="font-serif text-[16px] leading-snug italic">“{n.quote}”</span>}
                {n.body && <span className="text-[13px] leading-snug text-muted">{n.body}</span>}
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <span className="text-[13px] text-muted">{t("Nothing kept yet. Open it and highlight the line you want to remember.")}</span>
      )}
      {item.kept.length > 2 && (
        <button onClick={() => setAll((a) => !a)} className="label self-start text-[9px] underline underline-offset-3">
          {all ? t("Show less") : t("Show all {n}", { n: item.kept.length })}
        </button>
      )}
    </article>
  );
}

// On Today: everything read today, one card each, there all day.
export function TodaysRecall() {
  const t = useT();
  const { notes, pdfs, saved, ready } = useRecallData();
  const [day, setDay] = useState<number | null>(null);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setDay(startOfDay(Date.now())), []);
  if (!ready || day === null) return null;
  const items = recallFor(day, notes, pdfs, saved);
  const kept = items.reduce((s, it) => s + it.kept.length, 0);
  const mins = Math.round((readingOn(day)?.ms ?? 0) / 60_000);
  return (
    <HomeSection title="Today's recall" href="/recall" link="Calendar">
      {items.length === 0 ? (
        <Link href="/recall" className="mt-2.5 flex flex-col gap-1 rounded-[20px] bg-card px-4 py-3.5">
          <span className="text-[14px] font-semibold">
            {mins ? t("{time} of reading today", { time: minutesText(mins) }) : t("Nothing read yet today")}
          </span>
          <span className="text-[13px] text-muted">{t("Read a PDF or an article and highlight a line. It shows up here, and stays all day.")}</span>
        </Link>
      ) : (
        <>
          <p className="mt-1.5 text-[13px] text-muted">
            {t(items.length === 1 ? "{n} thing read" : "{n} things read", { n: items.length })} ·{" "}
            {t(kept === 1 ? "{n} line kept" : "{n} lines kept", { n: kept })}
          </p>
          <CategoryChips items={items} />
          {cardsOf(items).length > 0 && (
            <Link href="/recall" className="mt-2.5 flex h-11 items-center justify-center rounded-full bg-ink text-[14px] font-semibold text-on-ink">
              {t(cardsOf(items).length === 1 ? "Practise {n} flash card" : "Practise {n} flash cards", { n: cardsOf(items).length })}
            </Link>
          )}
          <div className="mt-2.5 flex flex-col gap-3">
            {items.slice(0, 3).map((it) => (
              <RecallCard key={it.key} item={it} />
            ))}
          </div>
          {items.length > 3 && (
            <Link href="/recall" className="label mt-2.5 block text-center text-[10px] underline underline-offset-3">
              {t("See all {n} in the calendar", { n: items.length })}
            </Link>
          )}
        </>
      )}
    </HomeSection>
  );
}

/** A month picker: "October 2026 ▾". */
export function MonthSelect({ months, value, onChange }: { months: [number, number][]; value: [number, number]; onChange: (v: [number, number]) => void }) {
  const t = useT();
  return (
    <label className="relative flex h-9 items-center rounded-full bg-card pr-8 pl-4">
      <span className="sr-only">{t("Month")}</span>
      <select
        value={`${value[0]}-${value[1]}`}
        onChange={(e) => {
          const [y, m] = e.target.value.split("-").map(Number);
          onChange([y, m]);
        }}
        className="appearance-none bg-transparent text-[14px] font-semibold outline-none"
      >
        {months.map(([y, m]) => (
          <option key={`${y}-${m}`} value={`${y}-${m}`}>
            {new Date(y, m, 1).toLocaleDateString(dateLocale(), { month: "long", year: "numeric" })}
          </option>
        ))}
      </select>
      <span aria-hidden className="pointer-events-none absolute right-3.5 text-[10px]">
        ▼
      </span>
    </label>
  );
}

/** Day folders in a sideways row: the date, what was read and how many cards. */
export function DayFolders({
  folders,
  selected,
  onPick,
  hrefOf,
}: {
  folders: DayFolder[];
  selected?: number;
  onPick?: (day: number) => void;
  hrefOf?: (day: number) => string;
}) {
  const t = useT();
  if (folders.length === 0) return <p className="mt-2.5 rounded-[20px] bg-card px-4 py-3.5 text-[14px] text-muted">{t("No reading this month yet.")}</p>;
  return (
    <div role="list" className="rail bleed mt-2.5 gap-2.5">
      {folders.map((f) => {
        const on = f.day === selected;
        const d = new Date(f.day);
        const pdfs = f.items.filter((i) => i.kind === "pdf").length;
        const other = f.items.length - pdfs;
        const inner = (
          <>
            <span className={`label text-[9px] ${on ? "text-on-ink/70" : "text-muted"}`}>{d.toLocaleDateString(dateLocale(), { weekday: "short" })}</span>
            <span className="display text-[34px] leading-none">{d.getDate()}</span>
            <span className={`text-[12px] leading-tight ${on ? "text-on-ink/80" : "text-muted"}`}>
              {[pdfs ? t(pdfs === 1 ? "{n} PDF" : "{n} PDFs", { n: pdfs }) : null, other ? t(other === 1 ? "{n} article" : "{n} articles", { n: other }) : null]
                .filter(Boolean)
                .join(" · ") || t("Reading time")}
            </span>
            <span className={`label text-[8px] ${on ? "text-on-ink" : "text-news-text"}`}>{t(f.cards === 1 ? "{n} card" : "{n} cards", { n: f.cards })}</span>
          </>
        );
        const cls = `flex w-[118px] shrink-0 flex-col gap-1.5 rounded-[18px] p-3.5 text-left ${on ? "bg-ink text-on-ink" : "bg-card"}`;
        return (
          <div key={f.day} role="listitem">
            {hrefOf ? (
              <Link href={hrefOf(f.day)} className={cls}>
                {inner}
              </Link>
            ) : (
              <button onClick={() => onPick?.(f.day)} aria-pressed={on} className={cls}>
                {inner}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** A card's face: where it's from, then the line with key words hidden, or the whole line once flipped. */
function CardFace({ note, item, open, index, total }: { note: Note; item: RecallItem; open: boolean; index: number; total: number }) {
  const t = useT();
  const { front } = cloze(note.quote ?? "");
  const where = [item.title, note.page ? t("p. {n}", { n: note.page }) : null].filter(Boolean).join(" · ");
  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <span className="label truncate text-[9px] text-news-text">{item.category}</span>
        <span className="label shrink-0 text-[9px] text-muted">
          {index + 1} / {total}
        </span>
      </div>
      <span className="label line-clamp-1 text-[9px] text-muted">{where}</span>
      <div className="flex flex-1 flex-col justify-center gap-2">
        {open ? (
          <>
            <span className="font-serif text-[21px] leading-snug italic">“{note.quote}”</span>
            {note.body && <span className="text-[13px] text-muted">{note.body}</span>}
          </>
        ) : front ? (
          <span className="font-serif text-[21px] leading-snug italic">“{front}”</span>
        ) : (
          <span className="font-serif text-[21px] leading-snug text-muted italic">{t("What did you keep from this page?")}</span>
        )}
      </div>
      <span className="label text-center text-[9px] text-muted">{open ? t("← Again · Got it →") : t("Tap to flip")}</span>
    </>
  );
}

const SWIPE = 90; // px past which a let-go card flies off

/**
 * The day's flash cards as a stack you swipe: tap to flip, swipe right (or
 * Got it) if you remembered, left (or Again) if you didn't. Grading uses the
 * same schedule as the daily Review (lib/review.ts).
 */
export function FlashDeck({ items }: { items: RecallItem[] }) {
  const t = useT();
  const cards = cardsOf(items);
  const [i, setI] = useState(0);
  const [open, setOpen] = useState(false);
  const [dx, setDx] = useState(0);
  const [drag, setDrag] = useState<{ x: number; y: number; id: number; moved: boolean } | null>(null);
  const [fly, setFly] = useState<Grade | null>(null);
  const [score, setScore] = useState({ got: 0, again: 0 });

  if (cards.length === 0)
    return <p className="mt-2.5 rounded-[20px] bg-card px-4 py-3.5 text-[14px] text-muted">{t("No flash cards this day. Highlight a line while you read and it becomes a card.")}</p>;

  if (i >= cards.length)
    return (
      <div className="mt-2.5 flex flex-col items-center gap-2 rounded-[22px] bg-card px-5 py-7 text-center">
        <span className="display text-[40px] leading-none">{score.got}/{cards.length}</span>
        <span className="text-[15px] font-semibold">{t("Remembered")}</span>
        <span className="text-[13px] text-muted">
          {score.again ? t("{n} come back tomorrow, the rest in a few days.", { n: score.again }) : t("All of them come back in a few days.")}
        </span>
        <button
          onClick={() => {
            setI(0);
            setOpen(false);
            setScore({ got: 0, again: 0 });
          }}
          className="label mt-2 text-[10px] underline underline-offset-3"
        >
          {t("Go through again")}
        </button>
      </div>
    );

  const { note, item } = cards[i];
  const next = cards[i + 1];
  const mark = (g: Grade) => {
    if (fly) return;
    setFly(g);
    setScore((s) => ({ ...s, [g === "got" ? "got" : "again"]: s[g === "got" ? "got" : "again"] + 1 }));
    void grade(note, g);
    setTimeout(() => {
      setFly(null);
      setDx(0);
      setOpen(false);
      setI((n) => n + 1);
    }, 260);
  };

  const x = fly ? (fly === "got" ? 520 : -520) : dx;
  const hint = x > 30 ? "got" : x < -30 ? "again" : null;

  return (
    <div className="mt-2.5">
      <div className="relative h-[300px]">
        {next && (
          <div className="absolute inset-0 flex scale-[0.95] flex-col gap-3 rounded-[22px] bg-card p-5 opacity-60" aria-hidden>
            <CardFace note={next.note} item={next.item} open={false} index={i + 1} total={cards.length} />
          </div>
        )}
        <div
          role="button"
          tabIndex={0}
          aria-label={open ? t("Hide the answer") : t("Show the answer")}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") setOpen((o) => !o);
            if (open && e.key === "ArrowRight") mark("got");
            if (open && e.key === "ArrowLeft") mark("again");
          }}
          onPointerDown={(e) => {
            if (fly) return;
            e.currentTarget.setPointerCapture(e.pointerId);
            setDrag({ x: e.clientX, y: e.clientY, id: e.pointerId, moved: false });
          }}
          onPointerMove={(e) => {
            if (!drag || e.pointerId !== drag.id) return;
            const mx = e.clientX - drag.x;
            const my = e.clientY - drag.y;
            if (!drag.moved) {
              if (Math.abs(mx) < 8 && Math.abs(my) < 8) return;
              // Mostly up or down: that's a scroll, not a swipe. Let the card go.
              if (Math.abs(my) > Math.abs(mx)) {
                setDrag(null);
                return;
              }
              setDrag({ ...drag, moved: true });
            }
            setDx(mx);
          }}
          onPointerUp={(e) => {
            if (!drag || e.pointerId !== drag.id) return;
            const moved = drag.moved;
            setDrag(null);
            if (!moved) return Math.abs(e.clientY - drag.y) < 8 && setOpen((o) => !o);
            if (dx > SWIPE) mark("got");
            else if (dx < -SWIPE) mark("again");
            else setDx(0);
          }}
          onPointerCancel={() => {
            setDrag(null);
            setDx(0);
          }}
          className="absolute inset-0 flex cursor-grab touch-pan-y flex-col gap-3 rounded-[22px] bg-card p-5 shadow-[0_8px_30px_rgb(0_0_0/0.12)] select-none"
          style={{
            transform: `translateX(${x}px) rotate(${x / 22}deg)`,
            transition: drag ? "none" : "transform 260ms ease",
          }}
        >
          {hint && (
            <span
              className={`label absolute top-5 rounded-full px-3 py-1 text-[10px] ${hint === "got" ? "left-5 bg-news-text text-white" : "right-5 bg-ink text-on-ink"}`}
            >
              {t(hint === "got" ? "Got it" : "Again")}
            </span>
          )}
          <CardFace note={note} item={item} open={open} index={i} total={cards.length} />
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <button onClick={() => (open ? mark("again") : setOpen(true))} className="h-11 flex-1 rounded-full border border-ink/20 text-[14px] font-semibold">
          {open ? t("Again") : t("Flip")}
        </button>
        <button onClick={() => mark("got")} className="h-11 flex-1 rounded-full bg-ink text-[14px] font-semibold text-on-ink">
          {t("Got it")}
        </button>
      </div>
    </div>
  );
}

// In Library: what you read, as day folders for a month. A folder opens that day in Recall.
export function LibraryDays() {
  const t = useT();
  const { notes, pdfs, saved, ready } = useRecallData();
  const [now, setNow] = useState<number | null>(null);
  const [month, setMonth] = useState<[number, number] | null>(null);
  useEffect(() => {
    const d = new Date();
    /* eslint-disable react-hooks/set-state-in-effect */
    setNow(d.getTime());
    setMonth([d.getFullYear(), d.getMonth()]);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);
  const days = useMemo(() => (ready ? recallDays(notes) : new Set<number>()), [ready, notes]);
  const folders = useMemo(() => (ready && month ? dayFolders(month[0], month[1], days, notes, pdfs, saved) : []), [ready, month, days, notes, pdfs, saved]);
  if (!ready || !month || now === null) return null;
  return (
    <section className="mt-6">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-[16px] font-semibold">{t("Read by day")}</h2>
        <MonthSelect months={recallMonths(days, now)} value={month} onChange={setMonth} />
      </div>
      <DayFolders folders={folders} hrefOf={(day) => `/recall?day=${day}`} />
      <Link href="/recall" className="label mt-2.5 inline-block text-[10px] underline underline-offset-3">
        {t("Open Recall")}
      </Link>
    </section>
  );
}
