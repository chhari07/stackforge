"use client";

import { useRef, useState } from "react";
import { addNote } from "@/lib/db";
import { AI_LANGS, aiAvailable, aiLang, answerText, runAi, type AiLang, type Answer } from "@/lib/ai";
import { AiErrorNote, AiLabel, AnswerView, useAiConsent } from "./ai-kit";
import { SparkleIcon } from "./stack-icons";
import { useToast } from "./toast";
import { useT } from "@/lib/i18n";

// "Summarize" at the top of an article: three bullets and a takeaway, in the
// AI language from Settings, or in Hindi with one tap.
export function AiSummary({ id, title, html, source }: { id: string; title: string; html: string; source: string }) {
  const t = useT();
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  const [streaming, setStreaming] = useState("");
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [saved, setSaved] = useState(false);
  const [confirm, consentSheet] = useAiConsent();
  const toast = useToast();
  const stop = useRef<AbortController | null>(null);
  const [lang, setLang] = useState<AiLang | null>(null);

  if (!aiAvailable()) return null;
  // The other language to offer after a summary: Hindi, or back to your AI language (or English).
  const other: AiLang = lang !== "hi" ? "hi" : aiLang() === "hi" ? "en" : aiLang();

  const run = async (l: AiLang = lang ?? aiLang()) => {
    setLang(l);
    if (!(await confirm("summary", t("the article’s text")))) return;
    const text = new DOMParser().parseFromString(html, "text/html").body.textContent ?? "";
    setState("busy");
    setStreaming("");
    setAnswer(null);
    stop.current = new AbortController();
    try {
      setAnswer(await runAi({ task: "summary", title, text, lang: l }, setStreaming, stop.current.signal));
      setState("done");
    } catch (e) {
      setError(e);
      setState("error");
    }
  };

  const save = async () => {
    if (!answer) return;
    await addNote({
      kind: "article",
      title: `${t("Summary")} · ${title}`,
      body: answerText(answer),
      sourceTitle: title,
      sourceLabel: source,
      articleId: id,
      href: `/read?id=${id}`,
    });
    setSaved(true);
    toast({ text: t("Summary saved to Notes"), href: "/notes" });
  };

  return (
    <>
      {state === "idle" ? (
        <div className="mb-6 flex gap-2">
          <button
            onClick={() => run()}
            className="flex h-11 items-center gap-2 rounded-full border border-ink/15 px-4 text-[14px] font-semibold"
          >
            <SparkleIcon size={17} /> {t("Summarize")}
          </button>
          {aiLang() !== "hi" && (
            <button
              onClick={() => run("hi")}
              aria-label={t("Summarize in Hindi")}
              className="h-11 rounded-full border border-ink/15 px-4 text-[14px] font-semibold"
            >
              हिंदी में
            </button>
          )}
        </div>
      ) : (
        <div className="mb-7 flex flex-col gap-3 rounded-2xl bg-card p-4">
          <AiLabel>
            {t("Summary")} · {answer?.engine ?? "Stack AI"}
          </AiLabel>
          {state === "error" ? (
            <AiErrorNote error={error} />
          ) : (
            <AnswerView answer={answer} streaming={streaming} className="font-serif text-[17px]" />
          )}
          <div className="flex gap-2">
            {state === "done" && (
              <button
                onClick={save}
                disabled={saved}
                className="h-10 rounded-full bg-ink px-4 text-[14px] font-semibold text-on-ink disabled:opacity-50"
              >
                {saved ? t("Saved") : t("Save to Notes")}
              </button>
            )}
            {state === "busy" ? (
              <button onClick={() => stop.current?.abort()} className="h-10 px-2 text-[14px] font-semibold text-muted">
                {t("Stop")}
              </button>
            ) : (
              <>
                <button onClick={() => run()} className="h-10 px-2 text-[14px] font-semibold text-muted">
                  {state === "error" ? t("Try again") : t("Redo")}
                </button>
                {state === "done" && (
                  <button onClick={() => run(other)} className="h-10 px-2 text-[14px] font-semibold text-muted">
                    {other === "hi" ? "हिंदी में" : t("In {lang}", { lang: AI_LANGS[other].split(" · ").pop() ?? "" })}
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}
      {consentSheet}
    </>
  );
}
