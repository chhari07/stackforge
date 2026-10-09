"use client";

import Link from "next/link";
import { ShieldIcon } from "./stack-icons";
import { useT } from "@/lib/i18n";

// Opens the privacy policy (/privacy), from Settings and the Account screen.
export function PrivacyRow({ className = "" }: { className?: string }) {
  const t = useT();
  return (
    <Link href="/privacy" className={`flex items-center gap-3.5 rounded-2xl bg-card p-4 ${className}`}>
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-ink text-on-ink">
        <ShieldIcon size={20} />
      </span>
      <span className="flex min-w-0 grow flex-col gap-0.5">
        <span className="text-[16px] font-semibold">{t("Privacy policy")}</span>
        <span className="label line-clamp-2 text-[10px] text-muted">
          {t("What Stack stores, what leaves your phone, and how to delete it")}
        </span>
      </span>
      <span className="label shrink-0 text-[10px] underline">{t("Open")}</span>
    </Link>
  );
}
