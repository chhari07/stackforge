"use client";

// Keeps the Android home screen widget current (StackWidget.java): a
// highlight to recall, the streak, and the PDF in progress. The widget can't
// read the app's storage, so the app hands it the text whenever things change.
import { registerPlugin } from "@capacitor/core";
import { getNotes, getPdfs } from "./db";
import { getMeStats } from "./me-stats";
import { isNative } from "./platform";
import { nextHighlight, todaysReview } from "./review";

type WidgetPlugin = {
  set(opts: { quote: string; source: string; quoteHref: string; reading: string; readingHref: string; streak: number }): Promise<void>;
  pin(): Promise<{ asked: boolean }>;
};
const Widget = registerPlugin<WidgetPlugin>("Widget");

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n).replace(/\s+\S*$/, "")}…` : s);

export async function updateWidget() {
  if (!isNative()) return;
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
