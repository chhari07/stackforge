"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { TabBar } from "@/components/tab-bar";
import { TopBar } from "@/components/top-bar";
import { PdfCover } from "@/components/pdf-cover";
import { Sheet } from "@/components/sheet";
import { useToast } from "@/components/toast";
import { ChevronLeft, ChevronRight, CloseIcon } from "@/components/icons";
import { addPdf, deletePdf, getPdfs, getSaved, toggleSaved, type PdfMeta } from "@/lib/db";
import { useStore } from "@/lib/use-store";
import { SAMPLE_HREF } from "@/lib/sample";
import { inspectPdf } from "@/lib/pdf";
import { inspectEpub, isEpub } from "@/lib/epub";
import { safeImage } from "@/lib/use-news";
import { PhoneShelf } from "@/components/phone-shelf";
import { TelegramImport } from "@/components/telegram-import";
import { getOfflineIndex } from "@/lib/offline";
import { useT } from "@/lib/i18n";

// Translucent acrylic shelves from the Books reference, one colour per shelf.
const SHELVES = [
  { bar: "rgba(242,162,70,.72)", glow: "rgba(160,90,20,.25)" },
  { bar: "rgba(78,158,230,.72)", glow: "rgba(30,80,140,.25)" },
  { bar: "rgba(10,138,58,.55)", glow: "rgba(10,90,40,.22)" },
  { bar: "rgba(214,47,38,.6)", glow: "rgba(140,30,20,.22)" },
];

function Shelf({ index, children }: { index: number; children: React.ReactNode }) {
  const t = useT();
  const scroller = useRef<HTMLDivElement>(null);
  const tone = SHELVES[index % SHELVES.length];
  const scroll = (dir: number) => scroller.current?.scrollBy({ left: dir * 224, behavior: "smooth" });
  return (
    <div className="relative mt-2.5">
      <div className="absolute -top-[42px] right-0 flex items-center text-muted">
        <button aria-label={t("Scroll left")} onClick={() => scroll(-1)} className="flex h-8 w-7 items-center justify-center">
          <ChevronLeft size={14} />
        </button>
        <button aria-label={t("Scroll right")} onClick={() => scroll(1)} className="flex h-8 w-7 items-center justify-center">
          <ChevronRight size={14} />
        </button>
      </div>
      <div
        aria-hidden
        className="absolute inset-x-0 top-[92px] h-16 rounded-lg border border-white/45"
        style={{ background: tone.bar, boxShadow: `0 6px 14px ${tone.glow}` }}
      >
        <span className="absolute top-[26px] left-3 size-3 rounded-full border border-[#A9A69E] bg-[#D8D6D0]" />
        <span className="absolute top-[26px] right-3 size-3 rounded-full border border-[#A9A69E] bg-[#D8D6D0]" />
      </div>
      <div ref={scroller} className="no-scrollbar relative flex h-[160px] gap-3.5 overflow-x-auto px-1">
        {children}
      </div>
    </div>
  );
}

