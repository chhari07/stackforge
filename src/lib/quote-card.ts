"use client";

// Cards: a highlight, a line you selected, a word, a news story or your own
// note (or your year in numbers) drawn as a picture, 1080 wide in a shape
// you pick, with where it's from and the Stack mark.
// Drawn on a canvas on this device; nothing is uploaded.
import { registerPlugin } from "@capacitor/core";
import type { Note } from "./db";
import type { Story } from "./news";
import { BLOCKS } from "@/components/logo";
import { newsTime } from "./format";
import { isNative } from "./platform";
import { tr } from "./i18n";

// What goes on a card. `quoted` text is someone else's words and gets a quote
// mark; a `headline` (a story's title, a word) is set bold, with `body` under it.
export type CardText = {
  text: string;
  quoted: boolean;
  headline?: boolean;
  body?: string;
  title?: string;
  label?: string;
  stats?: { value: string; label: string }[]; // numbers under a headline (your year)
  image?: string; // a picture across the top, when it can be had
  link?: string; // sent along with the picture
};

/** The card for a word and its meaning. */
export const wordCard = (word: string, meaning?: string, sourceTitle?: string): CardText => ({
  text: word,
  quoted: false,
  headline: true,
  body: meaning?.trim() || undefined,
  title: sourceTitle,
  label: tr("Word"),
});

/** The card for a news story or video: headline, summary, source and time, with its link. */
export const storyCard = (
  s: Pick<Story, "title" | "source" | "url"> & Partial<Pick<Story, "summary" | "image" | "createdAt">>,
): CardText => ({
  text: s.title,
  quoted: false,
  headline: true,
  body: s.summary?.trim() || undefined,
  label: [s.source, s.createdAt && newsTime(s.createdAt)].filter(Boolean).join(" · "),
  image: s.image && /^https?:\/\//.test(s.image) ? s.image : undefined,
  link: s.url,
});

/** The card for a stored note: its word, its highlight, or else the note's own words. Null when there's nothing to show. */
export function cardOf(
  n: Pick<Note, "quote" | "body" | "title" | "word" | "checklist" | "sourceTitle" | "sourceLabel" | "page">,
): CardText | null {
  if (n.word) return n.quote?.trim() ? wordCard(n.quote, n.body, n.sourceTitle) : null;
  if (n.quote?.trim()) {
    return {
      text: n.quote,
      quoted: true,
      title: n.sourceTitle,
      label: [n.sourceLabel, n.page ? tr(n.sourceLabel === "EPUB" ? "ch. {n}" : "p. {n}", { n: n.page }) : ""].filter(Boolean).join(" · ") || undefined,
    };
  }
  const list = (n.checklist ?? []).filter((i) => i.text.trim()).map((i) => `${i.done ? "☑" : "☐"} ${i.text.trim()}`);
  const body = [n.body?.trim(), ...list].filter(Boolean).join("\n");
  const title = n.title?.trim();
  if (!body && !title) return null;
  return { text: body || title!, quoted: false, title: body ? title || n.sourceTitle : n.sourceTitle };
}

/** The same card as plain text: a story as its headline and link, anything else as its words. */
export const cardAsText = (c: CardText) =>
  c.link
    ? `${c.text}\n${c.link}`
    : [c.text, c.body, c.stats?.map((s) => `${s.value} ${s.label}`).join("\n")].filter(Boolean).join("\n\n");

export type CardTheme = "paper" | "ink" | "green" | "orange";
export const CARD_THEMES: { value: CardTheme; label: string }[] = [
  { value: "paper", label: "Paper" },
  { value: "ink", label: "Ink" },
  { value: "green", label: "Green" },
  { value: "orange", label: "Orange" },
];
// Same colours as the app's tokens (globals.css), fixed so a card looks the
// same whichever theme the phone is in.
const COLORS: Record<CardTheme, { bg: string; text: string; soft: string; accent: string }> = {
  paper: { bg: "#f7f5f0", text: "#111111", soft: "#6b6862", accent: "#0a8a3a" },
  ink: { bg: "#111111", text: "#f7f5f0", soft: "#a39f97", accent: "#f2a246" },
  green: { bg: "#d6eedc", text: "#111111", soft: "#065c27", accent: "#0a8a3a" },
  orange: { bg: "#fce3c4", text: "#111111", soft: "#8a4b00", accent: "#d62f26" },
};

