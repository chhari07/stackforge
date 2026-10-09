"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { Chips } from "@/components/sheet";
import { PdfCover } from "@/components/pdf-cover";
import { useFocus, useTick } from "@/components/focus-provider";
import { useNowPlaying } from "@/components/now-playing";
import { useToast } from "@/components/toast";
import { BackIcon, PauseIcon, PlayIcon } from "@/components/icons";
import { addNote, getNotes, getPdfs, getSaved } from "@/lib/db";
import {
  clockText,
  focusedMs,
  getHistory,
  remainingMs,
  stats,
  breakMinutes,
  POMO,
  type FocusSession,
  type FocusTarget,
} from "@/lib/focus";
import { canGoBack } from "@/lib/nav";
import { DEFAULT_GOAL, getProfile } from "@/lib/profile";
import { useStore } from "@/lib/use-store";
import { dateLocale, useT } from "@/lib/i18n";

const LENGTHS = [
  { value: "15", label: "15 min" },
  { value: "25", label: "25 min" },
  { value: "45", label: "45 min" },
  { value: "60", label: "60 min" },
  { value: "pomo", label: "Pomodoro" },
] as const;
type Length = (typeof LENGTHS)[number]["value"];

const NONE: FocusTarget = { kind: "none", title: "Just focus" };
const sameTarget = (a: FocusTarget, b: FocusTarget) => a.kind === b.kind && a.id === b.id;

export default function Page() {
  // useSearchParams needs a Suspense boundary.
  return (
    <Suspense>
      <Focus />
    </Suspense>
  );
}

function Focus() {
  const t = useT();
  const { session } = useFocus();
  const router = useRouter();
  const back = () => (canGoBack() ? router.back() : router.push("/"));

  return (
    <main className="min-h-dvh px-5 pt-5 pb-16">
      <div className="flex h-8 items-center justify-between">
        <button aria-label={t("Back")} onClick={back} className="-ml-2.5 flex size-11 items-center justify-center">
          <BackIcon size={22} />
        </button>
        <Stats />
      </div>
      <div className="mx-auto max-w-[640px]">
        {!session && <Setup />}
        {session && !session.endedAt && <Running session={session} />}
        {session?.endedAt && (session.pomo?.brk ? <BreakOver session={session} /> : <Summary session={session} />)}
      </div>
    </main>
  );
}

function Stats() {
  const t = useT();
  const { session } = useFocus();
  const [s, setS] = useState<ReturnType<typeof stats> | null>(null);
  const [profile] = useStore(getProfile, { id: "me", updatedAt: 0 });
  // Re-read after a session ends.
  useEffect(() => {
    getHistory().then((h) => setS(stats(h)));
  }, [session?.endedAt]);
  if (!s || s.sessions === 0) return null;
  const goal = profile.dailyGoal ?? DEFAULT_GOAL;
  return (
    <span className="label text-[10px]">
      {t("{n}/{goal} min today", { n: s.todayMinutes, goal })}
      {s.todayMinutes >= goal ? " ✓" : ""}
      {s.streak > 1 ? ` · ${t("{n}-day streak", { n: s.streak })}` : ""}
    </span>
  );
}

