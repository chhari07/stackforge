"use client";

// "Share PDF": the PDF as it looks in Stack, sent to another app. Highlights,
// handwriting and sticky notes are drawn onto the pages, so every PDF app
// shows them. Each sticky note (and each highlight with a note) also becomes
// a real PDF comment: tap it in Acrobat, Drive or Xodo and its text opens.
// The file is made on this device; nothing is uploaded.
import { registerPlugin } from "@capacitor/core";
import type { PDFDocument, PDFPage } from "pdf-lib";
import type { Note, NoteColor, PdfMeta, Sticky } from "./db";
import { strokePath } from "./ink";
import { openPdf } from "./pdf";
import { isNative } from "./platform";
import { tr } from "./i18n";

// How sticky notes look (components/pdf-extras.tsx draws them the same way).
export const STICKY_PAPER: Partial<Record<NoteColor, [front: string, back: string]>> = {
  orange: ["#FFE08A", "#EFCB6A"],
  green: ["#BFE8C8", "#A3D6AF"],
  red: ["#F9C4BF", "#EBA9A3"],
  blue: ["#BFDCF7", "#A2C7EA"],
};
export const stickyPaper = (n: Note) => STICKY_PAPER[n.color ?? "orange"] ?? STICKY_PAPER.orange!;
export const STICKY_WIDTH: Record<Sticky["size"], number> = { s: 0.11, m: 0.3, l: 0.44 }; // of the page's width

// Highlights in the reader: rgb(242 162 70 / 0.38), multiplied over the page.
const HIGHLIGHT = { r: 242 / 255, g: 162 / 255, b: 70 / 255, a: 0.38 };

type PdfLib = typeof import("pdf-lib");
type PdfJsDoc = Awaited<ReturnType<typeof openPdf>>;
type PdfJsPage = Awaited<ReturnType<PdfJsDoc["getPage"]>>;

