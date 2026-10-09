"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { HomeIcon, NewsIcon, NoteIcon, PlusIcon, ShelfIcon } from "./icons";
import { ReviewIcon } from "./stack-icons";
import { useT } from "@/lib/i18n";

// The loop first (Today, Library, Review, Notes), news last. Music isn't a tab:
// it's in Focus, the mini player and Settings (/music still works).
const PILL = [
  { href: "/", label: "Today", Icon: HomeIcon },
  { href: "/library", label: "Library", Icon: ShelfIcon },
  { href: "/review", label: "Review", Icon: ReviewIcon },
  { href: "/notes", label: "Notes", Icon: NoteIcon },
  { href: "/news", label: "News", Icon: NewsIcon },
];

const isActive = (path: string, href: string) => (href === "/" ? path === "/" : path.startsWith(href));

// What "+" adds on this screen: a link, or something the screen does itself.
export type TabAdd = { label: string; href?: string; onClick?: () => void };

// Phones: a floating pill of icons on the main screens, the open tab in a
// circle. The pill stays centred; a screen that has something to add gets a
// "+" circle beside it. Tablets use the same bar.
export function TabBar({ add }: { add?: TabAdd }) {
  const path = usePathname();
  const t = useT();
  // Narrow phones shrink the circles so the "+" still fits beside the pill.
  const circle = "flex size-[min(48px,12.2vw)] items-center justify-center rounded-full";
  const plus = `${circle} absolute top-1/2 left-full ml-1.5 -translate-y-1/2 bg-ink text-on-ink shadow-[0_10px_28px_rgba(0,0,0,.28)]`;
  return (
    <nav
      aria-label="Main"
      className="fixed bottom-[max(env(safe-area-inset-bottom),12px)] left-1/2 z-40 flex -translate-x-1/2 gap-1 rounded-full bg-ink p-1.5 shadow-[0_10px_28px_rgba(0,0,0,.28)]"
    >
      {PILL.map(({ href, label, Icon }) => {
        const active = isActive(path, href);
        return (
          <Link
            key={href}
            href={href}
            aria-label={t(label)}
            aria-current={active ? "page" : undefined}
            className={`${circle} ${active ? "bg-on-ink text-ink" : "text-on-ink/60"}`}
          >
            <Icon />
          </Link>
        );
      })}
      {add &&
        (add.href ? (
          <Link href={add.href} aria-label={t(add.label)} className={plus}>
            <PlusIcon size={22} />
          </Link>
        ) : (
          <button onClick={add.onClick} aria-label={t(add.label)} className={plus}>
            <PlusIcon size={22} />
          </button>
        ))}
    </nav>
  );
}
