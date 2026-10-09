"use client";

import { useCallback, useEffect, useState } from "react";
import { Sheet } from "./sheet";
import { Logo } from "./logo";
import { useToast } from "./toast";
import { CheckIcon, ExternalIcon } from "./icons";
import { RefreshIcon } from "./stack-icons";
import { ConnectionDot, type DotState } from "./connection-dot";
import { addPdf } from "@/lib/db";
import { inspectPdf } from "@/lib/pdf";
import { fileSize } from "@/lib/phone-files";
import { newsTime } from "@/lib/format";
import {
  checkForPdfs,
  connect,
  disconnect,
  downloadPdf,
  getBot,
  getPdfList,
  getStatus,
  markImported,
  onStatusChange,
  MAX_BYTES,
  TelegramError,
  type TelegramBot,
  type TelegramPdf,
  type TelegramStatus,
} from "@/lib/telegram";
import { useT } from "@/lib/i18n";

const TG_BLUE = "#2AABEE";

// Telegram's paper plane, for the connect button and the link animation.
export function PlaneIcon({ size = 20, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden className={className} fill="currentColor">
      <path d="M21.4 4.1 2.9 11.3c-1.3.5-1.2 1.3-.2 1.6l4.7 1.5 1.8 5.5c.2.6.4.8.8.8s.6-.2.9-.5l2.4-2.3 4.8 3.6c.9.5 1.5.2 1.7-.8l3.1-14.8c.3-1.3-.5-1.9-1.5-1.8zM9.6 14.9l-.4 3.6-1.5-4.6 10.4-6.6c.5-.3.9-.1.5.3z" />
    </svg>
  );
}

type Link = "idle" | "connecting" | "connected" | "error";

// Stack ⟷ Telegram, with the connection drawn between them.
function ConnectionArt({ state, botName }: { state: Link; botName?: string }) {
  const t = useT();
  const line =
    state === "connected" ? "var(--color-news)" : state === "error" ? "var(--color-music)" : "currentColor";
  return (
    <div className={`flex flex-col items-center gap-3 ${state === "error" ? "tg-shake" : ""}`} key={state}>
      <div className="flex w-full max-w-[320px] items-center">
        <span
          className={`flex size-16 shrink-0 items-center justify-center rounded-2xl bg-ink text-on-ink ${state === "connecting" ? "animate-pulse" : ""}`}
        >
          <Logo size={34} loop={state === "connecting"} />
        </span>
        <div className="relative mx-2 h-10 grow text-muted">
          <svg className="absolute inset-0 size-full overflow-visible" aria-hidden>
            <line
              x1="0"
              y1="50%"
              x2="100%"
              y2="50%"
              stroke={line}
              strokeWidth={state === "connected" ? 3 : 2}
              strokeLinecap="round"
              strokeDasharray={state === "connected" ? undefined : "6 6"}
              className={state === "connecting" ? "tg-flow" : ""}
              opacity={state === "idle" ? 0.45 : 1}
            />
          </svg>
          {state === "connecting" && (
            <span className="tg-fly absolute top-1/2" style={{ color: TG_BLUE }}>
              <PlaneIcon size={20} />
            </span>
          )}
          {state === "connected" && (
            <span className="tg-pop absolute top-1/2 left-1/2 flex size-8 items-center justify-center rounded-full bg-news text-white">
              <CheckIcon size={18} />
            </span>
          )}
          {state === "error" && (
            <span className="absolute top-1/2 left-1/2 flex size-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-music text-[18px] font-bold text-white">
              !
            </span>
          )}
        </div>
        <span
          className={`flex size-16 shrink-0 items-center justify-center rounded-full text-white ${state === "connecting" ? "tg-pulse" : ""}`}
          style={{ background: TG_BLUE }}
        >
          <PlaneIcon size={30} className="-ml-1" />
        </span>
      </div>
      <p role="status" aria-live="polite" className="label text-center text-[10px] text-muted">
        {state === "idle" && t("Not connected")}
        {state === "connecting" && t("Connecting to Telegram…")}
        {state === "connected" && t("Connected to {bot}", { bot: botName ?? t("your bot") })}
        {state === "error" && t("Couldn’t connect")}
      </p>
    </div>
  );
}

type Progress = Record<string, { stage: "waiting" | "downloading" | "adding" | "done" | "failed"; p?: number; error?: string }>;