const hex = (c: string) => {
  const m = /^#?([0-9a-f]{6})$/i.exec(c.trim());
  const n = m ? parseInt(m[1], 16) : 0x111111;
  return [(n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255] as const;
};

/** The PDF with this reader's marks on it, as bytes. Null when the PDF is locked (then share the original). */
export async function pdfWithNotes(meta: PdfMeta, file: Blob, notes: Note[]): Promise<Uint8Array | null> {
  const lib: PdfLib = await import("pdf-lib");
  const bytes = await file.arrayBuffer();
  const out = await lib.PDFDocument.load(bytes, { ignoreEncryption: true });
  // Saving an encrypted PDF without its password breaks it.
  if (out.isEncrypted) return null;
  // pdf.js takes over the buffer it's given, so it gets a copy.
  const src = await openPdf(bytes.slice(0));
  try {
    const mine = notes.filter((n) => n.pdfId === meta.id && n.page);
    const pages = new Set([...mine.map((n) => n.page!), ...Object.keys(meta.ink ?? {}).map(Number)]);
    for (const p of [...pages].sort((a, b) => a - b)) {
      if (p < 1 || p > out.getPageCount()) continue;
      const strokes = meta.ink?.[p] ?? [];
      const here = mine.filter((n) => n.page === p);
      if (!strokes.length && !here.length) continue;
      await markPage(lib, out, await src.getPage(p), p, here, strokes);
    }
  } finally {
    await src.loadingTask.destroy();
  }
  out.setProducer("Stack");
  return out.save();
}

async function markPage(
  lib: PdfLib,
  out: PDFDocument,
  src: PdfJsPage,
  pageNo: number,
  notes: Note[],
  strokes: NonNullable<PdfMeta["ink"]>[string],
) {
  const page = out.getPage(pageNo - 1);
  const vp = src.getViewport({ scale: 1 });
  // A page's own drawing commands can leave the coordinate system changed:
  // wrap them in save/restore so ours start from the page's own space.
  const ctx = out.context;
  page.node.normalize();
  const start = ctx.register(lib.PDFContentStream.of(ctx.obj({}), [lib.pushGraphicsState()]));
  const end = ctx.register(lib.PDFContentStream.of(ctx.obj({}), [lib.popGraphicsState()]));
  page.node.wrapContentStreams(start, end);

  // From the reader's page (0–1 across and down, as shown) to PDF points.
  const at = (fx: number, fy: number) => {
    const [x, y] = vp.convertToPdfPoint(fx * vp.width, fy * vp.height) as [number, number];
    return { x, y };
  };
  // drawSvgPath flips y, so paths are written with -y.
  const svg = (pts: { x: number; y: number }[]) =>
    pts.map((q, i) => `${i ? "L" : "M"}${q.x.toFixed(2)},${(-q.y).toFixed(2)}`).join("") + "Z";

  // 1. Highlights, under everything else.
  const quotes = notes.filter((n) => n.quote && !n.word && !n.sticky);
  const quads = quotes.length ? await findQuads(src, quotes.map((n) => n.quote!)) : [];
  quads.forEach((qs) =>
    qs.forEach((q) =>
      page.drawSvgPath(svg(q), {
        x: 0,
        y: 0,
        color: lib.rgb(HIGHLIGHT.r, HIGHLIGHT.g, HIGHLIGHT.b),
        opacity: HIGHLIGHT.a,
        blendMode: lib.BlendMode.Multiply,
      }),
    ),
  );

  // 2. Handwriting on the page: highlighter first, then the pen.
  for (const s of [...strokes.filter((s) => s.hl), ...strokes.filter((s) => !s.hl)]) {
    const pts: number[] = [];
    for (let i = 0; i + 1 < s.p.length; i += 2) {
      const q = at(s.p[i], s.p[i + 1]);
      pts.push(q.x, -q.y);
    }
    const [r, g, b] = hex(s.c);
    page.drawSvgPath(strokePath(pts, 1, 1), {
      x: 0,
      y: 0,
      borderColor: lib.rgb(r, g, b),
      borderWidth: Math.max(0.4, s.w * vp.width),
      borderLineCap: s.hl ? lib.LineCapStyle.Butt : lib.LineCapStyle.Round,
      borderOpacity: s.hl ? 0.38 : 1,
      ...(s.hl && { blendMode: lib.BlendMode.Multiply }),
    });
  }

  // 3. Sticky notes, drawn as they look, each with a comment on top.
  for (const n of notes.filter((n) => n.sticky)) {
    const s = n.sticky!;
    const card = await stickyPng(n);
    const w = STICKY_WIDTH[s.size] * vp.width;
    const h = w * card.ratio;
    const corner = at(s.x, s.y + h / vp.height); // bottom-left as shown
    page.drawImage(await out.embedPng(card.png), {
      x: corner.x,
      y: corner.y,
      width: w,
      height: h,
      rotate: lib.degrees(vp.rotation),
    });
    const text = n.body?.trim() || tr("Handwritten sticky note");
    comment(lib, out, page, at(s.x + w / vp.width, s.y), text, s.type, stickyPaper(n)[0]);
  }

  // 4. A highlight that has your note on it gets a comment beside it.
  quotes.forEach((n, i) => {
    const first = quads[i]?.[0];
    if (!n.body?.trim() || !first) return;
    comment(lib, out, page, { x: first[3].x - 12, y: first[3].y }, `“${n.quote}”\n\n${n.body.trim()}`, "note", "#F2A246");
  });
}

// A PDF "Text" annotation: the standard sticky-note comment every PDF app opens.
function comment(
  lib: PdfLib,
  out: PDFDocument,
  page: PDFPage,
  where: { x: number; y: number },
  text: string,
  type: Sticky["type"],
  color: string,
) {
  const ctx = out.context;
  const size = 18;
  const annot = ctx.obj({
    Type: "Annot",
    Subtype: "Text",
    Rect: [where.x - size / 2, where.y - size / 2, where.x + size / 2, where.y + size / 2],
    Contents: lib.PDFHexString.fromText(text),
    T: lib.PDFHexString.fromText("Stack"),
    M: lib.PDFString.fromDate(new Date()),
    Name: type === "question" ? "Help" : type === "flag" ? "Key" : "Comment",
    C: [...hex(color)],
    Open: false,
    F: 4 | 8 | 16, // print, and keep the icon upright and the same size at any zoom
  });
  page.node.addAnnot(ctx.register(annot));
}

type Point = { x: number; y: number };

// Where each quote sits on the page, as quads in PDF points (bottom-left,
// bottom-right, top-right, top-left), one per piece of text it runs through.
// Matching works like lib/highlights.ts does on the reader's text layer.
async function findQuads(page: PdfJsPage, quotes: string[]): Promise<Point[][][]> {
  const items = (await page.getTextContent()).items.filter((it) => "str" in it) as {
    str: string;
    width: number;
    transform: number[];
  }[];
  let text = "";
  const map: { item: number; offset: number }[] = [];
  let lastWasSpace = true;
  items.forEach((it, k) => {
    for (let i = 0; i < it.str.length; i++) {
      const isSpace = /\s/.test(it.str[i]);
      if (isSpace && lastWasSpace) continue;
      text += isSpace ? " " : it.str[i];
      map.push({ item: k, offset: i });
      lastWasSpace = isSpace;
    }
    if (!lastWasSpace) {
      text += " ";
      map.push({ item: k, offset: it.str.length });
      lastWasSpace = true;
    }
  });

  return quotes.map((quote) => {
    const q = quote.replace(/\s+/g, " ").trim();
    const found = q ? text.indexOf(q) : -1;
    if (found < 0) return [];
    // The first and last character of the quote in each text item it covers.
    const spans = new Map<number, [number, number]>();
    for (let c = found; c < found + q.length; c++) {
      const { item, offset } = map[c];
      if (offset >= items[item].str.length) continue; // the space added between items
      const span = spans.get(item);
      spans.set(item, span ? [span[0], offset + 1] : [offset, offset + 1]);
    }
    return [...spans].flatMap(([k, [from, to]]) => {
      const it = items[k];
      const [a, b, c, d, e, f] = it.transform;
      const size = Math.hypot(c, d);
      if (!it.width || !size) return [];
      const along = { x: a / Math.hypot(a, b), y: b / Math.hypot(a, b) };
      const up = { x: c / size, y: d / size };
      const pt = (t: number, s: number) => ({
        x: e + along.x * it.width * t + up.x * size * s,
        y: f + along.y * it.width * t + up.y * size * s,
      });
      const t0 = from / it.str.length;
      const t1 = to / it.str.length;
      return [[pt(t0, -0.22), pt(t1, -0.22), pt(t1, 0.92), pt(t0, 0.92)]];
    });
  });
}

// A sticky note drawn the way the reader shows it on a phone-sized page,
// at 3× for sharp print. `ratio` is its height over its width.
async function stickyPng(n: Note): Promise<{ png: ArrayBuffer; ratio: number }> {
  const s = n.sticky!;
  const REF = 400; // page width, in CSS pixels, the look is taken from
  const SCALE = 3;
  const small = s.size === "s";
  const flag = s.type === "flag";
  const w = Math.max(30, STICKY_WIDTH[s.size] * REF);
  const h = small ? w : flag ? Math.max(24, w * 0.3) : w;
  const font = Math.max(9, Math.min(15, w * 0.1));
  const [front] = stickyPaper(n);
  const family = getComputedStyle(document.body).fontFamily;

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(w * SCALE);
  canvas.height = Math.round(h * SCALE);
  const g = canvas.getContext("2d")!;
  g.scale(SCALE, SCALE);

  g.beginPath();
  if (flag) {
    g.moveTo(0, 0);
    g.lineTo(w, 0);
    g.lineTo(w - 9, h / 2);
    g.lineTo(w, h);
    g.lineTo(0, h);
    g.closePath();
  } else g.rect(0, 0, w, h);
  g.fillStyle = front;
  g.fill();
  g.clip();
  g.fillStyle = "#111";
  g.strokeStyle = "#111";

  if (!flag && !small) {
    g.fillStyle = "rgba(0,0,0,.06)";
    g.fillRect(0, 0, w, h * 0.14);
    g.fillStyle = "#111";
  }

  if (small && !n.ink?.length) {
    icon(g, s.type, w / 2, h / 2, w * 0.55);
  } else if (!small && n.body) {
    const pad = w * 0.08;
    g.font = `500 ${font}px ${family}`;
    g.textBaseline = "middle";
    let x = pad;
    if (s.type !== "note") {
      icon(g, s.type, pad + (font + 3) / 2, flag ? h / 2 : h * 0.14 + w * 0.05 + font * 0.62, font + 3);
      x += font + 3 + 4;
    }
    if (flag) {
      g.fillText(fit(g, n.body.replace(/\s+/g, " "), w - x - 14), x, h / 2);
    } else {
      const lineH = font * 1.25;
      let y = h * 0.14 + w * 0.05 + lineH / 2;
      for (const line of wrap(g, n.body, w - x - pad)) {
        if (y - lineH / 2 > h) break;
        g.fillText(line, x, y);
        y += lineH;
      }
    }
  }

  // Handwriting on the sticky, in its own 0–1 space.
  for (const st of n.ink ?? []) {
    g.save();
    g.globalAlpha = st.hl ? 0.38 : 1;
    g.strokeStyle = st.c;
    g.lineWidth = Math.max(0.6, st.w * w);
    g.lineCap = st.hl ? "butt" : "round";
    g.lineJoin = "round";
    g.stroke(new Path2D(strokePath(st.p, w, h)));
    g.restore();
  }

  const blob = await new Promise<Blob>((ok, fail) => canvas.toBlob((b) => (b ? ok(b) : fail(new Error("sticky not drawn"))), "image/png"));
  return { png: await blob.arrayBuffer(), ratio: h / w };
}

// Simple versions of the note, question and flag icons.
function icon(g: CanvasRenderingContext2D, type: Sticky["type"], cx: number, cy: number, size: number) {
  g.save();
  g.lineWidth = Math.max(1, size * 0.09);
  g.lineCap = "round";
  g.lineJoin = "round";
  const r = size / 2;
  if (type === "question") {
    g.beginPath();
    g.arc(cx, cy, r * 0.8, 0, Math.PI * 2);
    g.stroke();
    g.font = `700 ${size * 0.62}px sans-serif`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText("?", cx, cy + size * 0.03);
  } else if (type === "flag") {
    g.beginPath();
    g.moveTo(cx - r * 0.55, cy + r * 0.8);
    g.lineTo(cx - r * 0.55, cy - r * 0.75);
    g.lineTo(cx + r * 0.6, cy - r * 0.75);
    g.lineTo(cx + r * 0.3, cy - r * 0.35);
    g.lineTo(cx + r * 0.6, cy + r * 0.05);
    g.lineTo(cx - r * 0.55, cy + r * 0.05);
    g.stroke();
  } else {
    g.beginPath();
    g.roundRect(cx - r * 0.7, cy - r * 0.8, r * 1.4, r * 1.6, r * 0.18);
    g.moveTo(cx, cy - r * 0.35);
    g.lineTo(cx, cy + r * 0.35);
    g.moveTo(cx - r * 0.35, cy);
    g.lineTo(cx + r * 0.35, cy);
    g.stroke();
  }
  g.restore();
}

// Lines of `text` no wider than `max`, keeping the writer's own line breaks.
function wrap(g: CanvasRenderingContext2D, text: string, max: number) {
  const lines: string[] = [];
  for (const para of text.split("\n")) {
    let line = "";
    for (const word of para.split(/(\s+)/)) {
      const next = line + word;
      if (g.measureText(next).width <= max || !line.trim()) {
        line = next;
        // A single word wider than the note is broken across lines.
        while (g.measureText(line).width > max && line.length > 1) {
          let cut = line.length - 1;
          while (cut > 1 && g.measureText(line.slice(0, cut)).width > max) cut--;
          lines.push(line.slice(0, cut));
          line = line.slice(cut);
        }
      } else {
        lines.push(line.trimEnd());
        line = word.trimStart();
      }
    }
    lines.push(line.trimEnd());
  }
  return lines;
}

function fit(g: CanvasRenderingContext2D, text: string, max: number) {
  if (g.measureText(text).width <= max) return text;
  let t = text;
  while (t.length > 1 && g.measureText(t + "…").width > max) t = t.slice(0, -1);
  return t + "…";
}

const Files = registerPlugin<{
  shareImage(opts: { name: string; data: string; title: string; mime?: string }): Promise<void>;
}>("Backup");

const base64 = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1]);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });

