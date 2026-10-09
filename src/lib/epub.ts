"use client";

// EPUB books. An EPUB is a zip of XHTML chapters with a manifest saying what
// order they come in. Read on this device: unzipped with the browser's own
// decompression, each chapter cleaned (no scripts or styles) before it's shown.
// In Stack a chapter is a "page", so bookmarks, notes and progress work as
// they do for PDFs.
import DOMPurify from "dompurify";
import { ALLOWED_TAGS } from "./article";

// ---- zip ----
type Entry = { method: number; start: number; size: number };

class Zip {
  private view: DataView;
  private entries = new Map<string, Entry>();

  constructor(private buf: ArrayBuffer) {
    const v = (this.view = new DataView(buf));
    // The directory's place is in a record at the very end of the file.
    let end = buf.byteLength - 22;
    while (end >= 0 && v.getUint32(end, true) !== 0x06054b50) end--;
    if (end < 0) throw new Error("not a zip file");
    const count = v.getUint16(end + 10, true);
    let at = v.getUint32(end + 16, true);
    const utf8 = new TextDecoder();
    for (let i = 0; i < count && v.getUint32(at, true) === 0x02014b50; i++) {
      const nameLen = v.getUint16(at + 28, true);
      const name = utf8.decode(new Uint8Array(buf, at + 46, nameLen));
      this.entries.set(name, { method: v.getUint16(at + 10, true), size: v.getUint32(at + 20, true), start: v.getUint32(at + 42, true) });
      at += 46 + nameLen + v.getUint16(at + 30, true) + v.getUint16(at + 32, true);
    }
  }

  has(name: string) {
    return this.entries.has(name);
  }

