"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { getNotes, getPdfs, getSaved, type Note, type PdfMeta, type SavedArticle } from "@/lib/db";
import { useStore } from "@/lib/use-store";
import { todaysReview, reviewAt } from "@/lib/review";
import { getMeStats, EMPTY_STATS } from "@/lib/me-stats";
import { DEFAULT_GOAL, getProfile } from "@/lib/profile";
import { getReminder } from "@/lib/reminders";
import { importShared } from "@/lib/share-in";
import { folderKey, folderName } from "@/lib/saved-news";
import { TOPICS } from "@/lib/news";
import { ago } from "@/lib/format";
import { safeImage, type Story } from "@/lib/use-news";
import { useT } from "@/lib/i18n";
import { CheckIcon, ClockIcon, ExternalIcon, NoteIcon, PlusIcon } from "./icons";
import { NoteCard } from "./note-card";
import { PdfCover } from "./pdf-cover";
import { Sheet } from "./sheet";
import { useToast } from "./toast";
import { rememberStory, storyHref } from "./story";
import type { Lead } from "./now-card";

type T = (s: string, v?: Record<string, string | number>) => string;

/** A section title on Today, with a link on the right. */
export function HomeSection({ title, href, link, children }: { title: string; href?: string; link?: string; children: ReactNode }) {
  const t = useT();
  return (
    <section className="mt-6">
      <div className="flex items-baseline justify-between">
        <h2 className="label text-[11px] font-medium">{t(title)}</h2>
        {href && link && (
          <Link href={href} className="label text-[11px] underline underline-offset-3">
            {t(link)}
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

// 1 · Greeting, the line for this moment, and three status chips.
export function HomeHeader({ name, hello, line, stamp }: { name?: string; hello: string; line: string; stamp: string }) {
  const t = useT();
  const [pdfs] = useStore(getPdfs, []);
  const [saved] = useStore(getSaved, []);
  const [{ items, done }] = useStore(todaysReview, { items: [], done: [] });
  const open = pdfs.filter((p) => p.lastPage > 1 && p.lastPage < p.pages).length;
  const unread = saved.filter((a) => !a.readAt).length;
  const left = items.filter((n) => !done.includes(n.id)).length;
  const chips = [
    open ? t(open === 1 ? "1 book open" : "{n} books open", { n: open }) : "",
    unread ? t("{n} saved", { n: unread }) : "",
    left ? t(left === 1 ? "1 to review" : "{n} to review", { n: left }) : items.length ? t("Review done ✓") : "",
  ].filter(Boolean);
  return (
    <header className="mt-2 flex flex-col gap-1.5">
      <span className="label text-[10px] text-muted">{stamp}</span>
      <h1 className="font-serif text-[clamp(34px,10.5vw,46px)] leading-[1.02] tracking-[-0.01em]">
        {hello}
        {name && (
          <>
            , <em className="text-pdf-deep">{name}.</em>
          </>
        )}
      </h1>
      <p className="label text-[11px] text-news-text">{line}</p>
      {chips.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {chips.map((c) => (
            <span key={c} className="label flex h-7 items-center rounded-full bg-card px-3 text-[9px]">
              {c}
            </span>
          ))}
        </div>
      )}
    </header>
  );
}

type Step = { label: string; sub: string; state: "done" | "now" | "later" };

// 3 · Your day: what's done, what's now, what's later.
export function YourDay({ lead, hour }: { lead: Lead | null; hour: number }) {
  const t = useT();
  const [{ items, done }] = useStore(todaysReview, { items: [], done: [] });
  const [stats] = useStore(getMeStats, EMPTY_STATS);
  const [profile] = useStore(getProfile, { id: "me", updatedAt: 0 });
  const [saved] = useStore(getSaved, []);
  const [remind, setRemind] = useState<{ on: boolean; hour: number } | null>(null);
  // Settings live in localStorage: read after mount.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setRemind(getReminder()), []);
  if (!lead) return null;

  const goal = profile.dailyGoal ?? DEFAULT_GOAL;
  const left = items.filter((n) => !done.includes(n.id)).length;
  const unread = saved.filter((a) => !a.readAt).length;
  const steps: Step[] = [];
  if (lead.kind === "news" || profile.readingFor === "informed")
    steps.push({ label: "Morning brief", sub: lead.kind === "news" ? t("now") : hour >= 11 ? t("done") : "8–11 AM", state: lead.kind === "news" ? "now" : hour >= 11 ? "done" : "later" });
  if (items.length)
    steps.push({
      label: "Daily review",
      sub: left ? t("{n} · 1 min", { n: left }) : t("done"),
      state: !left ? "done" : lead.kind === "review" ? "now" : "later",
    });
  steps.push({
    label: t("Read {n} min", { n: goal }),
    sub: `${stats.todayMinutes}/${goal} ${t("min")}`,
    state: stats.todayMinutes >= goal ? "done" : lead.kind === "continue" || lead.kind === "focus-live" || lead.kind === "done" ? "now" : "later",
  });
  if (unread) steps.push({ label: "Saved stories", sub: t("{n} unread", { n: unread }), state: lead.kind === "saved" ? "now" : "later" });
  steps.push({ label: "Wind down", sub: "9 PM", state: lead.kind === "evening" ? "now" : "later" });
  if (remind?.on)
    steps.push({
      label: "Review",
      sub: t("tomorrow {time}", { time: `${remind.hour % 12 || 12} ${remind.hour < 12 ? "AM" : "PM"}` }),
      state: "later",
    });
  const shown = steps.slice(0, 5);
  const finished = shown.filter((s) => s.state === "done").length;

  return (
    <HomeSection title="Your day">
      <span className="sr-only">{t("{n} of {total} done", { n: finished, total: shown.length })}</span>
      <ol className="mt-2.5 flex">
        {shown.map((s, i) => (
          <li key={s.label + i} className="relative flex flex-1 flex-col items-center gap-1 text-center">
            {i > 0 && (
              <span
                aria-hidden
                className={`absolute top-[12px] right-1/2 h-0.5 w-full ${s.state === "later" ? "bg-ink/15" : "bg-news-text"}`}
              />
            )}
            <span
              className={`relative z-10 flex size-6 items-center justify-center rounded-full ${
                s.state === "done"
                  ? "bg-news-text text-white"
                  : s.state === "now"
                    ? "bg-ink shadow-[0_0_0_4px_color-mix(in_srgb,var(--color-ink)_20%,transparent)]"
                    : "border border-ink/20 bg-paper"
              }`}
            >
              {s.state === "done" && <CheckIcon size={13} />}
            </span>
            <span className={`text-[11px] leading-tight font-semibold ${s.state === "later" ? "text-muted" : ""}`}>{t(s.label)}</span>
            <span className="label text-[8px] text-muted">{s.state === "now" ? t("now") : s.sub}</span>
          </li>
        ))}
      </ol>
    </HomeSection>
  );
}

// 4 · Quick actions: one tap to add or start something.
export function QuickActions() {
  const t = useT();
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [url, setUrl] = useState("");
  const tile = "flex h-[58px] flex-col items-center justify-center gap-1 rounded-[18px] bg-card text-[11px] font-semibold";
  return (
    <div className="mt-4 grid grid-cols-4 gap-2">
      <Link href="/library" className={tile}>
        <PlusIcon size={18} /> {t("Add PDF")}
      </Link>
      <Link href="/notes/edit" className={tile}>
        <NoteIcon size={18} /> {t("Note")}
      </Link>
      <Link href="/focus" className={tile}>
        <ClockIcon size={18} /> {t("Focus")}
      </Link>
      <button onClick={() => setSaving(true)} className={tile}>
        <ExternalIcon size={18} /> {t("Save link")}
      </button>
      <Sheet open={saving} onClose={() => setSaving(false)} title="Save a link">
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const r = await importShared({ kind: "text", text: url.trim() });
            setSaving(false);
            setUrl("");
            toast(
              r.kind === "link"
                ? { text: t("Saved to your Library"), href: "/library", action: t("Library") }
                : { text: t("Saved to Notes"), href: "/notes" },
            );
          }}
          className="flex flex-col gap-3"
        >
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            type="url"
            inputMode="url"
            placeholder="https://"
            aria-label={t("Link")}
            className="h-12 rounded-xl border border-ink/15 bg-card px-4 text-[15px] outline-none focus:border-ink"
          />
          <p className="text-[13px] text-muted">{t("Stack keeps a copy to read offline, and it waits in Saved for later.")}</p>
          <button type="submit" disabled={!/^https?:\/\/\S+\.\S+/.test(url.trim())} className="h-12 rounded-full bg-ink text-[15px] font-semibold text-on-ink disabled:opacity-40">
            {t("Save")}
          </button>
        </form>
      </Sheet>
    </div>
  );
}

function SavedRow({ a, t }: { a: SavedArticle; t: T }) {
  const img = safeImage(a.image);
  return (
    <Link href={`/read?id=${a.id}`} className="flex items-center gap-3 rounded-[20px] bg-card p-3">
      {img ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={img} alt="" className="size-16 shrink-0 rounded-2xl object-cover" />
      ) : (
        <span className="display flex size-16 shrink-0 items-center justify-center rounded-2xl bg-news-tint text-[22px] text-news-deep">{a.source.slice(0, 1).toUpperCase()}</span>
      )}
      <span className="flex min-w-0 flex-col gap-1">
        <span className="label truncate text-[9px] text-blue-deep">
          {folderName(folderKey(a), t)} · {t("unread")}
        </span>
        <span className="line-clamp-2 text-[14px] leading-snug font-semibold">{a.title}</span>
        <span className="label truncate text-[8px] text-muted">
          {[a.source, a.readMinutes ? t("{n} min", { n: a.readMinutes }) : ""].filter(Boolean).join(" · ")}
        </span>
      </span>
    </Link>
  );
}