// ---- 1. Set up ----
function Setup() {
  const tt = useT();
  const params = useSearchParams();
  const { start } = useFocus();
  const now = useNowPlaying();
  const [pdfs] = useStore(getPdfs, []);
  const [saved] = useStore(getSaved, []);
  const [length, setLength] = useState<Length>("25");
  const [music, setMusic] = useState(true);

  // Arriving from a reader preselects what you were reading.
  const asked = useMemo<FocusTarget | null>(() => {
    const kind = params.get("kind");
    const id = params.get("id");
    if ((kind !== "pdf" && kind !== "article") || !id) return null;
    const title = params.get("title") ?? "";
    return kind === "pdf"
      ? { kind, id, title, href: `/library/read?id=${id}` }
      : { kind, id, title: title || "Article", href: `/read?id=${id}` };
  }, [params]);

  const options = useMemo(() => {
    const list: FocusTarget[] = [
      ...[...pdfs]
        .sort((a, b) => (b.lastOpenedAt ?? b.addedAt) - (a.lastOpenedAt ?? a.addedAt))
        .slice(0, 10)
        .map((p) => ({ kind: "pdf" as const, id: p.id, title: p.title, href: `/library/read?id=${p.id}` })),
      ...saved
        .slice(0, 10)
        .map((a) => ({ kind: "article" as const, id: a.id, title: a.title, href: `/read?id=${a.id}` })),
    ];
    if (asked && !list.some((t) => sameTarget(t, asked))) list.unshift(asked);
    return [NONE, ...list];
  }, [pdfs, saved, asked]);

  const [picked, setPicked] = useState<FocusTarget | null>(null);
  const target = picked ?? options.find((t) => asked && sameTarget(t, asked)) ?? options[1] ?? NONE;

  return (
    <>
      <h1 className="display -ml-2 mt-3 text-[clamp(96px,33vw,170px)]">{tt("FOCUS")}</h1>
      <p className="mt-3 text-[15px] leading-relaxed text-muted">
        {tt("Pick one thing. Give it 25 minutes.")}
      </p>

      <h2 className="label mt-7 text-[11px] font-medium">01 — {tt("What are you reading?")}</h2>
      <div role="radiogroup" aria-label={tt("What to focus on")} className="rail -mx-5 mt-3 gap-3 px-5">
        {options.map((t) => {
          const on = sameTarget(t, target);
          return (
            <button
              key={`${t.kind}-${t.id ?? ""}`}
              role="radio"
              aria-checked={on}
              onClick={() => setPicked(t)}
              className={`flex w-[118px] flex-col gap-2 rounded-[14px] p-1.5 text-left ${on ? "bg-ink text-on-ink" : ""}`}
            >
              {t.kind === "pdf" ? (
                <PdfCover id={t.id!} title={t.title} className="h-[150px] w-[106px]" />
              ) : (
                <span
                  className={`flex h-[150px] w-[106px] items-end rounded-md p-2.5 ${
                    t.kind === "article" ? "bg-news-tint text-news-deep" : "bg-card text-ink"
                  }`}
                >
                  <span className="label text-[9px]">{t.kind === "article" ? tt("Article") : tt("No reading")}</span>
                </span>
              )}
              <span className="line-clamp-2 px-0.5 text-[13px] leading-tight font-semibold">
                {t.kind === "none" ? tt(t.title) : t.title}
              </span>
            </button>
          );
        })}
      </div>

      <h2 className="label mt-7 text-[11px] font-medium">02 — {tt("How long?")}</h2>
      <div className="mt-3">
        <Chips label={tt("Session length")} options={[...LENGTHS]} value={length} onChange={setLength} />
      </div>
      {length === "pomo" && (
        <p className="mt-3 rounded-2xl bg-card p-4 text-[14px] leading-relaxed text-muted">
          <b className="text-ink">{tt("{rounds} rounds of {mins} minutes.", { rounds: POMO.rounds, mins: POMO.focus })}</b>{" "}
          {tt("A {short}-minute break after each round and a {long}-minute break after the last. Music pauses during breaks.", {
            short: POMO.short,
            long: POMO.long,
          })}
        </p>
      )}

      <h2 className="label mt-7 text-[11px] font-medium">03 — {tt("Music")}</h2>
      <label className="mt-3 flex items-center gap-3 rounded-2xl bg-card p-4">
        <span className="flex min-w-0 grow flex-col gap-0.5">
          <span className="text-[15px] font-semibold">{tt("Play music while I focus")}</span>
          <span className="label truncate text-[10px] text-muted">
            {now ? `${now.title} · ${now.artist}` : tt("Nothing loaded yet")}
          </span>
        </span>
        <input
          type="checkbox"
          checked={music}
          onChange={(e) => setMusic(e.target.checked)}
          className="size-6 accent-[var(--color-music)]"
        />
      </label>
      {music && (
        <Link href="/music" className="label mt-2 inline-block text-[10px] underline">
          {now ? tt("Change music") : tt("Pick music first")}
        </Link>
      )}

      <button
        onClick={() =>
          length === "pomo" ? start(target, POMO.focus, music, { round: 1 }) : start(target, Number(length), music)
        }
        className="mt-8 flex h-14 w-full items-center justify-center gap-2 rounded-full bg-ink text-[16px] font-semibold text-on-ink"
      >
        <PlayIcon size={18} />{" "}
        {length === "pomo"
          ? tt("Start Pomodoro · round 1 of {n}", { n: POMO.rounds })
          : tt("Start {n} minutes", { n: length })}
      </button>
    </>
  );
}

