"use client";

import { useEffect, useState, type RefObject } from "react";
import { ShareIcon } from "./icons";
import { HighlighterIcon, LearningIcon, NoteAddIcon, SparkleIcon } from "./stack-icons";
import { asWord } from "@/lib/dictionary";
import { useT } from "@/lib/i18n";

type Props = {
  container: RefObject<HTMLElement | null>;
  accent: string; // text colour class for the "+ Note" action
  onHighlight: (text: string) => void;
  onNote: (text: string) => void;
  onMeaning: (word: string) => void;
  onShare: (text: string) => void;
  onExplain?: (text: string, context: string) => void; // Stack AI, when it's on
};

type Pos = { top: number; left: number; text: string; context: string };

// The paragraph around the selection, for "Explain".
function around(node: Node) {
  const el = node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement;
  return (el?.closest("p, li, blockquote, h1, h2, h3, h4, td, div")?.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 3000);
}

// Floating "Highlight / + Note / Share" bar shown above selected text. With a
// single word selected, "Share" gives way to "Meaning". With Stack AI on, "Explain" too.
export function SelectionToolbar({ container, accent, onHighlight, onNote, onMeaning, onShare, onExplain }: Props) {
  const tt = useT();
  const [pos, setPos] = useState<Pos | null>(null);

  useEffect(() => {
    const onChange = () => {
      const sel = document.getSelection();
      const root = container.current;
      if (!sel || sel.isCollapsed || !root || sel.rangeCount === 0) return setPos(null);
      const range = sel.getRangeAt(0);
      if (!root.contains(range.commonAncestorContainer)) return setPos(null);
      const text = sel.toString().replace(/\s+/g, " ").trim();
      if (text.length < 2) return setPos(null);
      const rect = range.getBoundingClientRect();
      const width = Math.min(onExplain ? 360 : 290, window.innerWidth - 16);
      const left = Math.min(
        Math.max(8, rect.left + rect.width / 2 - width / 2),
        window.innerWidth - width - 8,
      );
      // Android puts its own Copy / Share menu just above the selection, so
      // this bar goes below it, clear of the selection handles. With no room
      // there, it goes above the selection and above Android's menu.
      const below = rect.bottom + 44;
      const top = below + 56 < window.innerHeight ? below : Math.max(8, rect.top - 124);
      setPos({ top, left, text, context: around(range.commonAncestorContainer) });
    };
    const onScroll = () => setPos(null);
    document.addEventListener("selectionchange", onChange);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      document.removeEventListener("selectionchange", onChange);
      window.removeEventListener("scroll", onScroll);
    };
  }, [container, onExplain]);

  if (!pos) return null;
  const word = asWord(pos.text);

  const act = (fn: (t: string) => void) => () => {
    fn(pos.text);
    document.getSelection()?.removeAllRanges();
    setPos(null);
  };

  return (
    <div
      role="toolbar"
      aria-label={tt("Selection actions")}
      style={{ top: pos.top, left: pos.left }}
      // Keep the text selected while tapping a button.
      onPointerDown={(e) => e.preventDefault()}
      className={`fixed z-50 flex h-10 ${onExplain ? "w-[360px]" : "w-[290px]"} max-w-[calc(100vw-16px)] items-center justify-around rounded-[10px] bg-card px-1.5 shadow-[0_8px_24px_rgba(0,0,0,.14)]`}
    >
      <button className="label flex h-10 items-center gap-1.5 px-2 text-[10px]" onClick={act(onHighlight)}>
        <HighlighterIcon size={16} />
        {tt("Highlight")}
      </button>
      <button className={`label flex h-10 items-center gap-1.5 px-2 text-[10px] font-medium ${accent}`} onClick={act(onNote)}>
        <NoteAddIcon size={16} />
        {tt("Note")}
      </button>
      {onExplain && (
        <button className="label flex h-10 items-center gap-1.5 px-2 text-[10px]" onClick={act((t) => onExplain(t, pos.context))}>
          <SparkleIcon size={15} />
          {tt("Explain")}
        </button>
      )}
      {word ? (
        <button className="label flex h-10 items-center gap-1.5 px-2 text-[10px]" onClick={act(() => onMeaning(word))}>
          <LearningIcon size={16} />
          {tt("Meaning")}
        </button>
      ) : (
        <button className="label flex h-10 items-center gap-1.5 px-2 text-[10px]" onClick={act(onShare)}>
          <ShareIcon size={15} />
          {tt("Share")}
        </button>
      )}
    </div>
  );
}