export default function Library() {
  const t = useT();
  const toast = useToast();
  const [pdfs] = useStore(getPdfs, []);
  const [saved] = useStore(getSaved, []);
  const [offline] = useStore(getOfflineIndex, {});
  const [editing, setEditing] = useState(false);
  const [pending, setPending] = useState<File | null>(null);
  const [pendingUri, setPendingUri] = useState<string | undefined>();
  const [shelf, setShelf] = useState("");
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const shelves = new Map<string, PdfMeta[]>();
  for (const p of [...pdfs].sort((a, b) => b.addedAt - a.addedAt)) {
    shelves.set(p.shelf, [...(shelves.get(p.shelf) ?? []), p]);
  }
  const shelfNames = [...shelves.keys()];
  const fromPhone = new Set(pdfs.map((p) => p.sourceUri).filter((u): u is string => !!u));

  const choose = (file: File, uri?: string) => {
    setShelf(shelfNames[0] ?? "Reading");
    setPendingUri(uri);
    setPending(file);
  };

  const add = async () => {
    if (!pending) return;
    setBusy(true);
    try {
      const epub = isEpub(pending);
      const { title, pages, cover } = epub ? await inspectEpub(pending) : await inspectPdf(pending);
      await addPdf(
        pending,
        {
          title,
          pages,
          shelf: shelf.trim() || "Reading",
          sourceUri: pendingUri,
          // An EPUB with no cover picture gets the Stack cover.
          ...(epub && { format: "epub" as const, coverStyle: cover ? undefined : ("stack" as const) }),
        },
        cover,
      );
      toast({ text: t("“{title}” is on the shelf.", { title }) });
      setPending(null);
    } catch (e) {
      console.error("add pdf", e);
      toast({ text: isEpub(pending) ? t("That EPUB couldn’t be opened") : t("That file couldn’t be opened as a PDF") });
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-dvh bg-paper-2 px-5 pt-1 pb-[190px]">
      <TopBar className="bg-paper-2" />
      <div className="flex flex-col items-center">
        <span className="text-[15px] font-semibold">{t("My Library")}</span>
        <h1 className="font-serif text-[66px] leading-none font-medium tracking-[-0.01em]">{t("BOOKS")}</h1>
        <span className="label mt-1 text-[10px] text-muted">
          {t(pdfs.length === 1 ? "{n} book" : "{n} books", { n: pdfs.length })} · {t("{n} saved articles", { n: saved.length })}
        </span>
      </div>

      {pdfs.length > 0 && (
        <div className="mt-3 flex justify-end">
          <button onClick={() => setEditing((e) => !e)} className="label h-8 text-[10px] underline">
            {editing ? t("Done") : t("Edit")}
          </button>
        </div>
      )}

      {pdfs.length === 0 && (
        <div className="mt-10 flex flex-col items-center gap-2 text-center">
          <p className="font-serif text-[22px] italic">{t("Every shelf starts with one book.")}</p>
          <p className="max-w-[280px] text-[14px] text-muted">
            {t("Add a PDF or an EPUB — a book, a paper, lecture notes. Select a line to highlight it, and Stack brings it back tomorrow. It all stays on this device.")}
          </p>
          <Link
            href={SAMPLE_HREF}
            className="mx-auto mt-3 flex h-12 items-center rounded-full bg-ink px-6 text-[15px] font-semibold text-on-ink"
          >
            {t("Try it on a sample article")}
          </Link>
        </div>
      )}

      {shelfNames.map((name, i) => {
        const items = shelves.get(name)!;
        return (
          <section key={name} className="mt-5">
            <div className="flex items-center justify-between pr-[64px]">
              <h2 className="text-[16px] font-semibold">{name}</h2>
              <span className="text-[13px] text-muted">
                {t(items.length === 1 ? "{n} book" : "{n} books", { n: items.length })}
              </span>
            </div>
            <Shelf index={i}>
              {items.map((p) => (
                <div key={p.id} className="relative shrink-0">
                  <Link href={`/library/read?id=${p.id}`} aria-label={t("Read {title}", { title: p.title })}>
                    <PdfCover id={p.id} title={p.title} plain={p.coverStyle === "stack"} marked={!!p.bookmarks?.length} progress={p.lastPage > 1 ? p.lastPage / p.pages : 0} className="h-[142px] w-[98px]" />
                  </Link>
                  {editing && (
                    <button
                      aria-label={t("Delete {title}", { title: p.title })}
                      onClick={() => {
                        if (confirm(t("Delete “{title}” and its notes from this device?", { title: p.title }))) deletePdf(p.id);
                      }}
                      className="absolute -top-2 -right-2 flex size-8 items-center justify-center rounded-full bg-ink text-on-ink"
                    >
                      <CloseIcon size={14} />
                    </button>
                  )}
                </div>
              ))}
            </Shelf>
          </section>
        );
      })}

      <TelegramImport />
      <PhoneShelf added={fromPhone} onPick={choose} />

      <section className="mt-5">
        <div className="flex items-center justify-between">
          <h2 className="text-[16px] font-semibold">{t("Saved articles")}</h2>
          <span className="text-[13px] text-muted">{t("{n} saved", { n: saved.length })}</span>
        </div>
        {saved.length === 0 ? (
          <p className="mt-2 text-[13px] text-muted">{t("Bookmark a story. It waits here for you.")}</p>
        ) : (
          <div className="rail -mx-5 mt-2.5 gap-3.5 px-5">
            {saved.map((a) => {
              const img = safeImage(a.image);
              return (
                <div key={a.id} className="relative shrink-0">
                  <Link
                    href={`/read?id=${a.id}`}
                    className="relative flex h-[142px] w-[98px] flex-col justify-end overflow-hidden bg-soft p-2 text-white shadow-[0_4px_10px_rgba(0,0,0,.18)]"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {img && <img src={img} alt="" className="absolute inset-0 size-full object-cover opacity-40" />}
                    <span className="relative line-clamp-4 text-[11px] leading-tight font-semibold">{a.title}</span>
                    <span className="label relative mt-1 text-[7px] text-[#BDBAB2]">
                      {a.source}
                      {offline[a.id]?.keep ? ` · ${t("offline")}` : ""}
                    </span>
                  </Link>
                  {editing && (
                    <button
                      aria-label={t("Remove {name}", { name: a.title })}
                      onClick={() => toggleSaved(a)}
                      className="absolute -top-2 -right-2 flex size-8 items-center justify-center rounded-full bg-ink text-on-ink"
                    >
                      <CloseIcon size={14} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      <input
        ref={input}
        type="file"
        accept="application/pdf,.pdf,application/epub+zip,.epub"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) choose(f);
        }}
      />

      <Sheet open={pending !== null} onClose={() => !busy && setPending(null)} title="Add to a shelf">
        <p className="truncate text-[14px] text-muted">{pending?.name}</p>
        <label className="flex flex-col gap-2">
          <span className="label text-[10px] text-muted">{t("Shelf")}</span>
          <input
            list="shelf-names"
            value={shelf}
            onChange={(e) => setShelf(e.target.value)}
            placeholder={t("e.g. Design, Research papers")}
            className="h-12 rounded-xl border border-ink/15 bg-card px-3.5 text-[15px] outline-none focus:border-ink"
          />
          <datalist id="shelf-names">
            {shelfNames.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </label>
        <button
          onClick={add}
          disabled={busy}
          className="h-12 rounded-full bg-ink text-[15px] font-semibold text-on-ink disabled:opacity-50"
        >
          {busy ? t("Opening…") : t("Add to Library")}
        </button>
      </Sheet>

      <TabBar add={{ label: "Add PDF or EPUB", onClick: () => input.current?.click() }} />
    </main>
  );
}
