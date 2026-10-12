"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { Sheet } from "./sheet";
import { UploadIcon } from "./stack-icons";
import {
  fetchReadwise,
  forgetReadwise,
  getReadwiseToken,
  importHighlights,
  parseKindle,
  parseReadwiseCsv,
  readwiseApiWorks,
  type ImportItem,
  type ImportResult,
  type ImportSource,
} from "@/lib/import";
import { useT } from "@/lib/i18n";

type Step = { busy: string } | { done: ImportResult; from: ImportSource } | { error: string } | null;

// Import highlights from Kindle (My Clippings.txt) and Readwise (CSV or API).
export function ImportSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT();
  const kindle = useRef<HTMLInputElement>(null);
  const csv = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>(null);
  const [token, setToken] = useState("");
  // The saved Readwise token, read once the sheet opens (undefined: not read yet).
  const [saved, setSaved] = useState<string | null | undefined>(undefined);
  if (open && saved === undefined) setSaved(getReadwiseToken());
  const busy = !!step && "busy" in step;

  const run = async (from: ImportSource, load: () => Promise<ImportItem[]>) => {
    setStep({ busy: t("Reading…") });
    try {
      const items = await load();
      if (!items.length) {
        setStep({ error: from === "kindle" ? t("No highlights in that file. On your Kindle it’s documents/My Clippings.txt.") : t("No highlights found.") });
        return;
      }
      setStep({ busy: t("Adding {n} highlights…", { n: items.length }) });
      setStep({ done: await importHighlights(items, from), from });
    } catch (e) {
      setStep({ error: e instanceof Error ? e.message : t("That didn’t work. Try again.") });
    }
  };

  const fromFile = (from: ImportSource, file?: File) =>
    file && run(from, async () => (from === "kindle" ? parseKindle(await file.text()) : parseReadwiseCsv(await file.text())));

  const fromApi = (key: string) =>
    run("readwise", async () => {
      const items = await fetchReadwise(key, (books) => setStep({ busy: t("Downloading from Readwise · {n} books…", { n: books }) }));
      setSaved(getReadwiseToken());
      setToken("");
      return items;
    });

  const close = () => {
    if (busy) return;
    onClose();
    setStep(null);
  };

  const row = "flex items-center gap-3 rounded-2xl bg-card px-4 py-3.5 text-left disabled:opacity-50";
  const mark = "flex size-11 shrink-0 items-center justify-center rounded-full text-[15px] font-bold";

  return (
    <Sheet open={open} onClose={close} title="Import highlights">
      {step && "done" in step ? (
        <div className="flex flex-col gap-3">
          <p className="font-serif text-[24px] leading-tight italic">
            {step.done.added
              ? t(step.done.added === 1 ? "1 highlight added." : "{n} highlights added.", { n: step.done.added })
              : t("Nothing new to add.")}
          </p>
          <p className="text-[14px] leading-relaxed text-muted">
            {step.done.added > 0 &&
              t(step.done.books === 1 ? "From 1 book. " : "From {n} books. ", { n: step.done.books })}
            {step.done.skipped > 0 &&
              t(step.done.skipped === 1 ? "1 was already in Stack. " : "{n} were already in Stack. ", { n: step.done.skipped })}
            {step.done.added > 0 && t("They join your daily review: a few come back each morning.")}
          </p>
          <div className="flex gap-2.5">
            <button onClick={close} className="h-12 grow rounded-full border border-ink/20 text-[15px] font-semibold">
              {t("Done")}
            </button>
            {step.done.added > 0 && (
              <Link
                href="/review"
                onClick={close}
                className="flex h-12 grow items-center justify-center rounded-full bg-ink text-[15px] font-semibold text-on-ink"
              >
                {t("Start recall")}
              </Link>
            )}
          </div>
        </div>
      ) : (
        <div className="bleed flex max-h-[70vh] flex-col gap-3 overflow-y-auto">
          <p className="text-[14px] leading-relaxed text-muted">
            {t("Bring the lines you already saved. They join your notes and come back in the daily review.")}
          </p>

          <button disabled={busy} onClick={() => kindle.current?.click()} className={row}>
            <span className={`${mark} bg-ink text-on-ink`}>K</span>
            <span className="flex min-w-0 grow flex-col gap-0.5">
              <span className="text-[15px] font-semibold">{t("Kindle")}</span>
              <span className="text-[12px] leading-snug text-muted">
                {t("Plug in your Kindle and pick documents/My Clippings.txt")}
              </span>
            </span>
            <UploadIcon size={18} />
          </button>

          <button disabled={busy} onClick={() => csv.current?.click()} className={row}>
            <span className={`${mark} bg-pdf-tint text-ink`}>R</span>
            <span className="flex min-w-0 grow flex-col gap-0.5">
              <span className="text-[15px] font-semibold">{t("Readwise CSV")}</span>
              <span className="text-[12px] leading-snug text-muted">
                {t("In Readwise: Export → CSV, then pick the file")}
              </span>
            </span>
            <UploadIcon size={18} />
          </button>

          <div className="flex flex-col gap-2.5 rounded-2xl bg-card p-4">
            <span className="text-[15px] font-semibold">{t("Readwise account")}</span>
            {!readwiseApiWorks() ? (
              <p className="text-[12px] leading-snug text-muted">
                {t("Importing straight from your Readwise account works in the Android app. Here, use the CSV.")}
              </p>
            ) : saved ? (
              <div className="flex gap-2">
                <button
                  disabled={busy}
                  onClick={() => fromApi(saved)}
                  className="h-11 grow rounded-full bg-ink text-[14px] font-semibold text-on-ink disabled:opacity-50"
                >
                  {t("Get new highlights")}
                </button>
                <button
                  disabled={busy}
                  onClick={() => {
                    forgetReadwise();
                    setSaved(null);
                  }}
                  className="h-11 rounded-full border border-ink/15 px-4 text-[13px] font-semibold disabled:opacity-50"
                >
                  {t("Disconnect")}
                </button>
              </div>
            ) : (
              <>
                <p className="text-[12px] leading-snug text-muted">
                  {t("Copy your access token from")}{" "}
                  <a href="https://readwise.io/access_token" target="_blank" rel="noopener noreferrer" className="font-semibold underline">
                    readwise.io/access_token
                  </a>{" "}
                  {t("and paste it here. It stays on this device.")}
                </p>
                <input
                  aria-label={t("Readwise access token")}
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder={t("Access token")}
                  autoComplete="off"
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck={false}
                  className="h-12 rounded-xl border border-ink/15 bg-paper px-3.5 font-mono text-[13px]"
                />
                <button
                  disabled={busy || token.trim().length < 20}
                  onClick={() => fromApi(token)}
                  className="h-11 rounded-full bg-ink text-[14px] font-semibold text-on-ink disabled:opacity-50"
                >
                  {t("Connect and import")}
                </button>
              </>
            )}
          </div>

          {step && "busy" in step && <p className="text-center text-[14px] text-muted">{step.busy}</p>}
          {step && "error" in step && <p className="text-[13px] text-music-deep">{step.error}</p>}

          <input
            ref={kindle}
            type="file"
            accept="text/plain,.txt"
            hidden
            onChange={(e) => {
              fromFile("kindle", e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          <input
            ref={csv}
            type="file"
            accept="text/csv,text/comma-separated-values,.csv"
            hidden
            onChange={(e) => {
              fromFile("readwise", e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </div>
      )}
    </Sheet>
  );
}