// Library → "Import from Telegram": connect a bot, then pick PDFs to import.
export function TelegramImport() {
  const t = useT();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [bot, setBot] = useState<TelegramBot | null>(null);
  const [link, setLink] = useState<Link>("idle");
  const [token, setToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pdfs, setPdfs] = useState<TelegramPdf[] | null>(null);
  const [checking, setChecking] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [shelf, setShelf] = useState("Telegram");
  const [progress, setProgress] = useState<Progress>({});
  const [importing, setImporting] = useState(false);
  const [status, setStatus] = useState<TelegramStatus | null>(null);

  useEffect(() => {
    const b = getBot();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setBot(b);
    if (b) setLink(getStatus()?.state === "rejected" ? "error" : "connected");
    setStatus(getStatus());
    // The app-open check runs elsewhere; keep the dot in step with it.
    return onStatusChange(() => {
      const s = getStatus();
      setStatus(s);
      if (getBot()) setLink(s?.state === "rejected" ? "error" : "connected");
    });
  }, []);

  const rejected = status?.state === "rejected";
  const dot: DotState = rejected ? "lost" : status?.state === "unreachable" ? "unreachable" : "ok";

  const check = useCallback(async (b: TelegramBot) => {
    setChecking(true);
    try {
      setPdfs(await checkForPdfs(b));
      setError(null);
    } catch (e) {
      setPdfs(await getPdfList());
      setError((e as Error).message);
    } finally {
      setChecking(false);
    }
  }, []);

  // Look for new PDFs whenever the sheet opens.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (open && bot) check(bot);
  }, [open, bot, check]);

  const doConnect = async () => {
    setError(null);
    setLink("connecting");
    // Let the animation play a moment even on a fast network.
    const [result] = await Promise.allSettled([connect(token), new Promise((r) => setTimeout(r, 1600))]);
    if (result.status === "fulfilled") {
      setLink("connected");
      setToken("");
      setTimeout(() => setBot(result.value), 900);
    } else {
      setLink("error");
      setError((result.reason as TelegramError).message);
    }
  };

  const importable = (pdfs ?? []).filter((d) => !d.imported && d.size <= MAX_BYTES);
  const allPicked = importable.length > 0 && importable.every((d) => picked.has(d.id));

  const runImport = async () => {
    if (!bot || !pdfs) return;
    const chosen = pdfs.filter((d) => picked.has(d.id));
    setImporting(true);
    setProgress(Object.fromEntries(chosen.map((d) => [d.id, { stage: "waiting" as const }])));
    const done: string[] = [];
    for (const d of chosen) {
      const set = (v: Progress[string]) => setProgress((p) => ({ ...p, [d.id]: v }));
      try {
        set({ stage: "downloading", p: 0 });
        const file = await downloadPdf(bot, d, (p) => set({ stage: "downloading", p }));
        set({ stage: "adding" });
        const { title, pages, cover } = await inspectPdf(file);
        await addPdf(file, { title, pages, shelf: shelf.trim() || "Telegram", sourceUri: `telegram:${d.id}` }, cover);
        done.push(d.id);
        set({ stage: "done" });
      } catch (e) {
        set({ stage: "failed", error: e instanceof TelegramError ? e.message : t("This file couldn’t be opened as a PDF") });
      }
    }
    await markImported(done);
    setPdfs(await getPdfList());
    setPicked(new Set());
    setImporting(false);
    if (done.length) {
      toast({ text: t(done.length === 1 ? "Imported {n} PDF to “{shelf}”" : "Imported {n} PDFs to “{shelf}”", { n: done.length, shelf: shelf.trim() || "Telegram" }) });
    }
  };

  const botHandle = bot ? `@${bot.username}` : "";

  const tokenForm = (
    <>
      <input
        aria-label={t("Bot token")}
        value={token}
        onChange={(e) => setToken(e.target.value)}
        placeholder="123456789:AAH…"
        autoComplete="off"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        className="h-12 rounded-xl border border-ink/15 bg-paper px-3.5 font-mono text-[13px]"
      />
      {error && <p className="text-[13px] text-music-deep">{error}</p>}
      <button
        onClick={doConnect}
        disabled={link === "connecting" || !token.trim()}
        className="flex h-12 items-center justify-center gap-2 rounded-full text-[15px] font-semibold text-white disabled:opacity-50"
        style={{ background: TG_BLUE }}
      >
        <PlaneIcon size={18} /> {link === "connecting" ? t("Connecting…") : bot ? t("Reconnect") : t("Connect")}
      </button>
    </>
  );

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="mt-5 flex w-full items-center gap-3.5 rounded-2xl bg-card px-4 py-3.5 text-left"
      >
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full text-white" style={{ background: TG_BLUE }}>
          <PlaneIcon size={22} className="-ml-0.5" />
        </span>
        <span className="flex min-w-0 grow flex-col gap-0.5">
          <span className="text-[15px] font-semibold">{t("Import from Telegram")}</span>
          <span className="label flex items-center gap-1.5 truncate text-[10px] text-muted">
            {bot && <ConnectionDot state={dot} />}
            <span className="truncate">
              {!bot
                ? t("Connect a bot, forward PDFs, pick what to add")
                : rejected
                  ? t("{bot} · token stopped working · Reconnect", { bot: botHandle })
                  : dot === "unreachable"
                    ? t("Connected · {bot} · can’t reach Telegram", { bot: botHandle })
                    : t("Connected · {bot}", { bot: botHandle })}
            </span>
          </span>
        </span>
      </button>

      <Sheet open={open} onClose={() => !importing && setOpen(false)} title="Import from Telegram">
        <div className="-mx-5 max-h-[70vh] overflow-y-auto px-5">
          <ConnectionArt state={link} botName={botHandle} />

          {!bot && (
            <div className="mt-5 flex flex-col gap-3">
              <ol className="flex list-decimal flex-col gap-1.5 pl-5 text-[14px] leading-relaxed">
                <li>
                  {t("In Telegram, open")}{" "}
                  <a href="https://t.me/BotFather" target="_blank" rel="noopener noreferrer" className="font-semibold underline">
                    @BotFather
                  </a>{" "}
                  {t("and send /newbot. Give it any name.")}
                </li>
                <li>{t("Copy the token it gives you and paste it here.")}</li>
                <li>{t("Forward PDFs to your new bot, then pick them in Stack.")}</li>
              </ol>
              {tokenForm}
              <p className="text-[12px] leading-relaxed text-muted">
                {t("The token stays on this device. Stack only reads what you send to your bot.")}
              </p>
            </div>
          )}

          {bot && rejected && (
            <div className="mt-5 flex flex-col gap-3 rounded-2xl bg-music-tint p-4">
              <p className="text-[14px] leading-relaxed text-music-deep">
                {t("Telegram stopped accepting {bot}’s token (it was probably revoked in @BotFather). Send /token to @BotFather, pick {bot}, and paste the new token. Your PDF list is kept.", { bot: botHandle })}
              </p>
              {tokenForm}
            </div>
          )}

          {bot && (
            <div className="mt-5 flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <a
                  href={`https://t.me/${bot.username}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-11 grow items-center justify-center gap-2 rounded-full text-[14px] font-semibold text-white"
                  style={{ background: TG_BLUE }}
                >
                  {t("Open {site}", { site: botHandle })} <ExternalIcon size={14} />
                </a>
                <button
                  aria-label={t("Check for new PDFs")}
                  onClick={() => check(bot)}
                  disabled={checking || importing}
                  className="flex size-11 items-center justify-center rounded-full border border-ink/15"
                >
                  <RefreshIcon size={18} className={checking ? "animate-spin" : ""} />
                </button>
              </div>
              <p className="text-[13px] leading-relaxed text-muted">
                {t("Forward PDFs to {bot} from any chat or channel, then come back here.", { bot: botHandle })}
              </p>
              {error && !rejected && (
                <p className="flex items-center gap-2 text-[13px] text-pdf-deep">
                  <ConnectionDot state="unreachable" /> {error}
                </p>
              )}

              {pdfs === null && <p className="label text-[10px] text-muted">{t("Checking Telegram…")}</p>}
              {pdfs?.length === 0 && (
                <p className="rounded-xl bg-paper px-4 py-5 text-center text-[14px] text-muted">
                  {t("No PDFs yet. Forward one to {bot} and tap ↻.", { bot: botHandle })}
                </p>
              )}

              {pdfs && pdfs.length > 0 && (
                <>
                  <div className="flex items-center justify-between">
                    <span className="label text-[10px] text-muted">
                      {t(pdfs.length === 1 ? "{n} PDF · {s} selected" : "{n} PDFs · {s} selected", { n: pdfs.length, s: picked.size })}
                    </span>
                    {importable.length > 0 && (
                      <button
                        onClick={() => setPicked(allPicked ? new Set() : new Set(importable.map((d) => d.id)))}
                        disabled={importing}
                        className="label h-8 text-[10px] underline"
                      >
                        {allPicked ? t("Select none") : t("Select all")}
                      </button>
                    )}
                  </div>
                  <ul className="flex flex-col">
                    {pdfs.map((d) => {
                      const big = d.size > MAX_BYTES;
                      const disabled = d.imported || big || importing;
                      const pr = progress[d.id];
                      return (
                        <li key={d.id} className="border-b border-line">
                          <label className={`flex min-h-14 items-center gap-3 py-2 ${disabled && !pr ? "opacity-55" : ""}`}>
                            <input
                              type="checkbox"
                              checked={picked.has(d.id) || !!d.imported}
                              disabled={disabled}
                              onChange={(e) => {
                                const next = new Set(picked);
                                if (e.target.checked) next.add(d.id);
                                else next.delete(d.id);
                                setPicked(next);
                              }}
                              className="size-5 shrink-0 accent-[#2AABEE]"
                            />
                            <span className="flex min-w-0 grow flex-col gap-0.5">
                              <span className="truncate text-[14px] font-semibold">{d.name.replace(/\.pdf$/i, "")}</span>
                              <span className="label truncate text-[9px] text-muted">
                                {d.imported ? `${t("In your Library")} · ` : big ? `${t("Over 20 MB")} · ` : ""}
                                {d.size ? `${fileSize(d.size)} · ` : ""}
                                {d.from} · {newsTime(d.date)}
                              </span>
                              {pr && pr.stage !== "done" && (
                                <span className="mt-1 flex items-center gap-2">
                                  <span className="h-1 grow overflow-hidden rounded-full bg-rule">
                                    <span
                                      className={`block h-1 rounded-full transition-[width] ${pr.stage === "failed" ? "bg-music" : ""}`}
                                      style={{
                                        width: `${pr.stage === "waiting" ? 0 : pr.stage === "adding" ? 100 : pr.stage === "failed" ? 100 : Math.round((pr.p ?? 0) * 100)}%`,
                                        background: pr.stage === "failed" ? undefined : TG_BLUE,
                                      }}
                                    />
                                  </span>
                                  <span className="label shrink-0 text-[9px] text-muted">
                                    {pr.stage === "waiting" && t("Waiting")}
                                    {pr.stage === "downloading" && `${Math.round((pr.p ?? 0) * 100)}%`}
                                    {pr.stage === "adding" && t("Adding…")}
                                    {pr.stage === "failed" && t("Failed")}
                                  </span>
                                </span>
                              )}
                              {pr?.stage === "failed" && <span className="text-[12px] text-music-deep">{pr.error}</span>}
                            </span>
                            {pr?.stage === "done" && (
                              <span className="tg-pop-in flex size-7 shrink-0 items-center justify-center rounded-full bg-news text-white">
                                <CheckIcon size={15} />
                              </span>
                            )}
                          </label>
                        </li>
                      );
                    })}
                  </ul>

                  {picked.size > 0 && (
                    <div className="flex flex-col gap-2">
                      <label className="flex items-center justify-between gap-3">
                        <span className="text-[14px]">{t("Shelf")}</span>
                        <input
                          value={shelf}
                          onChange={(e) => setShelf(e.target.value)}
                          className="h-11 w-[55%] rounded-xl border border-ink/15 bg-paper px-3 text-[14px]"
                        />
                      </label>
                      <button
                        onClick={runImport}
                        disabled={importing}
                        className="flex h-12 items-center justify-center rounded-full bg-ink text-[15px] font-semibold text-on-ink disabled:opacity-60"
                      >
                        {importing ? t("Importing…") : t(picked.size === 1 ? "Import {n} PDF" : "Import {n} PDFs", { n: picked.size })}
                      </button>
                    </div>
                  )}
                </>
              )}

              <button
                onClick={async () => {
                  await disconnect();
                  setBot(null);
                  setPdfs(null);
                  setPicked(new Set());
                  setLink("idle");
                  toast({ text: t("Disconnected from Telegram") });
                }}
                disabled={importing}
                className="mt-2 text-[13px] text-muted underline"
              >
                {t("Disconnect {bot}", { bot: botHandle })}
              </button>
            </div>
          )}
        </div>
      </Sheet>
    </>
  );
}
