"use client";

import { useEffect, useState } from "react";
import { entryText, lookup, type WordEntry } from "@/lib/dictionary";
import { Sheet } from "./sheet";
import { useT } from "@/lib/i18n";

type State = { status: "loading" } | { status: "ok"; entry: WordEntry } | { status: "none" } | { status: "offline" };

// "Meaning" on a selected word: its definitions, a Hindi meaning, a button
// that keeps it in Notes (My words) so it comes back in the daily review, and
// one that shares it as a card.
export function WordSheet({
  word,
  onClose,
  onSave,
  onShare,
}: {
  word: string | null;
  onClose: () => void;
  onSave: (word: string, meaning: string) => void;
  onShare?: (word: string, meaning: string) => void;
}) {
  const t = useT();
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    if (!word) return;
    let alive = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState({ status: "loading" });
    lookup(word)
      .then((entry) => alive && setState(entry ? { status: "ok", entry } : { status: "none" }))
      .catch(() => alive && setState({ status: "offline" }));
    return () => {
      alive = false;
    };
  }, [word]);

  return (
    <Sheet open={word !== null} onClose={onClose} title={word?.toLowerCase() ?? ""}>
      {state.status === "loading" && <p className="label py-6 text-center text-[10px] text-muted">{t("Looking it up…")}</p>}
      {state.status === "none" && <p className="py-4 text-[15px] text-muted">{t("No meaning found for this word.")}</p>}
      {state.status === "offline" && (
        <p className="py-4 text-[15px] text-muted">{t("Couldn’t look it up. Check your connection.")}</p>
      )}
      {state.status === "ok" && (
        <>
          {state.entry.hindi && (
            <p className="rounded-xl bg-pdf-tint px-3.5 py-3">
              <span className="label block text-[9px] text-pdf-deep">{t("Hindi")}</span>
              <span lang="hi" className="text-[20px] leading-snug font-semibold">
                {state.entry.hindi}
              </span>
            </p>
          )}
          {state.entry.meanings.length > 0 && (
            <ol className="flex max-h-[38dvh] flex-col gap-3 overflow-y-auto">
              {state.entry.meanings.map((m, i) => (
                <li key={i} className="flex flex-col gap-0.5">
                  <span className="label text-[9px] text-muted">{t(m.part)}</span>
                  <span className="text-[15px] leading-relaxed">{m.definition}</span>
                </li>
              ))}
            </ol>
          )}
          <button
            onClick={() => onSave(state.entry.word, entryText(state.entry))}
            className="h-12 rounded-full bg-ink text-[15px] font-semibold text-on-ink"
          >
            {t("Save to My words")}
          </button>
          {onShare && (
            <button
              onClick={() => onShare(state.entry.word, entryText(state.entry))}
              className="h-11 rounded-full border border-ink/20 text-[14px] font-semibold"
            >
              {t("Share as a card")}
            </button>
          )}
          <p className="label text-center text-[9px] text-muted">Wiktionary · MyMemory</p>
        </>
      )}
    </Sheet>
  );
}
