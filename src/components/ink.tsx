"use client";

// Handwriting with a pen or a finger, on PDF pages and sticky notes.
// InkLayer shows saved ink; InkPad draws on top while drawing is on.
// On a tablet with a stylus, only the pen draws and fingers scroll (so a
// resting palm leaves no marks); without one, one finger draws and two scroll.
import { useEffect, useRef, useState, type PointerEvent, type ReactNode, type SVGProps } from "react";
import { hits, round, strokePath, type Stroke } from "@/lib/ink";
import { HighlighterIcon, RedoIcon, UndoIcon } from "./stack-icons";
import { TrashIcon } from "./icons";
import { useT } from "@/lib/i18n";

export type Tool = "pen" | "hl" | "eraser";
export type PenState = { tool: Tool; color: string; hlColor: string; size: 0 | 1 | 2 };

const PEN_COLORS = ["#111111", "#D93025", "#1A73E8", "#188038", "#F29900"];
const HL_COLORS = ["#FFE45C", "#9BE88F", "#FF9ECF", "#8FD3FF"];
const PEN_W = [0.003, 0.0055, 0.009]; // of the area's width
const HL_W = [0.02, 0.032, 0.048];
const PEN_KEY = "stack.ink.pen";
const START: PenState = { tool: "pen", color: PEN_COLORS[0], hlColor: HL_COLORS[0], size: 1 };

// Once a stylus has touched the screen, fingers scroll instead of drawing.
let penSeen = false;

// The last pen, colour and size, remembered on this device.
export function usePen() {
  const [pen, setPen] = useState<PenState>(START);
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(PEN_KEY) ?? "null");
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (saved?.tool) setPen({ ...START, ...saved });
    } catch {}
  }, []);
  const change = (p: PenState) => {
    setPen(p);
    try {
      localStorage.setItem(PEN_KEY, JSON.stringify(p));
    } catch {}
  };
  return [pen, change] as const;
}

// Strokes with undo and redo. `key` changes when the drawing area does (another page).
export function useInk(saved: Stroke[], save: (s: Stroke[]) => void, key: string) {
  const [strokes, setStrokes] = useState(saved);
  const [past, setPast] = useState<Stroke[][]>([]);
  const [future, setFuture] = useState<Stroke[][]>([]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStrokes(saved);
    setPast([]);
    setFuture([]);
    // Only when the area changes, not on every save of it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const apply = (next: Stroke[]) => {
    setStrokes(next);
    save(next);
  };
  return {
    strokes,
    change: (next: Stroke[]) => {
      setPast((p) => [...p.slice(-49), strokes]);
      setFuture([]);
      apply(next);
    },
    undo: () => {
      if (!past.length) return;
      setFuture((f) => [strokes, ...f]);
      apply(past[past.length - 1]);
      setPast((p) => p.slice(0, -1));
    },
    redo: () => {
      if (!future.length) return;
      setPast((p) => [...p, strokes]);
      apply(future[0]);
      setFuture((f) => f.slice(1));
    },
    canUndo: past.length > 0,
    canRedo: future.length > 0,
  };
}

// Saved ink, drawn over whatever is underneath (highlighter below the pen).
export function InkLayer({ strokes, w, h, className = "" }: { strokes?: Stroke[]; w: number; h: number; className?: string }) {
  if (!strokes?.length || !w || !h) return null;
  return (
    <svg aria-hidden width={w} height={h} className={`pointer-events-none absolute inset-0 ${className}`}>
      {[...strokes.filter((s) => s.hl), ...strokes.filter((s) => !s.hl)].map((s, i) => (
        <StrokePath key={i} s={s} w={w} h={h} />
      ))}
    </svg>
  );
}

function StrokePath({ s, w, h }: { s: Stroke; w: number; h: number }) {
  return (
    <path
      d={strokePath(s.p, w, h)}
      fill="none"
      stroke={s.c}
      strokeWidth={Math.max(0.6, s.w * w)}
      strokeLinecap={s.hl ? "butt" : "round"}
      strokeLinejoin="round"
      opacity={s.hl ? 0.38 : 1}
      style={s.hl ? { mixBlendMode: "multiply" } : undefined}
    />
  );
}

