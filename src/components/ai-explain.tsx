"use client";

import { useRef, useState } from "react";
import { addNote, type NoteKind } from "@/lib/db";
import { aiAvailable, answerText, runAi, type Answer } from "@/lib/ai";
import { AiErrorNote, AiLabel, AnswerView, useAiConsent } from "./ai-kit";
import { Sheet } from "./sheet";
import { useToast } from "./toast";
import { useT } from "@/lib/i18n";

type Where = { kind: NoteKind; title?: string; label?: string; href?: string };

// "Explain" in the selection bar: the selected line in simple words, in the AI
// language from Settings, with the answer saveable as a note.
export function useAiExplain(where: Where) {
  const t = useT();
  const [line, setLine] = useState<string | null>(null);
  const [streaming, setStreaming] = useState("");
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [saved, setSaved] = useState(false);
  const [confirm, consentSheet] = useAiConsent();
  const stop = useRef<AbortController | null>(null);
  const toast = useToast();

  const explain = async (text: string, context?: string) => {
    if (!(await confirm("explain", t("the line you selected and the text around it")))) return;
    stop.current?.abort();
    setLine(text);
    setStreaming("");
    setAnswer(null);
    setError(null);
    setSaved(false);
    const ctl = (stop.current = new AbortController());
    try {
      const a = await runAi({ task: "explain", text, context, title: where.title }, setStreaming, ctl.signal);
      if (!ctl.signal.aborted) setAnswer(a);
    } catch (e) {
      if (!ctl.signal.aborted) setError(e);
    }
  };

  const close = () => {
    stop.current?.abort();
    setLine(null);
  };

  const save = async () => {
    if (!answer || !line) return;
    await addNote({
      kind: where.kind,
      quote: line,
      body: answerText(answer),
      sourceTitle: where.title,
      sourceLabel: where.label,
      href: where.href,
    });
    setSaved(true);
    toast({ text: t("Explanation saved to Notes"), href: "/notes" });
  };

  const sheet = (
    <>
      <Sheet open={!!line} onClose={close} title="Explain simply">
        <blockquote className="border-l-2 border-ink/20 pl-3 font-serif text-[15px] italic leading-relaxed text-muted">
          {line && line.length > 280 ? `${line.slice(0, 280)}…` : line}
        </blockquote>
        {error !== null ? (
          <AiErrorNote error={error} />
        ) : (
          <AnswerView answer={answer} streaming={streaming} className="font-serif text-[17px]" />
        )}
        <AiLabel>
          {answer?.engine ? `Stack AI · ${answer.engine}` : "Stack AI"} · {t("answers can be wrong")}
        </AiLabel>
        {answer && (
          <button
            onClick={save}
            disabled={saved}
            className="h-12 rounded-full bg-ink text-[15px] font-semibold text-on-ink disabled:opacity-50"
          >
            {saved ? t("Saved") : t("Save to Notes")}
          </button>
        )}
        {error !== null && line && (
          <button onClick={() => explain(line)} className="h-11 text-[14px] font-semibold text-muted">
            {t("Try again")}
          </button>
        )}
      </Sheet>
      {consentSheet}
    </>
  );

  return [aiAvailable() ? explain : undefined, sheet] as const;
}