  async bytes(name: string): Promise<Uint8Array> {
    const e = this.entries.get(name);
    if (!e) throw new Error(`missing ${name}`);
    const v = this.view;
    const data = e.start + 30 + v.getUint16(e.start + 26, true) + v.getUint16(e.start + 28, true);
    const packed = new Uint8Array(this.buf, data, e.size);
    if (e.method === 0) return packed;
    if (e.method !== 8) throw new Error("unsupported zip compression");
    const stream = new Blob([packed]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }

  async text(name: string) {
    return new TextDecoder().decode(await this.bytes(name));
  }
}

// ---- the book ----
export type Chapter = { path: string; title?: string };
export type TocItem = { title: string; page: number; depth: number };
export type Epub = {
  title: string;
  author?: string;
  chapters: Chapter[];
  toc: TocItem[];
  coverPath?: string;
  zip: Zip;
};

const xml = (text: string) => new DOMParser().parseFromString(text, "application/xml");
const all = (root: Document | Element, tag: string) => [...root.getElementsByTagNameNS("*", tag)];
// "OEBPS/text/ch1.xhtml" + "../images/a.png" → "OEBPS/images/a.png"
function resolve(from: string, href: string) {
  const u = new URL(href, `http://book/${from.split("/").map(encodeURIComponent).join("/")}`);
  return { path: decodeURIComponent(u.pathname.slice(1)), hash: u.hash.slice(1) };
}

export async function openEpub(buf: ArrayBuffer): Promise<Epub> {
  const zip = new Zip(buf);
  const container = xml(await zip.text("META-INF/container.xml"));
  const opfPath = all(container, "rootfile")[0]?.getAttribute("full-path");
  if (!opfPath) throw new Error("not an EPUB");
  const opf = xml(await zip.text(opfPath));

  const items = new Map<string, { path: string; type: string; props: string }>();
  for (const it of all(opf, "item")) {
    const href = it.getAttribute("href");
    if (!href) continue;
    items.set(it.getAttribute("id") ?? href, {
      path: resolve(opfPath, href).path,
      type: it.getAttribute("media-type") ?? "",
      props: it.getAttribute("properties") ?? "",
    });
  }
  const chapters: Chapter[] = all(opf, "itemref")
    .map((r) => items.get(r.getAttribute("idref") ?? ""))
    .filter((it): it is NonNullable<typeof it> => !!it && /html|xml/.test(it.type) && zip.has(it.path))
    .map((it) => ({ path: it.path }));
  if (!chapters.length) throw new Error("no chapters");
  const pageOf = (path: string) => chapters.findIndex((c) => c.path === path) + 1;

  // Contents: the EPUB 3 "nav" page, or the older NCX file.
  const toc: TocItem[] = [];
  const add = (title: string | null | undefined, from: string, href: string | null, depth: number) => {
    const page = href ? pageOf(resolve(from, href).path) : 0;
    const t = title?.replace(/\s+/g, " ").trim();
    if (page && t && toc.length < 500) toc.push({ title: t, page, depth: Math.min(depth, 3) });
  };
  const nav = [...items.values()].find((i) => /\bnav\b/.test(i.props));
  const ncx = [...items.values()].find((i) => i.type === "application/x-dtbncx+xml");
  try {
    if (nav && zip.has(nav.path)) {
      const doc = new DOMParser().parseFromString(await zip.text(nav.path), "text/html");
      const root = doc.querySelector('nav[epub\\:type~="toc"], nav[role="doc-toc"]') ?? doc.querySelector("nav");
      const walk = (ol: Element | null | undefined, depth: number) => {
        for (const li of ol ? [...ol.children].filter((c) => c.localName === "li") : []) {
          const a = [...li.children].find((c) => c.localName === "a" || c.localName === "span");
          add(a?.textContent, nav.path, a?.getAttribute("href") ?? null, depth);
          walk([...li.children].find((c) => c.localName === "ol"), depth + 1);
        }
      };
      walk(root?.querySelector("ol"), 0);
    }
    if (!toc.length && ncx && zip.has(ncx.path)) {
      const doc = xml(await zip.text(ncx.path));
      const walk = (parent: Element, depth: number) => {
        for (const p of [...parent.children].filter((c) => c.localName === "navPoint")) {
          add(all(p, "text")[0]?.textContent, ncx.path, all(p, "content")[0]?.getAttribute("src") ?? null, depth);
          walk(p, depth + 1);
        }
      };
      const map = all(doc, "navMap")[0];
      if (map) walk(map, 0);
    }
  } catch {
    // A broken contents file: the book still reads chapter by chapter.
  }
  for (const t of toc) chapters[t.page - 1].title ??= t.title;

  const coverId = all(opf, "meta").find((m) => m.getAttribute("name") === "cover")?.getAttribute("content");
  const cover = [...items.values()].find((i) => /\bcover-image\b/.test(i.props)) ?? (coverId ? items.get(coverId) : undefined);

  return {
    title: all(opf, "title")[0]?.textContent?.trim() ?? "",
    author: all(opf, "creator")[0]?.textContent?.trim() || undefined,
    chapters,
    toc,
    coverPath: cover && /^image\//.test(cover.type) && zip.has(cover.path) ? cover.path : undefined,
    zip,
  };
}

const MIME: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", gif: "image/gif", webp: "image/webp", svg: "image/svg+xml" };
const mimeOf = (path: string) => MIME[path.split(".").pop()?.toLowerCase() ?? ""];

async function dataUrl(zip: Zip, path: string) {
  const type = mimeOf(path);
  if (!type || type === "image/svg+xml" || !zip.has(path)) return null;
  const bytes = await zip.bytes(path);
  if (bytes.length > 6_000_000) return null;
  return new Promise<string>((done, fail) => {
    const r = new FileReader();
    r.onload = () => done(String(r.result));
    r.onerror = () => fail(r.error);
    r.readAsDataURL(new Blob([bytes as BlobPart], { type }));
  });
}

/**
 * One chapter (1-based) as clean HTML: the book's own styles and scripts are
 * dropped, pictures come from inside the file, and links to other chapters
 * carry `data-ch` (the chapter number) for the reader to follow.
 */
export async function chapterHtml(book: Epub, page: number): Promise<string> {
  const ch = book.chapters[page - 1];
  if (!ch) return "";
  const text = await book.zip.text(ch.path);
  let doc = new DOMParser().parseFromString(text, "application/xhtml+xml");
  if (doc.getElementsByTagName("parsererror").length || !doc.body) doc = new DOMParser().parseFromString(text, "text/html");

  // Pictures: read from the zip. (An inert parsed document loads nothing itself.)
  for (const img of [...doc.querySelectorAll("img, image")]) {
    const ref = img.getAttribute("src") ?? img.getAttribute("xlink:href") ?? img.getAttribute("href");
    const url = ref ? await dataUrl(book.zip, resolve(ch.path, ref).path).catch(() => null) : null;
    const el = doc.createElementNS("http://www.w3.org/1999/xhtml", "img");
    if (url) {
      el.setAttribute("src", url);
      el.setAttribute("alt", img.getAttribute("alt") ?? "");
      // A picture drawn inside an <svg> wrapper (a common cover page) replaces the wrapper.
      (img.closest("svg") ?? img).replaceWith(el);
    } else (img.closest("svg") ?? img).remove();
  }
  for (const a of [...doc.querySelectorAll("a[href]")]) {
    const href = a.getAttribute("href")!;
    if (/^[a-z][a-z0-9+.-]*:/i.test(href)) continue; // a web link
    const to = resolve(ch.path, href);
    const target = book.chapters.findIndex((c) => c.path === to.path) + 1;
    a.removeAttribute("href");
    if (target) {
      a.setAttribute("data-ch", String(target));
      if (to.hash) a.setAttribute("data-at", to.hash);
    }
  }

  // Into an HTML document, so it's written out as HTML (XHTML's <a id="x"/> would swallow what follows).
  const html = document.implementation.createHTMLDocument("");
  const box = html.createElement("div");
  for (const node of [...doc.body.childNodes]) box.appendChild(html.importNode(node, true));
  return DOMPurify.sanitize(box.innerHTML, {
    ALLOWED_TAGS: [...ALLOWED_TAGS, "h1", "div", "span", "section", "small", "sup", "sub", "hr", "dl", "dt", "dd", "center", "cite", "tr", "td", "th", "tbody", "thead", "table"],
    ALLOWED_ATTR: ["href", "src", "alt", "id", "data-ch", "data-at"],
    ADD_DATA_URI_TAGS: ["img"],
  });
}

/** A chapter's words only, for search and for listening. */
export async function chapterText(book: Epub, page: number) {
  const html = await chapterHtml(book, page);
  const doc = new DOMParser().parseFromString(html, "text/html");
  doc.querySelectorAll("p, div, h1, h2, h3, h4, li, br, blockquote").forEach((el) => el.append("\n"));
  return (doc.body.textContent ?? "").replace(/[^\S\n]+/g, " ").replace(/\n\s*\n+/g, "\n\n").trim();
}

// Reads the title, chapter count and a cover thumbnail for a newly added EPUB.
export async function inspectEpub(file: File) {
  const book = await openEpub(await file.arrayBuffer());
  const fromFile = file.name.replace(/\.epub$/i, "").replace(/[_-]+/g, " ").trim();
  let cover: string | undefined;
  try {
    // The cover the book names, or else the first picture in its first pages.
    let path = book.coverPath;
    for (let p = 1; !path && p <= Math.min(3, book.chapters.length); p++) {
      const first = new DOMParser()
        .parseFromString(await book.zip.text(book.chapters[p - 1].path), "text/html")
        .querySelector("img[src], image");
      const ref = first?.getAttribute("src") ?? first?.getAttribute("xlink:href") ?? first?.getAttribute("href");
      const found = ref ? resolve(book.chapters[p - 1].path, ref).path : undefined;
      if (found && mimeOf(found) && book.zip.has(found)) path = found;
    }
    if (path && mimeOf(path) !== "image/svg+xml") {
      const bitmap = await createImageBitmap(new Blob([(await book.zip.bytes(path)) as BlobPart], { type: mimeOf(path) }));
      const canvas = document.createElement("canvas");
      canvas.width = 240;
      canvas.height = Math.round((240 * bitmap.height) / bitmap.width);
      canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      bitmap.close();
      cover = canvas.toDataURL("image/jpeg", 0.8);
    }
  } catch {
    // No usable cover: the shelf shows the title card.
  }
  return { title: book.title || fromFile, author: book.author, pages: book.chapters.length, cover };
}

export const isEpub = (file: { name: string; type?: string }) => /\.epub$/i.test(file.name) || file.type === "application/epub+zip";
