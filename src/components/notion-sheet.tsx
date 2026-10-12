"use client";

import { useState } from "react";
import { Sheet } from "./sheet";
import type { Note } from "@/lib/db";
import { connectNotion, disconnectNotion, exportToNotion, getNotion, notionWorks, type NotionLink } from "@/lib/notion";
import { useT } from "@/lib/i18n";

// Send notes to Notion: connect your own integration once, then each export
// adds what's new, one Notion page per article, PDF or book.
export function NotionSheet({
  open,
  onClose,
  notes,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  notes: Note[];
  onDone: (text: string) => void;
}) {
  const t = useT();
  // The saved connection, read once the sheet opens (undefined: not read yet).
  const [link, setLink] = useState<NotionLink | null | undefined>(undefined);
  if (open && link === undefined) setLink(getNotion());
  const [secret, setSecret] = useState("");
  const [page, setPage] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const close = () => {
    if (busy) return;
    setError("");
    onClose();
  };

  const connect = async () => {
    setBusy(t("Connecting…"));
    setError("");
    try {
      setLink(await connectNotion(secret, page));
      setSecret("");
    } catch (e) {
      setError(e instanceof Error ? e.message : t("That didn’t work. Try again."));
    }
    setBusy("");
  };

  const send = async () => {
    setBusy(t("Sending to Notion…"));
    setError("");
    try {
      const r = await exportToNotion(notes, (done, total) => setBusy(t("Sending to Notion · {done} of {total}", { done, total })));
      setBusy("");
      onClose();
      onDone(
        r.notes
          ? t(r.notes === 1 ? "1 note sent to Notion" : "{n} notes sent to Notion", { n: r.notes })
          : t("Notion is up to date"),
      );
    } catch (e) {
      setBusy("");
      setError(e instanceof Error ? e.message : t("That didn’t work. Try again."));
    }
  };

  const field = "h-12 rounded-xl border border-ink/15 bg-paper px-3.5 font-mono text-[13px]";
  const primary = "flex h-12 items-center justify-center rounded-full bg-ink text-[15px] font-semibold text-on-ink disabled:opacity-50";

  return (
    <Sheet open={open} onClose={close} title="Send to Notion">
      <div className="bleed flex max-h-[70vh] flex-col gap-3 overflow-y-auto">
        {!notionWorks() ? (
          <p className="text-[14px] leading-relaxed text-muted">
            {t("Sending straight to Notion works in the Android app. Here, save a .md file and drag it into a Notion page: Notion turns it into a page.")}
          </p>
        ) : link ? (
          <>
            <p className="text-[14px] leading-relaxed">
              {t("{n} notes go to “{page}”: one page for each article, PDF or book. Notes sent before are skipped.", {
                n: notes.length,
                page: link.pageTitle,
              })}
            </p>
            <button disabled={!!busy} onClick={send} className={primary}>
              {busy || t("Send to Notion")}
            </button>
            <button
              disabled={!!busy}
              onClick={async () => {
                await disconnectNotion();
                setLink(null);
              }}
              className="label h-10 text-[10px] text-muted underline"
            >
              {t("Disconnect Notion")}
            </button>
          </>
        ) : (
          <>
            <ol className="flex list-decimal flex-col gap-1.5 pl-5 text-[14px] leading-relaxed">
              <li>
                {t("Open")}{" "}
                <a href="https://www.notion.so/my-integrations" target="_blank" rel="noopener noreferrer" className="font-semibold underline">
                  notion.so/my-integrations
                </a>
                {t(", make a new integration called Stack and copy its secret.")}
              </li>
              <li>{t("In Notion, open the page your notes should go in → ••• → Connections → add Stack.")}</li>
              <li>{t("Copy that page’s link (Share → Copy link) and paste both here.")}</li>
            </ol>
            <input
              aria-label={t("Notion secret")}
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              placeholder="ntn_…"
              autoComplete="off"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              className={field}
            />
            <input
              aria-label={t("Notion page link")}
              value={page}
              onChange={(e) => setPage(e.target.value)}
              placeholder="https://www.notion.so/…"
              autoComplete="off"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              className={field}
            />
            <button disabled={!!busy || !secret.trim() || !page.trim()} onClick={connect} className={primary}>
              {busy || t("Connect Notion")}
            </button>
            <p className="text-[12px] leading-relaxed text-muted">
              {t("The secret stays on this device. Stack only adds pages inside the page you pick.")}
            </p>
          </>
        )}
        {error && <p className="text-[13px] text-music-deep">{error}</p>}
      </div>
    </Sheet>
  );
}