/**
 * Sends the PDF, with everything drawn and written on it, to another app;
 * where sharing files isn't possible, downloads it. `marked` is false when
 * the PDF is locked and went out without the notes.
 */
export async function sharePdf(meta: PdfMeta, file: Blob, notes: Note[]): Promise<{ how: "shared" | "saved" | "cancelled"; marked: boolean }> {
  const bytes = await pdfWithNotes(meta, file, notes).catch(() => null);
  const blob = bytes ? new Blob([bytes as BlobPart], { type: "application/pdf" }) : file;
  const name = `${meta.title.replace(/[^\p{L}\p{N} ._-]+/gu, "").trim().slice(0, 80) || "stack"}.pdf`;
  const marked = !!bytes;
  if (isNative()) {
    await Files.shareImage({ name, data: await base64(blob), title: tr("Share PDF"), mime: "application/pdf" });
    return { how: "shared", marked };
  }
  const f = new File([blob], name, { type: "application/pdf" });
  // The browser may refuse once making the file took a while (the tap has "expired"): then download it.
  if (navigator.canShare?.({ files: [f] })) {
    try {
      await navigator.share({ files: [f], title: meta.title });
      return { how: "shared", marked };
    } catch (e) {
      if ((e as Error).name === "AbortError") return { how: "cancelled", marked };
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return { how: "saved", marked };
}
