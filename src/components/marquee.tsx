"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

// One line of text that slides sideways, looping, when it's too long to fit,
// so the whole song name can be read. Short text just sits still.
// Touching it pauses the slide; with reduced motion it scrolls by hand instead.
export function Marquee({ children, className = "", speed = 40 }: { children: ReactNode; className?: string; speed?: number }) {
  const box = useRef<HTMLSpanElement>(null);
  const text = useRef<HTMLSpanElement>(null);
  const [width, setWidth] = useState(0); // text width in px when it overflows, else 0

  useEffect(() => {
    const b = box.current;
    const t = text.current;
    if (!b || !t) return;
    const measure = () => {
      const w = t.getBoundingClientRect().width;
      setWidth(w > b.clientWidth + 1 ? w : 0);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(b);
    ro.observe(t);
    return () => ro.disconnect();
  }, [children]);

  const moving = width > 0;
  return (
    <span ref={box} className={`marquee-box block min-w-0 overflow-x-clip whitespace-nowrap ${className}`}>
      <span
        className={`inline-flex ${moving ? "marquee" : ""}`}
        style={moving ? { animationDuration: `${Math.max(6, (width * 1.15) / speed + 2)}s` } : undefined}
      >
        <span className={moving ? "pr-[1.2em]" : ""}>
          <span ref={text} className="inline-block">{children}</span>
        </span>
        {moving && (
          <span aria-hidden className="marquee-copy pr-[1.2em]">
            {children}
          </span>
        )}
      </span>
    </span>
  );
}
