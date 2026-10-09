"use client";

import { useEffect, useState } from "react";
import { useToast } from "./toast";
import { AI_ENGINE, AI_LANGS, aiLang, aiSetUp, aiTurnedOn, setAiLang, setAiTurnedOn, type AiLang } from "@/lib/ai";
import { useT } from "@/lib/i18n";

const SWITCH =
  "h-7 w-12 shrink-0 cursor-pointer appearance-none rounded-full bg-rule transition-colors before:block before:size-6 before:translate-x-0.5 before:rounded-full before:bg-white before:shadow before:transition-transform checked:bg-music checked:before:translate-x-[22px] disabled:cursor-not-allowed disabled:opacity-50";

// Settings → Stack AI: one switch for every AI feature.
export function AiSection() {
  const t = useT();
  const toast = useToast();
  const [on, setOn] = useState<boolean | null>(null);
  const [setUp, setSetUp] = useState(true);
  const [lang, setLang] = useState<AiLang>("en");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOn(aiTurnedOn());
    setSetUp(aiSetUp());
    setLang(aiLang());
  }, []);

  if (on === null) return null;
  return (
    <>
      <label className="flex items-center justify-between gap-4">
        <span className="flex flex-col">
          <span className="text-[15px] font-semibold">Stack AI</span>
          <span className="text-[13px] text-muted">
            {on
              ? t("Summaries, Explain, PDF questions, Ask your Stack and Tidy note. Asks before sending anything.")
              : t("Off: no AI buttons anywhere, and nothing is sent.")}
          </span>
        </span>
        <input
          type="checkbox"
          role="switch"
          aria-label="Stack AI"
          checked={on}
          disabled={!setUp}
          onChange={(e) => {
            setAiTurnedOn(e.target.checked);
            setOn(e.target.checked);
            toast({ text: e.target.checked ? t("Stack AI is on") : t("Stack AI is off") });
          }}
          className={SWITCH}
        />
      </label>
      {on && setUp && (
        <label className="flex items-center justify-between gap-4">
          <span className="flex flex-col">
            <span className="text-[15px] font-semibold">{t("AI language")}</span>
            <span className="text-[13px] text-muted">{t("Summaries, explanations and answers come in this language.")}</span>
          </span>
          <select
            aria-label={t("AI language")}
            value={lang}
            onChange={(e) => {
              const l = e.target.value as AiLang;
              setAiLang(l);
              setLang(l);
            }}
            className="h-10 max-w-[44%] shrink-0 rounded-full border border-ink/15 bg-card px-3 text-[14px] outline-none"
          >
            {(Object.keys(AI_LANGS) as AiLang[]).map((l) => (
              <option key={l} value={l}>
                {AI_LANGS[l]}
              </option>
            ))}
          </select>
        </label>
      )}
      <p className="text-[12px] leading-relaxed text-muted">
        {setUp
          ? t("Runs on {engine} through Stack’s server, only when you tap an AI button.", { engine: AI_ENGINE })
          : t("Stack AI isn’t set up in this build (it needs an account server and an AI key).")}
      </p>
    </>
  );
}
