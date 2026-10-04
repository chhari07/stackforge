"use client";

import { useState } from "react";
import { NO_PREFS, addPref, getNewsPrefs, removePref, type PrefList } from "@/lib/news-prefs";
import { useStore } from "@/lib/use-store";
import { CloseIcon } from "./icons";
import { Sheet } from "./sheet";
import { useT } from "@/lib/i18n";

// One list of words: its chips (tap × to remove) and a box to add another.
function Words({
  list,
  words,
  label,
  hint,
  placeholder,
}: {
  list: PrefList;
  words: string[];
  label: string;
  hint: string;
  placeholder: string;
}) {
  const t = useT();
  const [word, setWord] = useState("");
  return (
    <section className="flex flex-col gap-2">
      <h3 className="label text-[10px] font-medium">{t(label)}</h3>
      {words.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {words.map((w) => (
            <li key={w} className="flex h-9 items-center rounded-full bg-card pl-3.5 text-[14px]">
              {w}
              <button aria-label={t("Remove {name}", { name: w })} onClick={() => removePref(list, w)} className="flex size-9 items-center justify-center text-muted">
                <CloseIcon size={13} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!word.trim()) return;
          addPref(list, word);
          setWord("");
        }}
        className="flex gap-2"
      >
        <input
          value={word}
          onChange={(e) => setWord(e.target.value)}
          maxLength={40}
          placeholder={t(placeholder)}
          aria-label={t(label)}
          className="h-11 min-w-0 grow rounded-full border border-ink/15 bg-card px-4 text-[15px] outline-none focus:border-ink"
        />
        <button
          disabled={!word.trim()}
          className="h-11 shrink-0 rounded-full bg-ink px-5 text-[14px] font-semibold text-on-ink disabled:opacity-40"
        >
          Add
        </button>
      </form>
      <p className="text-[12px] leading-relaxed text-muted">{t(hint)}</p>
    </section>
  );
}

// "Your news": the words you follow, and the words and sources you've muted.
// `sources` are the ones in today's stories, offered for muting.
export function NewsPrefsSheet({ open, onClose, sources }: { open: boolean; onClose: () => void; sources: string[] }) {
  const t = useT();
  const [prefs] = useStore(getNewsPrefs, NO_PREFS);
  const offered = sources.filter((s) => !prefs.mutedSources.some((m) => m.toLowerCase() === s.toLowerCase()));

  return (
    <Sheet open={open} onClose={onClose} title="Your news">
      <div className="flex max-h-[68dvh] flex-col gap-6 overflow-y-auto">
        <Words
          list="follows"
          words={prefs.follows}
          label="Following"
          placeholder="e.g. ISRO, cricket, Apple"
          hint="Stories about these, from every topic, are gathered under Following."
        />
        <Words
          list="mutedWords"
          words={prefs.mutedWords}
          label="Muted words"
          placeholder="A word or name to hide"
          hint="Stories with a muted word in the headline or summary are left out."
        />
        <section className="flex flex-col gap-2">
          <h3 className="label text-[10px] font-medium">{t("Muted sources")}</h3>
          {prefs.mutedSources.length > 0 && (
            <ul className="flex flex-wrap gap-2">
              {prefs.mutedSources.map((s) => (
                <li key={s} className="flex h-9 items-center rounded-full bg-card pl-3.5 text-[14px]">
                  {s}
                  <button aria-label={t("Unmute {name}", { name: s })} onClick={() => removePref("mutedSources", s)} className="flex size-9 items-center justify-center text-muted">
                    <CloseIcon size={13} />
                  </button>
                </li>
              ))}
            </ul>
          )}
          {offered.length > 0 ? (
            <ul className="flex flex-wrap gap-2">
              {offered.map((s) => (
                <li key={s}>
                  <button
                    onClick={() => addPref("mutedSources", s)}
                    className="label h-8 rounded-full border border-ink/20 px-3 text-[10px]"
                  >
                    {t("Mute {name}", { name: s })}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            prefs.mutedSources.length === 0 && <p className="text-[12px] text-muted">{t("Sources in today’s stories show here to mute.")}</p>
          )}
        </section>
      </div>
    </Sheet>
  );
}
