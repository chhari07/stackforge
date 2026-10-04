"use client";

// Your profile: name and photo. Stored like everything else (IndexedDB) and
// synced to your account when you're signed in.
import { get, set } from "idb-keyval";
import { emit } from "./db";
import { track } from "./sync-state";
import type { Topic } from "./news";

export type Accent = "ink" | "news" | "music" | "pdf" | "blue";
// Status icons (drawn in components/stack-icons.tsx, mapped in components/profile-icons.tsx).
export const MOOD_ICONS = [
  "reading", "in-the-zone", "learning", "writing", "building", "break", "night-owl", "offline",
  "chat", "rocket", "gamepad", "dumbbell", "travel", "sick", "party",
] as const;
export type MoodIcon = (typeof MOOD_ICONS)[number];
// `emoji` is how statuses were saved before they had icons.
export type Mood = { icon?: MoodIcon; text: string; emoji?: string };

export type Profile = {
  id: "me";
  name?: string;
  avatar?: string; // small JPEG data URL (lib/image.ts)
  bio?: string; // one line under the name
  mood?: Mood; // "what I'm up to", shown as a chip
  accent?: Accent; // the profile cover and initials colour
  interests?: Topic[]; // News shows these topics first
  readingFor?: ReadingFor; // asked on first launch; sets the first interests and Today's order
  dailyGoal?: number; // focus minutes a day
  updatedAt: number;
};

// "What are you reading for?" (first launch). Each answer picks the news
// topics you start with, and whether Today puts the news or your reading first.
export type ReadingFor = "exams" | "work" | "informed" | "me";
export const READING_FOR: { value: ReadingFor; label: string; hint: string; topics: Topic[] }[] = [
  { value: "exams", label: "Exams", hint: "GATE · JEE · NEET · UPSC", topics: ["india", "world", "science"] },
  { value: "work", label: "Work & skills", hint: "Get better at what you do", topics: ["tech", "ai", "business"] },
  { value: "informed", label: "Staying informed", hint: "Know what’s going on", topics: ["india", "world", "business"] },
  { value: "me", label: "Just for me", hint: "Books, ideas, curiosity", topics: ["science", "health", "entertainment"] },
];
/** Today shows your own reading before the news, except for "Staying informed". */
export const newsFirst = (p: Pick<Profile, "readingFor">) => p.readingFor === "informed";

export const BIO_MAX = 90;
export const GOALS = [15, 30, 45, 60, 90, 120];
export const DEFAULT_GOAL = 30;

// Tailwind classes per accent (written out so Tailwind keeps them).
export const ACCENTS: { value: Accent; label: string; bg: string; text: string }[] = [
  { value: "ink", label: "Ink", bg: "bg-ink", text: "text-on-ink" },
  { value: "news", label: "Green", bg: "bg-news", text: "text-white" },
  { value: "music", label: "Red", bg: "bg-music", text: "text-white" },
  { value: "pdf", label: "Orange", bg: "bg-pdf", text: "text-ink" },
  { value: "blue", label: "Blue", bg: "bg-blue", text: "text-white" },
];
export const accentOf = (a?: Accent) => ACCENTS.find((x) => x.value === a) ?? ACCENTS[0];

export const MOODS: Required<Pick<Mood, "icon" | "text">>[] = [
  { icon: "reading", text: "Reading" },
  { icon: "in-the-zone", text: "In the zone" },
  { icon: "learning", text: "Learning" },
  { icon: "writing", text: "Writing" },
  { icon: "building", text: "Building" },
  { icon: "break", text: "Taking a break" },
  { icon: "night-owl", text: "Night owl mode" },
  { icon: "offline", text: "Offline for a bit" },
];

const FROM_EMOJI: Record<string, MoodIcon> = {
  "📚": "reading", "🎧": "in-the-zone", "🧠": "learning", "✍️": "writing", "🛠️": "building",
  "☕": "break", "🌙": "night-owl", "🏖️": "offline", "💬": "chat", "🚀": "rocket", "🎮": "gamepad",
  "🏋️": "dumbbell", "✈️": "travel", "🤒": "sick", "🎉": "party",
};
export const moodIcon = (m: Mood): MoodIcon => m.icon ?? FROM_EMOJI[m.emoji ?? ""] ?? "chat";

export async function getProfile(): Promise<Profile> {
  return (await get<Profile>("profile")) ?? { id: "me", updatedAt: 0 };
}

export async function saveProfile(patch: Partial<Omit<Profile, "id">>) {
  const next: Profile = { ...(await getProfile()), ...patch, id: "me", updatedAt: Date.now() };
  await set("profile", next);
  await track("profile", "me");
  emit();
  return next;
}

export const initials = (name?: string) =>
  (name ?? "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("") || "S";
