"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { AI_ENGINE, AiError, aiAvailable, aiConsented, setAiConsent, type Answer, type Cite } from "@/lib/ai";
import { Sheet } from "./sheet";
import { LockIcon, SparkleIcon } from "./stack-icons";
import { useAccount } from "./account-provider";
import { SignInPanel } from "./sign-in";
import { useT } from "@/lib/i18n";
import { Rich } from "./rich";

// Stack AI is for signed-in people (it runs on Stack's server, with a daily
// limit per account). The one check every AI button uses:
// - "on": set up, turned on in Settings, and signed in;
// - "locked": set up and turned on, but signed out: the big entry points
//   (Summarize, Ask this PDF) show a lock that opens the sign-in sheet; the
//   rest (Explain, Ask your Stack, Tidy) stay hidden;
// - "off": not set up in this build, or turned off in Settings: no AI anywhere.
export type AiState = "on" | "locked" | "off";
export function useAiState(): AiState {
  const { user, ready } = useAccount();
  // Settings live in localStorage: read after mount, so server and client HTML match.
  const [usable, setUsable] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setUsable(aiAvailable()), []);
  if (!usable || !ready) return "off";
  return user ? "on" : "locked";
}

/**
 * `requireSignIn(action)`: runs `action` when signed in; otherwise opens the
 * "Stack AI needs an account" sheet, and runs `action` right after the person
 * signs in there, so they don't have to find the button again.
 */
export function useAiSignIn() {
  const t = useT();
  const { user } = useAccount();
  const [open, setOpen] = useState(false);
  const pending = useRef<(() => void) | null>(null);
  const requireSignIn = useCallback(
    (action: () => void) => {
      if (user) return action();
      pending.current = action;
      setOpen(true);
    },
    [user],
  );
  useEffect(() => {
    if (!user || !pending.current) return;
    const action = pending.current;
    pending.current = null;
    setOpen(false);
    action();
  }, [user]);
  const sheet = (
    <Sheet
      open={open}
      onClose={() => {
        pending.current = null;
        setOpen(false);
      }}
      title="Stack AI needs an account"
    >
      <p className="-mt-1 text-[15px] leading-relaxed">
        {t("Summaries, Explain, PDF questions and more, free up to a daily limit.")}
      </p>
      <p className="-mt-2 text-[13px] leading-relaxed text-muted">
        {t("Your notes, PDFs and reading still work without an account.")}
      </p>
      <SignInPanel />
    </Sheet>
  );
  return [requireSignIn, sheet] as const;
}

/** A small lock on a locked AI button. */
export function AiLock({ size = 12 }: { size?: number }) {
  return <LockIcon size={size} aria-hidden />;
}

// Asks once per kind of AI feature before anything is sent to Claude.
export function useAiConsent() {
  const t = useT();
  const [ask, setAsk] = useState<{ kind: string; what: string } | null>(null);
  const done = useRef<(ok: boolean) => void>(() => {});
  const confirm = useCallback((kind: string, what: string) => {
    if (aiConsented(kind)) return Promise.resolve(true);
    setAsk({ kind, what });
    return new Promise<boolean>((resolve) => (done.current = resolve));
  }, []);
  const close = (ok: boolean) => {
    if (ok && ask) setAiConsent(ask.kind);
    setAsk(null);
    done.current(ok);
  };
  const sheet = (
    <Sheet open={!!ask} onClose={() => close(false)} title="Use Stack AI?">
      <p className="text-[15px] leading-relaxed">
        <Rich
          text={t("To do this, Stack sends **{what}** to **{engine}** through Stack’s server. It’s used only to write your answer.", {
            what: ask?.what ?? "",
            engine: AI_ENGINE,
          })}
        />
      </p>
      <p className="text-[13px] leading-relaxed text-muted">
        {t("AI answers can be wrong: check anything important. You’ll only be asked once for this feature.")}
      </p>
      <button
        onClick={() => close(true)}
        className="flex h-12 items-center justify-center gap-2 rounded-full bg-ink text-[15px] font-semibold text-on-ink"
      >
        <SparkleIcon size={17} /> {t("Continue")}
      </button>
      <button onClick={() => close(false)} className="h-11 text-[14px] font-semibold text-muted">
        {t("Not now")}
      </button>
    </Sheet>
  );
  return [confirm, sheet] as const;
}

export function AiLabel({ children = "Stack AI" }: { children?: ReactNode }) {
  return (
    <span className="label flex items-center gap-1.5 text-[10px] text-muted">
      <SparkleIcon size={13} />
      {children}
    </span>
  );
}

export function AiErrorNote({ error }: { error: unknown }) {
  const t = useT();
  const e = error instanceof AiError ? error : new AiError("api", t("Something went wrong. Try again."));
  return (
    <p className="text-[14px] leading-relaxed text-music-text">
      {t(e.message)}{" "}
      {e.code === "signin" && (
        <Link href="/account" className="underline">
          {t("Sign in")}
        </Link>
      )}
    </p>
  );
}

// An answer with its citations: page chips for PDFs, links for your notes.
export function AnswerView({
  answer,
  streaming,
  onPage,
  hrefOf,
  className = "",
}: {
  answer: Answer | null;
  streaming?: string;
  onPage?: (page: number) => void;
  hrefOf?: (source: string) => string | undefined;
  className?: string;
}) {
  const t = useT();
  if (!answer)
    return (
      <p className={`text-[15px] leading-relaxed whitespace-pre-wrap ${className}`}>
        {streaming || <span className="animate-pulse text-muted">{t("Thinking…")}</span>}
      </p>
    );
  return (
    <div className={`text-[15px] leading-relaxed whitespace-pre-wrap ${className}`}>
      {answer.blocks.map((b, i) => (
        <span key={i}>
          {b.text}
          {dedupe(b.cites).map((c, j) =>
            c.page && onPage ? (
              <button
                key={j}
                onClick={() => onPage(c.page!)}
                title={c.cited}
                className="label mx-0.5 inline-flex h-5 items-center rounded-full bg-pdf-tint px-1.5 align-middle text-[9px] text-pdf-deep"
              >
                p. {c.page}
              </button>
            ) : c.source && hrefOf?.(c.source) ? (
              <Link
                key={j}
                href={hrefOf(c.source)!}
                title={c.cited}
                className="label mx-0.5 inline-flex h-5 max-w-[160px] items-center truncate rounded-full bg-news-tint px-1.5 align-middle text-[9px] text-news-deep"
              >
                {c.title ?? t("note")}
              </Link>
            ) : null,
          )}
        </span>
      ))}
      {answer.cut && <span className="text-muted"> …({t("cut short")})</span>}
    </div>
  );
}

// One chip per page or note; pages in reading order.
const dedupe = (cites: Cite[]) => {
  const seen = new Set<string>();
  return cites
    .filter((c) => {
      const k = `${c.page ?? ""}|${c.source ?? ""}`;
      return !seen.has(k) && seen.add(k);
    })
    .sort((a, b) => (a.page ?? 0) - (b.page ?? 0));
};
