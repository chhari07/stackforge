"use client";

import { useEffect } from "react";

// The huge .display headings (STACK, FOCUS, the timer) are sized to the screen
// width for the English wordmarks. A longer word, or Hindi in the phone's wider
// fallback font, can still be wider than the screen: shrink just that heading
// until it fits. Inline ones (counters inside a row) are left alone. Other big
// headings (Notes) opt in with .fit.
function fit() {
  document.querySelectorAll<HTMLElement>(".display, .fit").forEach((el) => {
    el.style.fontSize = "";
    const w = el.clientWidth;
    if (!w || el.scrollWidth <= w + 1) return;
    const size = parseFloat(getComputedStyle(el).fontSize);
    const want = (size * w * 0.98) / el.scrollWidth;
    el.style.fontSize = `${want}px`;
    // The Android app enlarges text again by the phone's font size (150% on
    // "Large"), on top of what's set here: take that back out.
    const zoom = parseFloat(getComputedStyle(el).fontSize) / want;
    el.style.fontSize = `${Math.floor(want / Math.max(zoom, 1))}px`;
  });
}

export function FitDisplay() {
  useEffect(() => {
    let frame = 0;
    // Before the next paint, so a heading never shows at the too-big size.
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(fit);
    };
    schedule();
    // New pages, language switches and the ticking timer change the text.
    const mo = new MutationObserver(schedule);
    mo.observe(document.body, { childList: true, characterData: true, subtree: true });
    addEventListener("resize", schedule);
    document.fonts?.ready.then(schedule);
    return () => {
      cancelAnimationFrame(frame);
      mo.disconnect();
      removeEventListener("resize", schedule);
    };
  }, []);
  return null;
}
