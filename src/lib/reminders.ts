"use client";

// The daily highlights notification (Android app only): each morning, the
// highlights in that day's review. Local notifications scheduled on the
// phone: no push server, nothing leaves the device.
import { LocalNotifications } from "@capacitor/local-notifications";
import { getNotes, getPdfs, type Note, type PdfMeta } from "./db";
import { isNative } from "./platform";
import { loadNews } from "./platform";
import { reviewAt } from "./review";
import { dateLocale, tr } from "./i18n";

const KEY = "stack.reminder";
const DIGEST_ID = 1001;
// The Stack logo in colour, shown as the notification's picture
// (resources/android/drawable-nodpi/stack_logo.png).
export const NOTIFY_LOGO = "stack_logo";

export type Reminder = { on: boolean; hour: number; minute: number };
const DEFAULT: Reminder = { on: false, hour: 9, minute: 0 };

export function getReminder(): Reminder {
  try {
    return { ...DEFAULT, ...JSON.parse(localStorage.getItem(KEY) ?? "{}") };
  } catch {
    return DEFAULT;
  }
}

function saveReminder(r: Reminder) {
  localStorage.setItem(KEY, JSON.stringify(r));
}

export async function notificationsAllowed() {
  return (await LocalNotifications.checkPermissions()).display === "granted";
}

// Shows Android's "Allow Stack to send you notifications?" prompt.
export async function askForNotifications() {
  const status = await LocalNotifications.requestPermissions();
  return status.display === "granted";
}