// The drawing surface. It shows the strokes itself while drawing and hands
// back the new list after each stroke or erase. `widthScale` makes strokes
// thicker on small areas such as sticky notes.
export function InkPad({
  strokes,
  onChange,
  w,
  h,
  pen,
  widthScale = 1,
  onPan,
}: {
  strokes: Stroke[];
  onChange: (s: Stroke[]) => void;
  w: number;
  h: number;
  pen: PenState;
  widthScale?: number;
  onPan?: (dx: number, dy: number) => void; // fingers scrolling the page
}) {
  const box = useRef<HTMLDivElement>(null);
  const live = useRef<SVGPathElement>(null);
  const [local, setLocal] = useState(strokes);
  const pointers = useRef(new Map<number, { x: number; y: number; draws: boolean }>());
  const drawing = useRef<{ id: number; pts: number[]; erased: boolean } | null>(null);
  const work = useRef(strokes); // the list being changed during this gesture

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLocal(strokes);
    work.current = strokes;
  }, [strokes]);

  const hl = pen.tool === "hl";
  const color = hl ? pen.hlColor : pen.color;
  const width = (hl ? HL_W : PEN_W)[pen.size] * widthScale;

  const at = (e: { clientX: number; clientY: number }) => {
    const r = box.current!.getBoundingClientRect();
    return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height };
  };

  const erase = (x: number, y: number) => {
    const left = work.current.filter((s) => !hits(s, x * w, y * h, 10, w, h));
    if (left.length === work.current.length) return;
    work.current = left;
    setLocal(left);
    if (drawing.current) drawing.current.erased = true;
  };

  const cancelStroke = () => {
    drawing.current = null;
    live.current?.setAttribute("d", "");
  };

  const onDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "pen") penSeen = true;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    const touch = e.pointerType === "touch";
    // With a stylus, fingers (and a resting palm) only scroll and never cancel the pen.
    // Without one, a second finger turns a one-finger stroke into a two-finger scroll.
    const second = touch && !penSeen && pointers.current.size > 0;
    if (second && drawing.current) {
      if (drawing.current.erased) onChange(work.current);
      cancelStroke();
      for (const q of pointers.current.values()) q.draws = false;
    }
    const draws = !(touch && penSeen) && !second && !drawing.current;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY, draws });
    e.currentTarget.setPointerCapture(e.pointerId);
    if (!draws) return;
    const p = at(e);
    drawing.current = { id: e.pointerId, pts: [round(p.x), round(p.y)], erased: false };
    if (pen.tool === "eraser") erase(p.x, p.y);
    else live.current?.setAttribute("d", strokePath(drawing.current.pts, w, h));
  };

  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    const p = pointers.current.get(e.pointerId);
    if (!p) return;
    const d = drawing.current;
    if (!p.draws || !d || d.id !== e.pointerId) {
      // Fingers scroll the page (shared between them when there are two).
      const n = Math.max(1, [...pointers.current.values()].filter((q) => !q.draws).length);
      onPan?.((e.clientX - p.x) / n, (e.clientY - p.y) / n);
      p.x = e.clientX;
      p.y = e.clientY;
      return;
    }
    // A pen sends many more points than are painted; use them all for a smooth line.
    const events = e.nativeEvent.getCoalescedEvents?.() ?? [e.nativeEvent];
    for (const ev of events.length ? events : [e.nativeEvent]) {
      const q = at(ev);
      if (pen.tool === "eraser") {
        erase(q.x, q.y);
        continue;
      }
      const lx = d.pts[d.pts.length - 2];
      const ly = d.pts[d.pts.length - 1];
      if (Math.hypot((q.x - lx) * w, (q.y - ly) * h) < 1.2) continue;
      d.pts.push(round(q.x), round(q.y));
    }
    if (pen.tool !== "eraser") live.current?.setAttribute("d", strokePath(d.pts, w, h));
  };

  const onUp = (e: PointerEvent<HTMLDivElement>) => {
    pointers.current.delete(e.pointerId);
    const d = drawing.current;
    if (!d || d.id !== e.pointerId) return;
    cancelStroke();
    if (pen.tool === "eraser") {
      if (d.erased) onChange(work.current);
      return;
    }
    const s: Stroke = { c: color, w: round(width), p: d.pts, ...(hl ? { hl: true } : {}) };
    work.current = [...work.current, s];
    setLocal(work.current);
    onChange(work.current);
  };

  return (
    <div
      ref={box}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      className={`absolute inset-0 z-[3] ${pen.tool === "eraser" ? "cursor-cell" : "cursor-crosshair"}`}
      style={{ touchAction: "none" }}
    >
      <InkLayer strokes={local} w={w} h={h} />
      <svg aria-hidden width={w} height={h} className="pointer-events-none absolute inset-0">
        <path
          ref={live}
          fill="none"
          stroke={color}
          strokeWidth={Math.max(0.6, width * w)}
          strokeLinecap={hl ? "butt" : "round"}
          strokeLinejoin="round"
          opacity={hl ? 0.38 : 1}
        />
      </svg>
    </div>
  );
}