// 5 · Saved for later: unread stories you saved (also from notifications).
export function SavedForLater({ skip }: { skip?: string }) {
  const t = useT();
  const [saved] = useStore(getSaved, []);
  const unread = saved.filter((a) => !a.readAt);
  const list = unread.filter((a) => a.id !== skip).slice(0, 2);
  if (!list.length) return null;
  return (
    <HomeSection title={t("Saved for later · {n} unread", { n: unread.length })} href="/library" link="Library">
      <div className="mt-2.5 flex flex-col gap-2">
        {list.map((a) => (
          <SavedRow key={a.id} a={a} t={t} />
        ))}
      </div>
    </HomeSection>
  );
}

// 6 · Your reading: books in progress first, then the rest, and Add.
export function YourReading({ skip }: { skip?: string }) {
  const t = useT();
  const [pdfs] = useStore(getPdfs, []);
  const pct = (p: PdfMeta) => Math.round((p.lastPage / Math.max(1, p.pages)) * 100);
  const list = [...pdfs]
    .filter((p) => p.id !== skip)
    .sort((a, b) => {
      const open = (p: PdfMeta) => Number(p.lastPage > 1 && p.lastPage < p.pages);
      return open(b) - open(a) || (b.lastOpenedAt ?? b.addedAt) - (a.lastOpenedAt ?? a.addedAt);
    })
    .slice(0, 10);
  return (
    <HomeSection title="Your reading" href="/library" link={t(pdfs.length === 1 ? "{n} book" : "{n} books", { n: pdfs.length })}>
      {list.length || pdfs.length ? (
        <div role="list" aria-label={t("Your PDFs")} className="rail bleed mt-2.5 gap-3">
          {list.map((p) => (
            <Link key={p.id} role="listitem" href={`/library/read?id=${p.id}`} className="flex w-[104px] flex-col gap-1.5">
              <PdfCover id={p.id} title={p.title} plain={p.coverStyle === "stack"} marked={!!p.bookmarks?.length} progress={p.lastPage > 1 ? p.lastPage / p.pages : 0} className="h-[142px] w-[104px]" />
              <span className="line-clamp-2 font-serif text-[13px] leading-[1.15] font-semibold">{p.title}</span>
              <span className="label text-[8px] text-muted">
                {p.lastPage >= p.pages ? t("Done") : `${pct(p)}% · ${t("p. {n}", { n: p.lastPage })}`}
              </span>
            </Link>
          ))}
          <Link href="/library" className="flex h-[142px] w-[104px] flex-col items-center justify-center gap-2 rounded-md border border-dashed border-ink/25 text-muted">
            <PlusIcon size={20} />
            <span className="label text-[9px]">{t("Add PDF")}</span>
          </Link>
        </div>
      ) : (
        <Link href="/library" className="mt-2.5 flex h-[88px] items-center justify-center rounded-2xl border border-dashed border-ink/25">
          <span className="label text-[10px] text-muted">{t("Add a PDF to highlight and review")}</span>
        </Link>
      )}
    </HomeSection>
  );
}