// What one morning's notification says. Highlights come first: the ones in
// that day's review, so the notification is the review's front door. With
// none due, it's the top story and the book in progress.
type Digest = { title: string; body: string; href: string };
type News = Awaited<ReturnType<typeof loadNews>>[number];

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n).trimEnd()}…` : s);

function digestText(due: Note[], reading: PdfMeta | undefined, top: News | undefined): Digest {
  const book = reading ? tr("Continue “{title}” at p. {n}", { title: reading.title, n: reading.lastPage }) : "";
  if (due.length) {
    const quotes = due.map((n) => `“${clip(n.quote!.replace(/\s+/g, " ").trim(), 90)}”`);
    return {
      title: tr(due.length === 1 ? "1 highlight to remember" : "{n} highlights to remember", { n: due.length }),
      body: [...quotes, book].filter(Boolean).join("\n"),
      href: "/review",
    };
  }
  const lines = [top ? tr("Top story: {title}", { title: top.title }) : "", book].filter(Boolean);
  return {
    title: tr("Your reading day"),
    body: lines.length ? lines.join("\n") : tr("Highlight a line today and it comes back tomorrow."),
    href: top ? `/read?id=${top.id}` : reading ? `/library/read?id=${reading.id}` : "/news",
  };
}

// The notification text is fixed when it's scheduled, so the next month is
// scheduled one day at a time, each with that day's own highlights. (A
// repeating notification can't do this, and Android repeats an `at` schedule
// by its distance from now, not daily.)
const DAYS = 30;
const dayId = (d: number) => DIGEST_ID + 100 + d; // 1101…1130 (1002 is the focus timer)
let lastTop: News | undefined;

async function digestPlan(r: Reminder, withNews: boolean) {
  const [notes, pdfs, stories] = await Promise.all([
    getNotes(),
    getPdfs(),
    withNews ? loadNews("top").catch(() => []) : Promise.resolve(lastTop ? [lastTop] : []),
  ]);
  if (withNews) lastTop = stories[0];
  const reading = [...pdfs].sort((a, b) => (b.lastOpenedAt ?? 0) - (a.lastOpenedAt ?? 0))[0];
  const plan: { at: Date; digest: Digest }[] = [];
  for (let d = 0; d < DAYS; d++) {
    const at = new Date();
    at.setDate(at.getDate() + d);
    at.setHours(r.hour, r.minute, 0, 0);
    if (at.getTime() <= Date.now()) continue;
    // Today's news is only news today.
    plan.push({ at, digest: digestText(reviewAt(notes, at.getTime()), reading, plan.length ? undefined : stories[0]) });
  }
  return plan;
}

// (Re)schedules the daily notifications. Called when settings change, each
// time the app opens and a moment after anything is saved, so the text
// matches what's due. `withNews: false` skips fetching the top story.
export async function scheduleDigest(r = getReminder(), { withNews = true } = {}) {
  const ids = [DIGEST_ID, ...Array.from({ length: DAYS + 1 }, (_, d) => dayId(d))]; // + the old weekly repeat
  await LocalNotifications.cancel({ notifications: ids.map((id) => ({ id })) }).catch(() => {});
  if (!r.on || !(await notificationsAllowed())) return;
  const plan = await digestPlan(r, withNews);
  const notify = (id: number, d: Digest, schedule: object) => ({
    id,
    title: d.title,
    body: d.body,
    largeBody: d.body,
    largeIcon: NOTIFY_LOGO,
    schedule: { allowWhileIdle: true, ...schedule },
    isExactNotification: false,
    extra: { href: d.href },
  });
  await LocalNotifications.schedule({
    notifications: plan.map((p, i) => notify(dayId(i), p.digest, { at: p.at })),
  });
}

export async function setReminder(r: Reminder) {
  if (r.on && !(await notificationsAllowed()) && !(await askForNotifications())) {
    saveReminder({ ...r, on: false });
    return false;
  }
  saveReminder(r);
  await scheduleDigest(r);
  return true;
}

export async function sendTestNotification() {
  if (!(await notificationsAllowed()) && !(await askForNotifications())) return false;
  // Shows what the next one will say.
  const [next] = await digestPlan({ ...getReminder(), hour: 23, minute: 59 }, true);
  const d = next?.digest ?? { title: tr("Your reading day"), body: tr("Open Stack for today’s review."), href: "/review" };
  await LocalNotifications.schedule({
    notifications: [
      {
        id: Math.floor(Math.random() * 100000) + 2000,
        title: d.title,
        body: d.body,
        largeBody: d.body,
        largeIcon: NOTIFY_LOGO,
        // No schedule = show right away. Never ask for the exact-alarm permission.
        isExactNotification: false,
        extra: { href: d.href },
      },
    ],
  });
  return true;
}

// ---- Reminders on a note ----
// A note's `remindAt` becomes a local notification on the phone. On the
// website the time only shows on the note; it rings once the note has synced
// to the Android app.

// A notification id (a 31-bit number) from a note's id.
const noteAlarmId = (id: string) => {
  let h = 7;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return 100_000 + (Math.abs(h) % 2_000_000_000);
};

/** Makes the phone's alarms match the notes' reminders. Called at launch and after notes change. */
export async function scheduleNoteReminders() {
  if (!isNative()) return;
  const pending = (await LocalNotifications.getPending()).notifications.filter((n) => n.extra?.noteId);
  if (pending.length) await LocalNotifications.cancel({ notifications: pending.map((n) => ({ id: n.id })) });
  if (!(await notificationsAllowed())) return;
  const now = Date.now();
  const due = (await getNotes()).filter((n) => n.remindAt && n.remindAt > now);
  if (!due.length) return;
  await LocalNotifications.schedule({
    notifications: due.map((n) => {
      const list = (n.checklist ?? []).filter((i) => !i.done).map((i) => i.text);
      const text = [n.quote && `“${n.quote}”`, n.body, list.join(" · ")].filter(Boolean).join("\n").slice(0, 240);
      return {
        id: noteAlarmId(n.id),
        title: n.title?.trim() || tr("A note to come back to"),
        body: text || tr("Open the note"),
        largeIcon: NOTIFY_LOGO,
        largeBody: text || undefined,
        schedule: { at: new Date(n.remindAt!), allowWhileIdle: true },
        extra: { href: `/notes/edit?id=${n.id}`, noteId: n.id },
      };
    }),
  });
}

/** True when a reminder set now will ring: in the app, with notifications allowed (asks once). */
export async function canRing() {
  if (!isNative()) return false;
  return (await notificationsAllowed()) || (await askForNotifications());
}

// "Today, 6:00 pm", "Tomorrow, 9:00 am", "Sun 4 Oct, 9:00 am"
export function remindText(at: number, now = Date.now()) {
  const d = new Date(at);
  const time = d.toLocaleTimeString(dateLocale(), { hour: "numeric", minute: "2-digit", hour12: true });
  const days = Math.round((new Date(at).setHours(0, 0, 0, 0) - new Date(now).setHours(0, 0, 0, 0)) / 86_400_000);
  const day =
    days === 0
      ? tr("Today")
      : days === 1
        ? tr("Tomorrow")
        : d.toLocaleDateString(dateLocale(), { weekday: "short", day: "numeric", month: "short" });
  return `${day}, ${time}`;
}

/** True while a reminder's time is still to come. */
export const upcoming = (at?: number) => !!at && at > Date.now();

// For <input type="datetime-local">: local time as "2026-10-02T18:00".
export const localValue = (t = Date.now()) => {
  const d = new Date(t - new Date(t).getTimezoneOffset() * 60_000);
  return d.toISOString().slice(0, 16);
};

// Ready-made times: later today, this evening, tomorrow morning, next week.
export function quickTimes(now = Date.now()) {
  const at = (days: number, hour: number) => {
    const d = new Date(now);
    d.setDate(d.getDate() + days);
    d.setHours(hour, 0, 0, 0);
    return d.getTime();
  };
  return [
    { label: tr("In 1 hour"), at: now + 3_600_000 },
    ...(new Date(now).getHours() < 17 ? [{ label: tr("This evening"), at: at(0, 18) }] : []),
    { label: tr("Tomorrow morning"), at: at(1, 9) },
    { label: tr("Next week"), at: at(7, 9) },
  ];
}
