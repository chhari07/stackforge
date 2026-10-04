"use client";

// pdf.js is large and browser-only, so it's loaded on first use.
// The worker is served from /public (copied there by `npm run postinstall`).
// The "legacy" build carries polyfills for newer JS (Map.getOrInsertComputed,
// Math.sumPrecise) that older Android WebViews (e.g. Chrome 133) don't have.
type PdfJs = typeof import("pdfjs-dist/legacy/build/pdf.mjs");
let lib: Promise<PdfJs> | null = null;

export function pdfjs() {
  lib ??= import("pdfjs-dist/legacy/build/pdf.mjs").then((m) => {
    m.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
    return m;
  });
  return lib;
}

export async function openPdf(data: ArrayBuffer) {
  const { getDocument } = await pdfjs();
  return getDocument({ data }).promise;
}

type Doc = Awaited<ReturnType<typeof openPdf>>;

/** The text of one page, lines kept apart. */
export async function pdfPageText(doc: Doc, page: number) {
  const content = await (await doc.getPage(page)).getTextContent();
  return content.items
    .map((it) => ("str" in it ? it.str + (it.hasEOL ? "\n" : " ") : ""))
    .join("")
    .replace(/-\n(?=[a-z])/g, "");
}

/** The PDF's own table of contents (its outline), flattened, with the page each entry opens. */
export async function pdfOutline(doc: Doc) {
  type Node = { title: string; dest: string | unknown[] | null; items?: Node[] };
  const out: { title: string; page: number; depth: number }[] = [];
  const walk = async (nodes: Node[], depth: number) => {
    for (const n of nodes) {
      if (out.length >= 500) return;
      try {
        const dest = typeof n.dest === "string" ? await doc.getDestination(n.dest) : n.dest;
        const ref = dest?.[0];
        const index = typeof ref === "number" ? ref : ref ? await doc.getPageIndex(ref as Parameters<Doc["getPageIndex"]>[0]) : -1;
        if (index >= 0 && n.title?.trim()) out.push({ title: n.title.trim(), page: index + 1, depth });
      } catch {
        // An entry that points nowhere is left out.
      }
      if (n.items?.length && depth < 3) await walk(n.items, depth + 1);
    }
  };
  await walk(((await doc.getOutline()) ?? []) as Node[], 0);
  return out;
}

// Reads the title, page count and a cover thumbnail for a newly added PDF.
export async function inspectPdf(file: File) {
  const doc = await openPdf(await file.arrayBuffer());
  const info = (await doc.getMetadata().catch(() => null))?.info as { Title?: string } | undefined;
  const fromFile = file.name.replace(/\.pdf$/i, "").replace(/[_-]+/g, " ").trim();
  // Many PDFs carry junk titles ("about:blank", "Microsoft Word - x.docx").
  const meta = info?.Title?.trim() ?? "";
  const junk = meta.length < 3 || /^(about:|untitled|microsoft |slide ?\d)|:\/\/|\.(docx?|pptx?|tex|indd)$/i.test(meta);
  const title = junk ? fromFile : meta;

  const page = await doc.getPage(1);
  const base = page.getViewport({ scale: 1 });
  const viewport = page.getViewport({ scale: 240 / base.width });
  const canvas = document.createElement("canvas");
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);
  await page.render({ canvas, viewport }).promise;
  const cover = canvas.toDataURL("image/jpeg", 0.8);

  const pages = doc.numPages;
  await doc.loadingTask.destroy();
  return { title, pages, cover };
}
