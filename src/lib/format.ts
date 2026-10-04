import { dateLocale, tr } from "./i18n";
export function ago(ts: number | string) {
  const t = typeof ts === "string" ? Date.parse(ts) : ts;
  const s = Math.max(0, (Date.now() - t) / 1000);
  if (s < 60) return tr("now");
  if (s < 3600) return tr("{n}m", { n: Math.floor(s / 60) });
  if (s < 86400) return tr("{n}h", { n: Math.floor(s / 3600) });
  return tr("{n}d", { n: Math.floor(s / 86400) });
}

// When a story was published: "30 Sep, 7:44 pm" (with the year if it isn't this year).
export function newsTime(ts: number | string) {
  const d = new Date(ts);
  const date = d.toLocaleDateString(dateLocale(), {
    day: "numeric",
    month: "short",
    ...(d.getFullYear() !== new Date().getFullYear() && { year: "numeric" }),
  });
  return `${date}, ${time12(ts)}`;
}

// "7:44 pm"
export function time12(ts: number | string) {
  return new Date(ts).toLocaleTimeString(dateLocale(), { hour: "numeric", minute: "2-digit", hour12: true });
}

// "Good morning" before noon, "Good afternoon" until 5 pm, then "Good evening".
export function greeting(d = new Date()) {
  const h = d.getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

export function dayStamp(d = new Date()) {
  const day = d.toLocaleDateString(dateLocale(), { weekday: "short" });
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return { day, date: `${dd}.${mm}.${d.getFullYear()}` };
}

export function clock(ts: number) {
  return new Date(ts).toLocaleTimeString(dateLocale(), {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function noteTime(ts: number) {
  const d = new Date(ts);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return clock(ts);
  const y = new Date(today);
  y.setDate(today.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return tr("Yesterday");
  return d.toLocaleDateString(dateLocale(), { weekday: "short", day: "numeric", month: "short" });
}

// "1 song", "3 songs"
export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${tr(n === 1 ? one : many)}`;

export function mmss(ms: number) {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