const glyph = ({ size = 20, ...p }: SVGProps<SVGSVGElement> & { size?: number }) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
  ...p,
});
export const PenIcon = (p: SVGProps<SVGSVGElement> & { size?: number }) => (
  <svg {...glyph(p)}>
    <path d="M4 20l1-4L16 5a2.1 2.1 0 0 1 3 3L8 19z" />
    <path d="M14 7l3 3" />
    <path d="M4 20h5" />
  </svg>
);
const EraserIcon = (p: SVGProps<SVGSVGElement> & { size?: number }) => (
  <svg {...glyph(p)}>
    <path d="M8 20l-4-4a1.4 1.4 0 0 1 0-2L14 4a1.4 1.4 0 0 1 2 0l4 4a1.4 1.4 0 0 1 0 2L10 20z" />
    <path d="M8 20h12" />
    <path d="M9 9l6 6" />
  </svg>
);

function ToolButton({ label, on, onClick, children, disabled }: { label: string; on?: boolean; onClick: () => void; children: ReactNode; disabled?: boolean }) {
  const t = useT();
  return (
    <button
      aria-label={t(label)}
      title={t(label)}
      aria-pressed={on}
      disabled={disabled}
      onClick={onClick}
      className={`flex size-10 shrink-0 items-center justify-center rounded-full disabled:opacity-30 ${on ? "bg-on-ink text-ink" : ""}`}
    >
      {children}
    </button>
  );
}

// Pen, highlighter, eraser, colours, size, undo/redo. `onDone` adds a Done
// button (the PDF reader); `highlighter` is off for sticky notes.
export function InkToolbar({
  pen,
  onPen,
  ink,
  onClear,
  onDone,
  highlighter = true,
  className = "",
}: {
  pen: PenState;
  onPen: (p: PenState) => void;
  ink: { undo: () => void; redo: () => void; canUndo: boolean; canRedo: boolean };
  onClear?: () => void;
  onDone?: () => void;
  highlighter?: boolean;
  className?: string;
}) {
  const t = useT();
  const hl = pen.tool === "hl";
  const colors = hl ? HL_COLORS : PEN_COLORS;
  const current = hl ? pen.hlColor : pen.color;
  return (
    <div role="toolbar" aria-label={t("Drawing tools")} className={`flex flex-col gap-1.5 rounded-[22px] bg-ink p-1.5 text-on-ink ${className}`}>
      <div className="flex items-center gap-0.5">
        <ToolButton label="Pen" on={pen.tool === "pen"} onClick={() => onPen({ ...pen, tool: "pen" })}>
          <PenIcon />
        </ToolButton>
        {highlighter && (
          <ToolButton label="Highlighter" on={hl} onClick={() => onPen({ ...pen, tool: "hl" })}>
            <HighlighterIcon size={20} />
          </ToolButton>
        )}
        <ToolButton label="Eraser" on={pen.tool === "eraser"} onClick={() => onPen({ ...pen, tool: "eraser" })}>
          <EraserIcon />
        </ToolButton>
        <span className="mx-1 h-6 w-px bg-on-ink/20" />
        <ToolButton label="Undo" disabled={!ink.canUndo} onClick={ink.undo}>
          <UndoIcon size={19} />
        </ToolButton>
        <ToolButton label="Redo" disabled={!ink.canRedo} onClick={ink.redo}>
          <RedoIcon size={19} />
        </ToolButton>
        {onClear && (
          <ToolButton label="Clear all ink" onClick={onClear}>
            <TrashIcon size={18} />
          </ToolButton>
        )}
        {onDone && (
          <button onClick={onDone} className="ml-auto h-10 rounded-full bg-on-ink px-4 text-[14px] font-semibold text-ink">
            {t("Done")}
          </button>
        )}
      </div>
      {pen.tool !== "eraser" && (
        <div className="flex items-center gap-1 px-1 pb-0.5">
          {colors.map((c) => (
            <button
              key={c}
              aria-label={t("Colour {c}", { c })}
              aria-pressed={current === c}
              onClick={() => onPen(hl ? { ...pen, hlColor: c } : { ...pen, color: c })}
              className={`flex size-9 shrink-0 items-center justify-center rounded-full ${current === c ? "ring-2 ring-on-ink" : ""}`}
            >
              <span className="size-6 rounded-full border border-white/40" style={{ background: c }} />
            </button>
          ))}
          <span className="mx-1 h-6 w-px bg-on-ink/20" />
          {([0, 1, 2] as const).map((s) => (
            <button
              key={s}
              aria-label={t(["Thin", "Medium", "Thick"][s])}
              aria-pressed={pen.size === s}
              onClick={() => onPen({ ...pen, size: s })}
              className={`flex size-9 shrink-0 items-center justify-center rounded-full ${pen.size === s ? "bg-on-ink/20" : ""}`}
            >
              <span className="rounded-full bg-on-ink" style={{ width: 4 + s * 4, height: 4 + s * 4 }} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
