"use client";

// The daily digest notification (Android app only). It's a local notification
// scheduled on the phone: no push server, nothing leaves the device.
import { LocalNotifications } from "@capacitor/local-notifications";
import { getNotes, getPdfs } from "./db";
import { isNative } from "./platform";
import { loadNews } from "./platform";
import { nextHighlight } from "./review";
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

// What the digest says: today's top story and the PDF in progress.
async function digestText() {
  const [stories, pdfs, highlight] = await Promise.all([
    loadNews("top").catch(() => []),
    getPdfs(),
    nextHighlight().catch(() => null),
  ]);
  const top = stories[0];
  const reading = [...pdfs].sort((a, b) => (b.lastOpenedAt ?? 0) - (a.lastOpenedAt ?? 0))[0];
  const quote = highlight?.quote
    ? highlight.quote.length > 110
      ? `${highlight.quote.slice(0, 110)}…`
      : highlight.quote
    : "";
  const lines = [
    top ? tr("Top story: {title}", { title: top.title }) : tr("Fresh stories from Hacker News and dev.to"),
    reading ? tr("Continue “{title}” at p. {n}", { title: reading.title, n: reading.lastPage }) : "",
    quote ? tr("Remember: “{quote}”", { quote }) : "",
  ].filter(Boolean);
  // With a highlight waiting, tapping opens the daily review.
  return { body: lines.join("\n"), href: quote ? "/review" : top ? `/read?id=${top.id}` : "/news" };
}

// (Re)schedules the daily digest. Called when settings change and each time
// the app opens, so the text stays close to what's current.
export async function scheduleDigest(r = getReminder()) {
  await LocalNotifications.cancel({ notifications: [{ id: DIGEST_ID }] }).catch(() => {});
  if (!r.on || !(await notificationsAllowed())) return;
  const { body, href } = await digestText();
  await LocalNotifications.schedule({
    notifications: [
      {
        id: DIGEST_ID,
        title: tr("Your tech day"),
        body,
        largeBody: body,
        largeIcon: NOTIFY_LOGO,
        schedule: { on: { hour: r.hour, minute: r.minute }, allowWhileIdle: true },
        isExactNotification: false,
        extra: { href },
      },
    ],
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
  const { body, href } = await digestText();
  await LocalNotifications.schedule({
    notifications: [
      {
        id: Math.floor(Math.random() * 100000) + 2000,
        title: tr("Your tech day"),
        body,
        largeBody: body,
        largeIcon: NOTIFY_LOGO,
        // No schedule = show right away. Never ask for the exact-alarm permission.
        isExactNotification: false,
        extra: { href },
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
