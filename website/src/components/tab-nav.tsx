"use client";

import { useEffect, useState } from "react";
import { HomeIcon, NewsIcon, NoteIcon, ReviewIcon, ShelfIcon } from "./icons";

// The app's tabs, in the app's order, with the same icons
// (stack/src/components/tab-bar.tsx): the loop first, news last. Each one
// jumps to its part of the tour.
export const TABS = [
  { id: "today", label: "Today", Icon: HomeIcon },
  { id: "library", label: "Library", Icon: ShelfIcon },
  { id: "review", label: "Review", Icon: ReviewIcon },
  { id: "notes", label: "Notes", Icon: NoteIcon },
  { id: "news", label: "News", Icon: NewsIcon },
] as const;

// The pill and the rail are the app's glass bar (UI 2.0), lying down and
// standing up: frosted, with the open tab in a dark circle.
const PILL = TABS;

export type TabId = (typeof TABS)[number]["id"];

// Marks the tab whose section is in the middle of the screen, like the
// app marks the screen you're on. Without JavaScript the links still work.
// On phones the pill only floats while the tour is on screen.
export function TabNav({ layout }: { layout: "rail" | "pill" }) {
  const [active, setActive] = useState<TabId>("today");
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setActive(e.target.id.replace("tab-", "") as TabId);
      },
      { rootMargin: "-45% 0px -50% 0px" },
    );
    for (const t of TABS) {
      const el = document.getElementById(`tab-${t.id}`);
      if (el) observer.observe(el);
    }
    const tour = document.getElementById("tour");
    const inTour = new IntersectionObserver(([e]) => setShown(e.isIntersecting), { rootMargin: "-30% 0px -40% 0px" });
    if (tour) inTour.observe(tour);
    return () => {
      observer.disconnect();
      inTour.disconnect();
    };
  }, []);

  if (layout === "pill") {
    return (
      <nav
        aria-label="App tabs"
        className={`glass-strong fixed bottom-[max(env(safe-area-inset-bottom),14px)] left-1/2 z-40 flex -translate-x-1/2 gap-1 rounded-full p-1.5 transition duration-300 ${
          shown ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-24 opacity-0"
        }`}
      >
        {PILL.map(({ id, label, Icon }) => {
          const on = active === id;
          return (
            <a
              key={id}
              href={`#tab-${id}`}
              aria-label={label}
              aria-current={on ? "true" : undefined}
              tabIndex={shown ? undefined : -1}
              className={`relative flex size-[min(48px,12.2vw)] items-center justify-center rounded-full transition-colors ${
                on ? "bg-ink text-on-ink" : "text-ink/55 hover:text-ink"
              }`}
            >
              <Icon />
              {on && <TabName key={id} text={label} side="top" />}
            </a>
          );
        })}
      </nav>
    );
  }

  // Tablets and computers: the app's own bar, standing up.
  return (
    <nav
      aria-label="App tabs"
      className="glass-strong mx-auto flex w-fit flex-col items-center gap-1 rounded-full p-1.5"
    >
      {TABS.map(({ id, label, Icon }) => {
        const on = active === id;
        return (
          <a
            key={id}
            href={`#tab-${id}`}
            aria-label={label}
            title={label}
            aria-current={on ? "true" : undefined}
            className={`relative flex size-12 items-center justify-center rounded-full transition-colors ${
              on ? "bg-ink text-on-ink" : "text-ink/55 hover:text-ink"
            }`}
          >
            <Icon />
            {on && <TabName key={id} text={label} side="right" />}
          </a>
        );
      })}
    </nav>
  );
}

// The open tab's name in a small glass capsule, as in the app
// (stack/src/components/tab-bar.tsx): above the pill, beside the rail.
function TabName({ text, side }: { text: string; side: "top" | "right" }) {
  return (
    <span
      aria-hidden="true"
      className={`tab-name glass label pointer-events-none absolute rounded-full px-2.5 py-1 text-[9px] font-medium whitespace-nowrap text-ink ${
        side === "top"
          ? "bottom-[calc(100%+16px)] left-1/2 -translate-x-1/2"
          : "tab-name-side left-[calc(100%+16px)] top-1/2 -translate-y-1/2"
      }`}
    >
      {text}
    </span>
  );
}