// Shapes: portrait is what WhatsApp and Instagram posts show in full, square
// suits a feed, story fills a phone screen (Instagram and WhatsApp status).
export type CardSize = "portrait" | "square" | "story";
export const CARD_SIZES: { value: CardSize; label: string }[] = [
  { value: "portrait", label: "Portrait" },
  { value: "square", label: "Square" },
  { value: "story", label: "Story" },
];
// h: height; picture: height of a story's picture; inset: kept clear at the top
// and bottom, where story apps put their own buttons; mark: the quote mark's size.
const SIZES: Record<CardSize, { h: number; picture: number; inset: number; mark: number }> = {
  portrait: { h: 1350, picture: 430, inset: 0, mark: 240 },
  square: { h: 1080, picture: 300, inset: 0, mark: 170 },
  story: { h: 1920, picture: 640, inset: 190, mark: 240 },
};
const W = 1080;
const PAD = 96;
const INNER = W - PAD * 2;
const MAX_CHARS = 520;

// The app's fonts are loaded by next/font under generated names.
const family = (name: string, fallback: string) =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;

// Breaks text into lines that fit `width`, keeping its own line breaks.
function wrap(ctx: CanvasRenderingContext2D, text: string, width: number) {
  const lines: string[] = [];
  for (const para of text.split("\n")) {
    let line = "";
    for (const word of para.split(/\s+/)) {
      const next = line ? `${line} ${word}` : word;
      if (line && ctx.measureText(next).width > width) {
        lines.push(line);
        line = word;
      } else line = next;
    }
    if (line) lines.push(line);
  }
  return lines;
}

// At most `max` lines, the last one ending in "…" when some were dropped.
function clamp(lines: string[], max: number) {
  if (lines.length <= max) return lines;
  const kept = lines.slice(0, Math.max(1, max));
  kept[kept.length - 1] = `${kept[kept.length - 1].replace(/[\s.,;:]+\S*$/, "")}…`;
  return kept;
}

// The largest size, from `max` down to `min`, at which the text fits `room`.
function fit(
  ctx: CanvasRenderingContext2D,
  text: string,
  font: (size: number) => string,
  [max, min]: [number, number],
  leading: number,
  room: number,
) {
  for (let size = max; ; size -= 4) {
    ctx.font = font(size);
    const lines = wrap(ctx, text, INNER);
    const lead = size * leading;
    if (lines.length * lead <= room || size <= min) return { size, lead, lines: clamp(lines, Math.floor(room / lead)) };
  }
}

const loadImage = (src: string, ms: number) =>
  new Promise<HTMLImageElement | null>((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img.naturalWidth ? img : null);
    img.onerror = () => resolve(null);
    setTimeout(() => resolve(null), ms);
    img.src = src;
  });