// ---- 2. Running ----
function Running({ session }: { session: FocusSession }) {
  const t = useT();
  const { pause, resume, finish } = useFocus();
  const now = useNowPlaying();
  const toast = useToast();
  const [notes] = useStore(getNotes, []);
  const [thought, setThought] = useState("");
  const paused = !!session.pausedAt;
  const tick = useTick(!paused);
  const left = remainingMs(session, tick);
  const pct = 100 - (left / (session.minutes * 60_000)) * 100;
  const during = notes.filter((n) => n.createdAt >= session.startedAt);
  const brk = !!session.pomo?.brk;

  const capture = async () => {
    if (!thought.trim()) return;
    await addNote({
      kind: "idea",
      body: thought.trim(),
      sourceTitle: session.target.kind === "none" ? undefined : session.target.title,
      href: session.target.href,
    });
    setThought("");
    toast({ text: t("Saved to Notes") });
  };

  return (
    <>
      {session.pomo && <PomoDots session={session} />}
      <p className="label mt-6 text-[11px] text-muted">
        {paused
          ? t("Paused")
          : brk
            ? t("Break")
            : session.pomo
              ? t("Round {n} of {total} · focusing on", { n: session.pomo.round, total: POMO.rounds })
              : t("Focusing on")}
      </p>
      <p className="mt-1 line-clamp-2 font-serif text-[24px] leading-tight font-semibold">
        {brk
          ? t("Stretch. Water. Back in {n}.", { n: session.minutes })
          : session.target.kind === "none"
            ? t(session.target.title)
            : session.target.title}
      </p>

      <div
        role="timer"
        aria-label={t("{time} left", { time: clockText(left) })}
        className={`display mt-6 text-[clamp(110px,34vw,190px)] tabular-nums ${paused ? "opacity-40" : ""}`}
      >
        {clockText(left)}
      </div>
      <div className="mt-4 h-1 rounded-full bg-rule">
        <div
          className={`h-1 rounded-full transition-[width] duration-1000 ease-linear ${brk ? "bg-news" : "bg-music"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="label mt-2 flex justify-between text-[10px] text-muted">
        <span>
          {t(brk ? "{n} min of break" : "{n} min done", { n: Math.floor(focusedMs(session, tick) / 60_000) })}
        </span>
        <span>{t("{n} min", { n: session.minutes })}</span>
      </div>

      <div className="mt-6 flex gap-2.5">
        <button
          onClick={paused ? resume : pause}
          className="flex h-14 grow items-center justify-center gap-2 rounded-full bg-ink text-[16px] font-semibold text-on-ink"
        >
          {paused ? <PlayIcon size={18} /> : <PauseIcon size={18} />} {paused ? t("Resume") : t("Pause")}
        </button>
        <button
          onClick={finish}
          className="h-14 rounded-full border border-ink/20 px-6 text-[15px] font-semibold"
        >
          {brk ? t("Skip break") : t("End")}
        </button>
      </div>
      {!brk && session.target.href && (
        <Link
          href={session.target.href}
          className="mt-2.5 flex h-12 items-center justify-center rounded-full bg-card text-[15px] font-semibold"
        >
          {session.target.kind === "pdf" ? t("Open PDF") : t("Open article")}
        </Link>
      )}

      {now && (
        <div className="mt-5 flex items-center gap-3 rounded-2xl bg-card p-3">
          <span className={`size-2 shrink-0 rounded-full ${now.playing ? "bg-music" : "bg-muted"}`} />
          <span className="flex min-w-0 grow flex-col">
            <span className="song truncate text-[14px]">{now.title}</span>
            <span className="label truncate text-[9px] text-muted">{now.artist}</span>
          </span>
          <button
            aria-label={now.playing ? t("Pause music") : t("Play music")}
            onClick={now.toggle}
            className="flex size-11 shrink-0 items-center justify-center rounded-full bg-music text-white"
          >
            {now.playing ? <PauseIcon /> : <PlayIcon />}
          </button>
        </div>
      )}

      {!brk && (
        <>
      <h2 className="label mt-7 text-[11px] font-medium">{t("Capture a thought")}</h2>
      <div className="mt-2.5 flex gap-2">
        <input
          aria-label={t("Thought")}
          value={thought}
          onChange={(e) => setThought(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && capture()}
          enterKeyHint="done"
          placeholder={t("Park a thought here.")}
          className="h-12 min-w-0 grow rounded-full border border-ink/15 bg-card px-4 text-[15px] outline-none focus:border-ink"
        />
        <button
          onClick={capture}
          disabled={!thought.trim()}
          className="h-12 rounded-full bg-ink px-5 text-[14px] font-semibold text-on-ink disabled:opacity-40"
        >
          {t("Save")}
        </button>
      </div>
      {during.length > 0 && (
        <ul className="mt-4 flex flex-col gap-2">
          {during.map((n) => (
            <li key={n.id} className="rounded-xl bg-card px-3.5 py-2.5 text-[14px] leading-snug">
              {n.quote ? `“${n.quote}”` : n.body || n.title}
            </li>
          ))}
        </ul>
      )}
        </>
      )}
    </>
  );
}

// ---- 3. Summary ----
function Summary({ session }: { session: FocusSession }) {
  const t = useT();
  const { clear } = useFocus();
  const toast = useToast();
  const [notes] = useStore(getNotes, []);
  const [pdfs] = useStore(getPdfs, []);
  const [savedId, setSavedId] = useState<string | null>(null);

  const mins = Math.max(1, Math.round(focusedMs(session) / 60_000));
  const full = focusedMs(session) >= session.minutes * 60_000 - 1000;
  const during = notes.filter(
    (n) => n.createdAt >= session.startedAt && n.createdAt <= session.endedAt! && n.id !== savedId,
  );
  const highlights = during.filter((n) => n.quote);
  const thoughts = during.filter((n) => !n.quote);
  const endPage = pdfs.find((p) => p.id === session.target.id)?.lastPage;
  const pages = session.startPage && endPage ? Math.max(0, endPage - session.startPage) : null;

  const saveSummary = async () => {
    const lines = [
      session.target.kind === "none"
        ? t("{n} min focused", { n: mins })
        : t("{n} min focused on {title}", { n: mins, title: session.target.title }),
      pages !== null ? t("Pages {from} → {to} ({n} read)", { from: session.startPage ?? 0, to: endPage ?? 0, n: pages }) : "",
      highlights.length ? `\n${t("Highlights")}:\n${highlights.map((n) => `• ${n.quote}`).join("\n")}` : "",
      thoughts.length ? `\n${t("Thoughts")}:\n${thoughts.map((n) => `• ${n.body ?? n.title ?? ""}`).join("\n")}` : "",
    ].filter(Boolean);
    const note = await addNote({
      kind: "idea",
      title: `${t("Focus session")} · ${new Date(session.startedAt).toLocaleDateString(dateLocale(), { day: "numeric", month: "short" })}`,
      body: lines.join("\n"),
      color: "green",
      sourceTitle: session.target.kind === "none" ? undefined : session.target.title,
      href: session.target.href,
    });
    setSavedId(note.id);
    toast({ text: t("Summary saved to Notes"), href: `/notes/edit?id=${note.id}` });
  };

  const tiles = [
    { n: mins, label: t(mins === 1 ? "Minute" : "Minutes") },
    ...(pages !== null ? [{ n: pages, label: t(pages === 1 ? "Page" : "Pages") }] : []),
    { n: highlights.length, label: t(highlights.length === 1 ? "Highlight" : "Highlights") },
    { n: thoughts.length, label: t(thoughts.length === 1 ? "Note" : "Notes") },
  ];

  return (
    <>
      <h1 className="display -ml-2 mt-3 text-[clamp(88px,30vw,160px)]">{full ? t("DONE") : t("ENDED")}</h1>
      <p className="mt-3 font-serif text-[22px] leading-snug italic">
        {full ? "" : `${t("Every minute counts.")} `}
        {session.target.kind === "none"
          ? t(mins > 1 ? "{n} minutes of focus." : "{n} minute of focus.", { n: mins })
          : t(mins > 1 ? "{n} minutes on {title}." : "{n} minute on {title}.", { n: mins, title: session.target.title })}
        {full ? ` ${t("Your future self will thank you.")}` : ""}
      </p>

      <div className={`mt-6 grid gap-2.5 ${tiles.length === 4 ? "grid-cols-4" : "grid-cols-3"}`}>
        {tiles.map((x) => (
          <div key={x.label} className="flex flex-col gap-1 rounded-2xl bg-card px-3 py-3.5">
            <span className="display text-[40px] tabular-nums">{x.n}</span>
            <span className="label text-[9px] text-muted">{x.label}</span>
          </div>
        ))}
      </div>

      {during.length > 0 && (
        <>
          <h2 className="label mt-7 text-[11px] font-medium">{t("From this session")}</h2>
          <ul className="mt-2.5 flex flex-col gap-2">
            {during.map((n) => (
              <li key={n.id}>
                <Link href={`/notes/edit?id=${n.id}`} className="block rounded-xl bg-card px-3.5 py-2.5 text-[14px] leading-snug">
                  {n.quote ? `“${n.quote}”` : n.body || n.title}
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}

      {session.pomo && <PomoNext session={session} />}

      <div className="mt-8 flex flex-col gap-2.5">
        <button
          onClick={saveSummary}
          disabled={!!savedId}
          className="h-14 rounded-full bg-ink text-[16px] font-semibold text-on-ink disabled:opacity-40"
        >
          {savedId ? t("Saved to Notes") : t("Save summary to Notes")}
        </button>
        <button onClick={clear} className="h-12 rounded-full border border-ink/20 text-[15px] font-semibold">
          {session.pomo ? t("Stop Pomodoro") : t("Start another session")}
        </button>
      </div>
    </>
  );
}

// ---- Pomodoro ----
// One dot per round: done, current, to come.
function PomoDots({ session }: { session: FocusSession }) {
  const t = useT();
  const round = session.pomo!.round;
  return (
    <div className="mt-6 flex items-center gap-2" aria-label={t("Round {n} of {total}", { n: round, total: POMO.rounds })}>
      {Array.from({ length: POMO.rounds }, (_, i) => {
        const r = i + 1;
        const done = r < round || (r === round && (session.pomo!.brk || !!session.endedAt));
        return (
          <span
            key={r}
            className={`h-2 grow rounded-full ${done ? "bg-music" : r === round ? "bg-music/40" : "bg-rule"}`}
          />
        );
      })}
    </div>
  );
}

// After a focus round: take the break, or skip straight to the next round.
function PomoNext({ session }: { session: FocusSession }) {
  const t = useT();
  const { start } = useFocus();
  const round = session.pomo!.round;
  const mins = breakMinutes(round);
  const last = round >= POMO.rounds;
  return (
    <div className="mt-6 flex flex-col gap-2.5 rounded-[22px] bg-card p-4">
      <PomoDots session={session} />
      <p className="text-[15px] leading-snug">
        {last ? (
          <>
            <b>{t("All {n} rounds done.", { n: POMO.rounds })}</b> {t("You’ve earned a long break.")}
          </>
        ) : (
          <>
            <b>{t("Round {n} of {total} done.", { n: round, total: POMO.rounds })}</b>{" "}
            {t("Take a short break before the next one.")}
          </>
        )}
      </p>
      <button
        onClick={() => start(session.target, mins, false, { round, brk: true, music: session.music })}
        className="h-12 rounded-full bg-news text-[15px] font-semibold text-white"
      >
        {t("Start {n}-minute break", { n: mins })}
      </button>
      {!last && (
        <button
          onClick={() => start(session.target, POMO.focus, session.music, { round: round + 1 })}
          className="h-11 rounded-full text-[14px] font-semibold underline"
        >
          {t("Skip break, start round {n}", { n: round + 1 })}
        </button>
      )}
    </div>
  );
}

// A break has ended: on to the next round, or the cycle is complete.
function BreakOver({ session }: { session: FocusSession }) {
  const t = useT();
  const { start, clear } = useFocus();
  const round = session.pomo!.round;
  const done = round >= POMO.rounds;
  return (
    <>
      <h1 className="display -ml-1.5 mt-3 text-[clamp(64px,21vw,140px)]">{done ? t("CYCLE DONE") : t("BREAK’S OVER")}</h1>
      <PomoDots session={session} />
      <p className="mt-4 font-serif text-[22px] leading-snug italic">
        {done
          ? t("{n} rounds, {mins} minutes of focus. Brilliant.", { n: POMO.rounds, mins: POMO.rounds * POMO.focus })
          : t("Round {n} of {total} is next.", { n: round + 1, total: POMO.rounds })}
      </p>
      <div className="mt-8 flex flex-col gap-2.5">
        <button
          onClick={() =>
            done
              ? start(session.target, POMO.focus, session.pomo!.music ?? true, { round: 1 })
              : start(session.target, POMO.focus, session.pomo!.music ?? true, { round: round + 1 })
          }
          className="flex h-14 items-center justify-center gap-2 rounded-full bg-ink text-[16px] font-semibold text-on-ink"
        >
          <PlayIcon size={18} /> {done ? t("Start a new cycle") : t("Start round {n}", { n: round + 1 })}
        </button>
        <button onClick={clear} className="h-12 rounded-full border border-ink/20 text-[15px] font-semibold">
          {done ? t("Done") : t("Stop Pomodoro")}
        </button>
      </div>
    </>
  );
}
