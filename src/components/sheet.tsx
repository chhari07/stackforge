"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { CloseIcon } from "./icons";
import { useT } from "@/lib/i18n";

// Bottom sheet built on <dialog>, so focus trapping and Esc come for free.
export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const t = useT();

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      // Only this sheet's own close: React passes a sheet-in-a-sheet's close up to its parent too.
      onClose={(e) => e.target === ref.current && onClose()}
      onClick={(e) => e.target === ref.current && onClose()}
      className="glass-strong m-0 mx-auto mt-auto w-full max-w-[560px] [--gutter:20px] rounded-t-[26px] border-b-0 p-0 text-ink backdrop:bg-black/30 backdrop:backdrop-blur-[3px]"
    >
      <div className="flex flex-col gap-4 px-5 pt-5 pb-[calc(max(env(safe-area-inset-bottom),20px)+20px)]">
        <div className="flex items-center justify-between">
          <h2 className="text-[19px] font-bold">{t(title)}</h2>
          <button aria-label={t("Close")} onClick={onClose} className="-mr-2 flex size-11 items-center justify-center">
            <CloseIcon size={20} />
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}

export function Chips<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: { value: T; label: string; icon?: ReactNode }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
}) {
  const t = useT();
  return (
    <div role="radiogroup" aria-label={t(label)} className="no-scrollbar bleed flex gap-2 overflow-x-auto overscroll-x-contain">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            className={`label flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[10px] ${
              on ? "bg-ink text-on-ink" : "bg-card"
            } ${o.icon ? "pl-3" : ""}`}
          >
            {o.icon}
            {o.label.startsWith("#") ? o.label : t(o.label)}
          </button>
        );
      })}
    </div>
  );
}