// A story's picture, or null when it can't be had. A canvas can only be saved
// with pictures the page was allowed to read. Sites that allow it are loaded
// directly; for the rest the bytes are fetched another way: by the phone
// itself in the app (native HTTP has no such limit), through /api/image on
// the website.
async function loadPicture(src: string) {
  const direct = await loadImage(src, 2000);
  if (direct) return direct;
  try {
    const res = await fetch(isNative() ? src : `/api/image?url=${encodeURIComponent(src)}`, {
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return null;
    const blob = await res.blob();
    if (blob.type && !blob.type.startsWith("image/")) return null;
    const url = URL.createObjectURL(blob);
    const img = await loadImage(url, 3000);
    URL.revokeObjectURL(url);
    return img;
  } catch {
    return null;
  }
}

// The last few pictures, so a change of colour doesn't fetch one again.
const pictures = new Map<string, Promise<HTMLImageElement | null>>();

/** A story's picture, ready to draw; null when it can't be had. Slow on a slow connection, so cards are shown without it first. */
export function cardPicture(src: string) {
  let picture = pictures.get(src);
  if (!picture) {
    if (pictures.size >= 6) pictures.clear();
    picture = loadPicture(src);
    pictures.set(src, picture);
    picture.then((img) => !img && pictures.delete(src));
  }
  return picture;
}

function drawMark(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  // The logo's viewBox is 124 wide, from (242.5, 130).
  const k = size / 124;
  for (const b of BLOCKS) {
    ctx.save();
    ctx.translate(x + (b.cx - 242.5) * k, y + (b.cy - 130) * k);
    ctx.rotate((b.r * Math.PI) / 180);
    ctx.fillRect((-b.w / 2) * k, (-b.h / 2) * k, b.w * k, b.h * k);
    ctx.restore();
  }
}

export async function drawQuoteCard(card: CardText, theme: CardTheme, size: CardSize = "portrait") {
  const serif = family("--font-bodoni", "Georgia, serif");
  const sans = family("--font-archivo", "system-ui, sans-serif");
  const mono = family("--font-plex-mono", "monospace");
  // Wait for the app's fonts, but not for long: in the PDF reader, where the
  // book's own fonts are loading too, this can otherwise never finish.
  const [picture] = await Promise.all([
    card.image ? cardPicture(card.image) : null,
    Promise.race([
      Promise.all([
        document.fonts.load(`italic 500 60px ${serif}`),
        document.fonts.load(`500 60px ${serif}`),
        document.fonts.load(`800 60px ${sans}`),
        document.fonts.load(`400 36px ${sans}`),
        document.fonts.load(`500 24px ${mono}`),
      ]).catch(() => {}),
      new Promise((done) => setTimeout(done, 1200)),
    ]),
  ]);

  const c = COLORS[theme];
  const { h: H, picture: PICTURE, inset, mark } = SIZES[size];
  const foot = H - PAD - 114 - inset; // nothing but the Stack mark goes below this
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = c.bg;
  ctx.fillRect(0, 0, W, H);
  ctx.textBaseline = "alphabetic";

  let top = PAD + 60 + inset;
  const quoteMark = card.quoted && !picture;
  if (picture) {
    // Across the top, cropped to fill.
    const k = Math.max(W / picture.naturalWidth, PICTURE / picture.naturalHeight);
    const sw = W / k;
    const sh = PICTURE / k;
    ctx.drawImage(picture, (picture.naturalWidth - sw) / 2, (picture.naturalHeight - sh) / 2, sw, sh, 0, 0, W, PICTURE);
    top = PICTURE + 64;
  } else if (quoteMark) top += mark * 0.8;

  // Where it's from goes under the text; measured first, so the text knows its room.
  ctx.font = `600 36px ${sans}`;
  const from = card.title ? clamp(wrap(ctx, card.title, INNER), 2) : [];
  const room = foot - top - 70 - (from.length ? 14 + from.length * 46 : 0) - (card.label ? 44 : 0);

  // The text, as large as fits: quotes in italic serif, your own words upright,
  // a headline bold with its summary or numbers below. Your own words keep their line breaks.
  let text = card.quoted
    ? card.text.replace(/\s+/g, " ").trim()
    : card.text.replace(/[^\S\n]+/g, " ").replace(/\s*\n\s*/g, "\n").trim();
  if (text.length > MAX_CHARS) text = `${text.slice(0, MAX_CHARS).replace(/\s+\S*$/, "")}…`;
  const body = card.headline ? card.body?.replace(/[^\S\n]+/g, " ").replace(/\s*\n\s*/g, "\n").trim() : undefined;
  const BODY = { size: 36, lead: 52, gap: 34 };
  const stats = card.headline ? (card.stats ?? []).slice(0, 6) : [];
  const STAT = { row: size === "square" ? 132 : 156, gap: 44 };
  const statsH = stats.length ? STAT.gap + Math.ceil(stats.length / 2) * STAT.row : 0;
  const main = card.headline
    ? // A summary gets a smaller headline over it, and at least three lines.
      fit(ctx, text, (s) => `800 ${s}px ${sans}`, [body || statsH ? 64 : 76, 44], 1.16, room - statsH - (body ? BODY.gap + BODY.lead * 3 : 0))
    : fit(ctx, text, (s) => `${card.quoted ? "italic 500" : "500"} ${s}px ${serif}`, [84, 40], 1.28, room);
  const mainH = main.lines.length * main.lead;
  ctx.font = `400 ${BODY.size}px ${sans}`;
  const bodyLines = body ? clamp(wrap(ctx, body, INNER), Math.floor((room - mainH - statsH - BODY.gap) / BODY.lead)) : [];
  const used = mainH + statsH + (bodyLines.length ? BODY.gap + bodyLines.length * BODY.lead : 0);
  // A tall card with spare room sits its words nearer the middle.
  if (size === "story" && !picture) top += Math.max(0, room - used) * 0.38;

  if (quoteMark) {
    // Opening quote mark, for quoted text only.
    ctx.fillStyle = c.accent;
    ctx.font = `800 ${mark}px ${sans}`;
    ctx.fillText("“", PAD - 10, top - mark * 0.2);
  }
  ctx.font = `${card.headline ? "800" : card.quoted ? "italic 500" : "500"} ${main.size}px ${card.headline ? sans : serif}`;
  ctx.fillStyle = c.text;
  main.lines.forEach((l, i) => ctx.fillText(l, PAD, top + main.size + i * main.lead));
  let y = top + mainH;
  if (bodyLines.length) {
    ctx.font = `400 ${BODY.size}px ${sans}`;
    ctx.fillStyle = c.soft;
    bodyLines.forEach((l, i) => ctx.fillText(l, PAD, y + BODY.gap + BODY.size + i * BODY.lead));
    y += BODY.gap + bodyLines.length * BODY.lead;
  }
  if (stats.length) {
    // Numbers, two to a row: the figure large, what it counts under it.
    y += STAT.gap;
    stats.forEach((s, i) => {
      const x = PAD + (i % 2) * (INNER / 2);
      const rowY = y + Math.floor(i / 2) * STAT.row;
      ctx.fillStyle = i === 0 ? c.accent : c.text;
      ctx.font = `800 72px ${sans}`;
      ctx.fillText(s.value, x, rowY + 68);
      ctx.fillStyle = c.soft;
      ctx.font = `500 24px ${mono}`;
      ctx.fillText(s.label.toUpperCase(), x, rowY + 106);
    });
    y += Math.ceil(stats.length / 2) * STAT.row;
  }

  // Where it's from.
  ctx.fillStyle = c.accent;
  ctx.fillRect(PAD, y + 64, 72, 6);
  y += 70;
  if (from.length) {
    ctx.fillStyle = c.text;
    ctx.font = `600 36px ${sans}`;
    from.forEach((l, i) => ctx.fillText(l, PAD, y + 50 + i * 46));
    y += 14 + from.length * 46;
  }
  if (card.label) {
    ctx.fillStyle = c.soft;
    ctx.font = `500 24px ${mono}`;
    ctx.fillText(clamp(wrap(ctx, card.label.toUpperCase(), INNER), 1)[0], PAD, y + 44);
  }

  // Stack mark and name, bottom left; a small line on the right.
  const base = H - PAD - inset;
  ctx.fillStyle = c.text;
  drawMark(ctx, PAD - 6, base - 74, 84);
  ctx.font = `800 56px ${sans}`;
  ctx.fillText("STACK", PAD + 92, base - 8);
  ctx.fillStyle = c.soft;
  ctx.font = `500 20px ${mono}`;
  ctx.textAlign = "right";
  ctx.fillText(tr("STACK MAKES YOU REMEMBER WHAT YOU READ."), W - PAD, base - 12);

  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("card not drawn"))), "image/png"),
  );
}

const Files = registerPlugin<{
  shareImage(opts: { name: string; data: string; title: string; text?: string }): Promise<void>;
  shareText(opts: { title: string; text: string }): Promise<void>;
}>("Backup");

/** Sends plain text to another app. False when it could only be copied. */
export async function sharePlainText(text: string): Promise<boolean> {
  if (isNative()) {
    await Files.shareText({ title: tr("Share"), text });
    return true;
  }
  if (navigator.share) {
    await navigator.share({ text });
    return true;
  }
  await navigator.clipboard.writeText(text);
  return false;
}

const base64 = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1]);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });

/** Sends the card to another app, with `text` (a story's link) as its caption; where that isn't possible, saves it as a file. */
export async function shareCard(blob: Blob, text?: string): Promise<"shared" | "saved"> {
  const name = `stack-card-${Date.now().toString(36)}.png`;
  if (isNative()) {
    await Files.shareImage({ name, data: await base64(blob), title: tr("Share card"), text });
    return "shared";
  }
  const file = new File([blob], name, { type: "image/png" });
  if (navigator.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file], ...(text && { text }) });
    return "shared";
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return "saved";
}
