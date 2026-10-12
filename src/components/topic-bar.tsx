"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useT } from "@/lib/i18n";
import { CheckIcon } from "./icons";

export type TopicOption<T extends string> = { value: T; label: string; icon?: ReactNode };

/**
 * News topics without a wall of chips: the few that matter to you stay in
 * view (Top, Following, your interests, and whatever is open), and every
 * other topic sits in the "More" dropdown.
 */
export function TopicBar<T extends string>({
  shown,
  more,
  value,
  onChange,
}: {
  shown: TopicOption<T>[];
  more: TopicOption<T>[];
  value: T;
  onChange: (v: T) => void;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  // Closes on a tap anywhere else, or Esc.
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  const chip = (on: boolean) =>
    `label flex h-9 shrink-0 items-center gap-1.5 rounded-full pr-3.5 pl-3 text-[10px] ${on ? "bg-ink text-on-ink" : "bg-card"}`;
  const label = (o: TopicOption<T>) => (o.label.startsWith("#") ? o.label : t(o.label));

  return (
    <div className="flex items-center gap-2">
      <div role="radiogroup" aria-label={t("Topic")} className="no-scrollbar -ml-(--gutter) flex min-w-0 grow gap-2 overflow-x-auto overscroll-x-contain pl-(--gutter)">
        {shown.map((o) => (
          <button key={o.value} role="radio" aria-checked={o.value === value} onClick={() => onChange(o.value)} className={chip(o.value === value)}>
            {o.icon}
            {label(o)}
          </button>
        ))}
      </div>
      {more.length > 0 && (
        <div ref={box} className="relative shrink-0">
          <button
            aria-haspopup="menu"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className={`${chip(open)} pr-3`}
          >
            {t("More")}
            <svg aria-hidden width="10" height="10" viewBox="0 0 10 10" className={`transition-transform ${open ? "rotate-180" : ""}`}>
              <path d="M1.5 3.5 5 7l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          {open && (
            <div role="menu" aria-label={t("More topics")} className="glass-strong absolute top-[calc(100%+8px)] right-0 z-40 grid w-[min(300px,80vw)] grid-cols-2 gap-1 rounded-2xl p-1.5">
              {more.map((o) => (
                <button
                  key={o.value}
                  role="menuitemradio"
                  aria-checked={o.value === value}
                  onClick={() => {
                    onChange(o.value);
                    setOpen(false);
                  }}
                  className={`flex h-11 items-center gap-2 rounded-xl px-3 text-left text-[14px] font-semibold ${
                    o.value === value ? "bg-ink text-on-ink" : "active:bg-ink/10"
                  }`}
                >
                  {o.icon}
                  <span className="min-w-0 grow truncate">{label(o)}</span>
                  {o.value === value && <CheckIcon size={14} />}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
