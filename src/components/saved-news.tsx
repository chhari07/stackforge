"use client";

import Link from "next/link";
import { useState } from "react";
import { getNotes, toggleSaved, updateSaved, type SavedArticle } from "@/lib/db";
import { useStore } from "@/lib/use-store";
import { safeImage } from "@/lib/use-news";
import { ago } from "@/lib/format";
import { forgetArticle } from "@/lib/offline";
import { ALL, folderKey, folderName, folders, ownFolders } from "@/lib/saved-news";
import { useT } from "@/lib/i18n";
import { Sheet } from "./sheet";
import { BookmarkIcon, CheckIcon } from "./icons";

const SHOWN = 5;

// Library → Saved news: folder chips (All, "India news", "AI news", your own
// folders) and a card per story: topic, headline, summary, source, reading
// time, offline and highlights. The card opens the full story in the reader.
export function SavedNews({ saved, offline }: { saved: SavedArticle[]; offline: Record<string, { keep: boolean }> }) {
  const t = useT();
  const [notes] = useStore(getNotes, []);
  const [open, setOpen] = useState(ALL);
  const [all, setAll] = useState(false);
  const [moving, setMoving] = useState<SavedArticle | null>(null);
  const [newFolder, setNewFolder] = useState("");

  const groups = folders(saved);
  const current = groups.some(([k]) => k === open) ? open : ALL;
  const list = current === ALL ? saved : (groups.find(([k]) => k === current)?.[1] ?? []);
  const shown = all ? list : list.slice(0, SHOWN);
  const unread = saved.filter((a) => !a.readAt).length;
  const highlights = (id: string) => notes.filter((n) => n.articleId === id).length;

  const move = async (folder: string | undefined) => {
    if (!moving) return;
    await updateSaved(moving.id, { folder });
    setMoving(null);
    setNewFolder("");
  };

  return (
    <section className="mt-5">
      <div className="flex items-center justify-between">
        <h2 className="text-[16px] font-semibold">{t("Saved news")}</h2>
        <span className="text-[13px] text-muted">
          {t("{n} saved", { n: saved.length })}
          {unread > 0 && ` · ${t("{n} unread", { n: unread })}`}
        </span>
      </div>

      {saved.length === 0 ? (
        <p className="mt-2 text-[13px] text-muted">{t("Bookmark a story. It waits here for you.")}</p>
      ) : (
        <>
          <div role="tablist" aria-label={t("Folders")} className="rail bleed mt-2.5 gap-2">
            {[[ALL, saved] as const, ...groups].map(([key, items]) => (
              <button
                key={key}
                role="tab"
                aria-selected={current === key}
                onClick={() => {
                  setOpen(key);
                  setAll(false);
                }}
                className={`flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-semibold ${
                  current === key ? "bg-ink text-on-ink" : "border border-ink/15"
                }`}
              >
                {folderName(key, t)}
                <span className={current === key ? "text-on-ink/60" : "text-muted"}>{items.length}</span>
              </button>
            ))}
          </div>

          <div className="mt-3 flex flex-col gap-2.5">
            {shown.map((a) => {
              const img = safeImage(a.image);
              const kept = offline[a.id]?.keep;
              const n = highlights(a.id);
              return (
                <article key={a.id} className="rounded-2xl bg-card px-3.5 pt-3.5 pb-1.5 shadow-[0_2px_8px_rgba(0,0,0,.05)]">
                  <Link href={`/read?id=${a.id}`} className="flex gap-3">
                    <div className="flex min-w-0 grow flex-col">
                      <span className="label text-[9px] text-news">
                        {folderName(folderKey(a), t)} · {t("Saved {time}", { time: ago(a.savedAt) })}
                      </span>
                      <h3 className={`mt-1 line-clamp-2 text-[15px] leading-snug ${a.readAt ? "font-medium" : "font-bold"}`}>
                        {!a.readAt && <span aria-label={t("Unread")} className="mr-1.5 inline-block size-2 -translate-y-0.5 rounded-full bg-news" />}
                        {a.title}
                      </h3>
                      {a.summary && <p className="mt-1 line-clamp-2 text-[13px] leading-snug text-muted">{a.summary}</p>}
                    </div>
                    {img && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={img} alt="" loading="lazy" className="size-[72px] shrink-0 rounded-xl object-cover" />
                    )}
                  </Link>
                  <div className="mt-1 flex items-center justify-between gap-2">
                    <span className="label min-w-0 truncate text-[9px] text-muted">
                      {[
                        a.source,
                        a.readMinutes ? t("{n} min read", { n: a.readMinutes }) : "",
                        kept ? t("Offline") : "",
                        n ? t(n === 1 ? "1 highlight" : "{n} highlights", { n }) : "",
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                    <button
                      onClick={() => setMoving(a)}
                      aria-label={t("Move or remove {name}", { name: a.title })}
                      className="label -mr-2 flex h-8 shrink-0 items-center px-2 text-[9px] text-muted underline"
                    >
                      {t("Move")}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
          {list.length > SHOWN && (
            <button onClick={() => setAll((v) => !v)} className="label mt-2 h-9 w-full text-[10px] underline">
              {all ? t("Show less") : t("Show all {n}", { n: list.length })}
            </button>
          )}
        </>
      )}

      <Sheet open={moving !== null} onClose={() => setMoving(null)} title="Move to a folder">
        <p className="line-clamp-2 text-[14px] text-muted">{moving?.title}</p>
        <div className="flex flex-col gap-1.5">
          {moving?.topic && (
            <FolderRow label={folderName(`topic:${moving.topic}`, t)} on={!moving.folder} onClick={() => move(undefined)} />
          )}
          {ownFolders(saved).map((f) => (
            <FolderRow key={f} label={f} on={moving?.folder === f} onClick={() => move(f)} />
          ))}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const name = newFolder.trim();
            if (name) move(name.slice(0, 40));
          }}
          className="flex gap-2"
        >
          <input
            value={newFolder}
            onChange={(e) => setNewFolder(e.target.value)}
            placeholder={t("New folder, e.g. GATE current affairs")}
            aria-label={t("New folder")}
            className="h-11 min-w-0 grow rounded-xl border border-ink/15 bg-transparent px-3 text-[14px]"
          />
          <button type="submit" disabled={!newFolder.trim()} className="h-11 rounded-full bg-ink px-4 text-[14px] font-semibold text-on-ink disabled:opacity-40">
            {t("Add")}
          </button>
        </form>
        <button
          onClick={async () => {
            // The card and its offline copy both go.
            if (moving) await Promise.all([toggleSaved(moving), forgetArticle(moving.id)]);
            setMoving(null);
          }}
          className="flex h-11 items-center justify-center gap-2 rounded-full border border-ink/15 text-[14px] font-semibold"
        >
          <BookmarkIcon size={16} />
          {t("Remove from saved")}
        </button>
      </Sheet>
    </section>
  );
}

function FolderRow({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex h-11 items-center justify-between rounded-xl border border-ink/15 px-3 text-[14px] font-semibold">
      {label}
      {on && <CheckIcon size={16} />}
    </button>
  );
}
