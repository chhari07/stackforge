"use client";

// Keeps the Android home screen widgets current: a highlight to recall, the
// streak and the PDF in progress (StackWidget.java), and the notes list
// (NotesWidget.java). Widgets can't read the app's storage, so the app hands
// them the text whenever things change.
import { registerPlugin } from "@capacitor/core";
import { getNotes, getPdfs, type Note } from "./db";
import { getMeStats } from "./me-stats";
import { isNative } from "./platform";
import { nextHighlight, todaysReview } from "./review";

type WidgetPlugin = {
  set(opts: { quote: string; source: string; quoteHref: string; reading: string; readingHref: string; streak: number }): Promise<void>;
  setNotes(opts: { notes: string }): Promise<void>;
  pin(): Promise<{ asked: boolean }>;
  pinNotes(): Promise<{ asked: boolean }>;
};
const Widget = registerPlugin<WidgetPlugin>("Widget");

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n).replace(/\s+\S*$/, "")}…` : s);

const NOTES_SHOWN = 20;

/** One row of the notes widget. Date text is left to the widget, so it stays right as days pass. */
function noteRow(n: Note) {
  const list = n.checklist?.map((i) => i.text).filter(Boolean).join(", ");
  const text = n.title || n.body || n.quote || list || (n.ink?.length ? "Handwritten note" : "Empty note");
  const quote = !n.title && !n.body && !!n.quote;
  const page = n.page ? ` · p. ${n.page}` : "";
  return {
    kind: n.pinned ? "Pinned" : n.quote ? "Highlight" : n.checklist ? "List" : "Note",
    text: clip(text.replace(/\s+/g, " ").trim(), 180),
    quote,
    source: n.sourceTitle ? `${clip(n.sourceTitle, 40)}${page}` : "",
    at: n.updatedAt ?? n.createdAt,
    href: `/notes/edit?id=${n.id}`,
  };
}

/** Pinned notes first, then the newest. getNotes is already newest first, and the sort keeps that order. */
async function updateNotesWidget() {
  const notes = (await getNotes()).filter((n) => !n.word);
  const shown = [...notes].sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned)).slice(0, NOTES_SHOWN);
  await Widget.setNotes({ notes: JSON.stringify(shown.map(noteRow)) });
}

export async function updateWidget() {
  if (!isNative()) return;
  await updateNotesWidget().catch(() => {});
  const [review, notes, pdfs, stats, upcoming] = await Promise.all([
    todaysReview(),
    getNotes(),
    getPdfs(),
    getMeStats(),
    nextHighlight().catch(() => null),
  ]);
  // Today's review first, then what's coming up, then the newest highlight.
  const due = review.items.find((n) => !review.done.includes(n.id) && !n.word);
  const pick = due ?? (upcoming && !upcoming.word ? upcoming : null) ?? notes.find((n) => n.quote && !n.word) ?? null;
  const reading = [...pdfs].sort((a, b) => (b.lastOpenedAt ?? b.addedAt) - (a.lastOpenedAt ?? a.addedAt))[0];
  await Widget.set({
    quote: pick?.quote ? clip(pick.quote.replace(/\s+/g, " ").trim(), 180) : "",
    source: pick?.sourceTitle ? clip(pick.sourceTitle, 60) : "",
    quoteHref: due ? "/review" : pick ? `/notes/edit?id=${pick.id}` : "/news",
    reading: reading ? `${clip(reading.title, 40)} · ${reading.format === "epub" ? "ch." : "p."} ${reading.lastPage} / ${reading.pages}` : "",
    readingHref: reading ? `/library/read?id=${reading.id}` : "/library",
    streak: stats.activeStreak,
  });
}

/** Asks the home screen to add the widget. False when this launcher can't do that from an app. */
export async function addWidget() {
  await updateWidget().catch(() => {});
  return (await Widget.pin()).asked;
}

/** The same for the notes widget. */
export async function addNotesWidget() {
  await updateNotesWidget().catch(() => {});
  return (await Widget.pinNotes()).asked;
}