// 7 · Kept today: today's notes, and what comes back tomorrow.
export function KeptToday() {
  const t = useT();
  const [notes] = useStore(getNotes, []);
  const [morning, setMorning] = useState<{ start: number; tomorrow: number } | null>(null);
  useEffect(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    const start = d.getTime();
    const r = getReminder();
    d.setDate(d.getDate() + 1);
    d.setHours(r.hour, r.minute, 0, 0);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMorning({ start, tomorrow: d.getTime() });
  }, []);
  if (!morning) return null;
  const today = notes.filter((n) => n.createdAt >= morning.start);
  const shown: Note[] = today.length ? today.slice(0, 8) : notes.slice(0, 8);
  const back = reviewAt(notes, morning.tomorrow);
  return (
    <HomeSection title={today.length ? "Kept today" : "What you kept"} href="/notes" link="Notes">
      {shown.length > 0 ? (
        <div role="list" aria-label={t("Recent notes")} className="rail bleed mt-2.5 items-start gap-3">
          {shown.map((n) => (
            <div key={n.id} role="listitem" className="w-[216px]">
              <NoteCard note={n} compact />
            </div>
          ))}
          <Link href="/notes/edit" className="flex h-[120px] w-[150px] flex-col items-center justify-center gap-2 rounded-[14px] border border-dashed border-ink/25 text-muted">
            <PlusIcon size={20} />
            <span className="label text-[9px]">{t("New note")}</span>
          </Link>
        </div>
      ) : (
        <Link href="/notes/edit" className="mt-2.5 flex h-[88px] items-center justify-center rounded-2xl border border-dashed border-ink/25">
          <span className="label text-[10px] text-muted">{t("Write a note to keep what you learn")}</span>
        </Link>
      )}
      {back.length > 0 && (
        <Link href="/review" className="mt-2.5 flex flex-col gap-1.5 rounded-[20px] bg-card px-4 py-3.5">
          <span className="label text-[10px] font-medium text-news-text">{t("Comes back tomorrow · {n}", { n: back.length })}</span>
          <span className="line-clamp-2 font-serif text-[16px] leading-snug italic">“{back[0].quote}”</span>
        </Link>
      )}
    </HomeSection>
  );
}

