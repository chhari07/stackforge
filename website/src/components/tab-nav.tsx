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

// The pill and the rail are the app's bar, lying down and standing up.
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
        className={`fixed bottom-[max(env(safe-area-inset-bottom),14px)] left-1/2 z-40 flex -translate-x-1/2 gap-1 rounded-full bg-ink p-1.5 shadow-[0_10px_28px_rgba(0,0,0,.28)] transition duration-300 ${
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
              className={`flex size-[min(48px,12.2vw)] items-center justify-center rounded-full transition-colors ${
                on ? "bg-on-ink text-ink" : "text-on-ink/60 hover:text-on-ink"
              }`}
            >
              <Icon />
            </a>
          );
        })}
      </nav>
    );
  }

  // Tablets and computers: the app's own bar, standing up: a dark pill of
  // icons with the open tab in a light circle.
  return (
    <nav
      aria-label="App tabs"
      className="mx-auto flex w-fit flex-col items-center gap-1 rounded-full bg-ink p-1.5 shadow-[0_10px_28px_rgba(0,0,0,.28)]"
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
            className={`flex size-12 items-center justify-center rounded-full transition-colors ${
              on ? "bg-on-ink text-ink" : "text-on-ink/60 hover:text-on-ink"
            }`}
          >
            <Icon />
          </a>
        );
      })}
    </nav>
  );
}
