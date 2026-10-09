"use client";

import Link from "next/link";
import { Logo } from "./logo";
import { Avatar } from "./avatar";
import { GearIcon, SearchIcon } from "./icons";
import { useT } from "@/lib/i18n";

// The same top bar on every tab: logo (back to Today), search, account and
// settings. It sticks under the status bar while the page scrolls. `className`
// sets the background to match the page (Library uses bg-paper-2).
export function TopBar({ animate = false, className = "bg-paper" }: { animate?: boolean; className?: string }) {
  const t = useT();
  return (
    <div className={`sticky top-[env(safe-area-inset-top)] z-30 -mx-5 flex h-14 shrink-0 items-center justify-between px-5 ${className}`}>
      <Link href="/" aria-label={t("Today")} className="-ml-1.5 flex h-11 items-center">
        <Logo size={30} animate={animate} />
      </Link>
      <div className="-mr-2.5 flex items-center">
        <Link href="/search" aria-label={t("Search everything")} className="flex size-11 items-center justify-center">
          <SearchIcon size={22} />
        </Link>
        <Link href="/account" aria-label={t("Your account")} className="flex size-11 items-center justify-center">
          <Avatar size={30} />
        </Link>
        <Link href="/settings" aria-label={t("Settings")} className="flex size-11 items-center justify-center">
          <GearIcon size={22} className="gear" />
        </Link>
      </div>
    </div>
  );
}