// 8 · News for you: three short headlines from your topics.
export function NewsForYou({ stories, topics, status }: { stories: Story[]; topics: string[]; status: string }) {
  const t = useT();
  const names = topics.map((x) => t(TOPICS.find((o) => o.value === x)?.label ?? x)).join(" · ");
  return (
    <HomeSection title={names ? t("News for you · {topics}", { topics: names }) : "News for you"} href="/news" link="All news">
      <div className="mt-2.5 flex flex-col gap-3 rounded-[20px] bg-card p-4">
        {stories.length === 0 ? (
          <span className="label text-[10px] text-muted">{status === "error" ? t("Couldn't load news") : t("Loading news…")}</span>
        ) : (
          stories.slice(0, 3).map((s, i) => (
            <Link key={s.id} href={storyHref(s)} onClick={() => rememberStory(s)} className="flex items-center gap-3">
              <span className="display flex size-9 shrink-0 items-center justify-center rounded-xl bg-ink/8 text-[18px]">{i + 1}</span>
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="line-clamp-2 text-[14px] leading-snug font-semibold">{s.title}</span>
                <span className="label truncate text-[8px] text-muted">
                  {s.source} · {ago(s.createdAt)}
                </span>
              </span>
            </Link>
          ))
        )}
      </div>
    </HomeSection>
  );
}

// 10 · Sign-off: the wordmark and the promise, at the end of the page.
export function SignOff() {
  const t = useT();
  return (
    <div className="mt-10 flex flex-col items-center gap-2 text-center">
      <span className="display text-[clamp(64px,22vw,96px)] opacity-90">STACK</span>
      <span className="font-serif text-[16px] text-muted italic">{t("Stack makes you remember what you read.")}</span>
    </div>
  );
}
