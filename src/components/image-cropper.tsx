"use client";

import { useEffect, useRef, useState } from "react";
import { cropJpeg } from "@/lib/image";
import { useT } from "@/lib/i18n";
import { Sheet } from "./sheet";

type Point = { x: number; y: number };

/**
 * Frame a photo before it's used: drag to move it, pinch or use the slider to
 * zoom. A round frame for the profile photo, a wide one for the banner.
 * Gives back a JPEG data URL of what's inside the frame.
 */
export function ImageCropper({
  file,
  aspect,
  round = false,
  width,
  title,
  onDone,
  onClose,
}: {
  file: File | null;
  aspect: number; // frame width ÷ height
  round?: boolean;
  width: number; // output width in pixels
  title: string;
  onDone: (dataUrl: string) => void;
  onClose: () => void;
}) {
  return (
    <Sheet open={!!file} onClose={onClose} title={title}>
      {/* Remount per file, so each photo starts centred. */}
      {file && <Frame key={file.name + file.size + file.lastModified} {...{ file, aspect, round, width, onDone, onClose }} />}
    </Sheet>
  );
}

function Frame({
  file,
  aspect,
  round,
  width,
  onDone,
  onClose,
}: {
  file: File;
  aspect: number;
  round: boolean;
  width: number;
  onDone: (dataUrl: string) => void;
  onClose: () => void;
}) {
  const t = useT();
  const box = useRef<HTMLDivElement>(null);
  const [url, setUrl] = useState("");
  const [img, setImg] = useState<{ w: number; h: number } | null>(null);
  const [frameW, setFrameW] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [off, setOff] = useState<Point>({ x: 0, y: 0 });
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const pointers = useRef(new Map<number, Point>());
  const gesture = useRef<{ off: Point; at: Point; zoom: number; dist: number } | null>(null);

  useEffect(() => {
    const u = URL.createObjectURL(file);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setFrameW(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const frameH = frameW / aspect;
  // The photo always covers the frame; zoom 1 = just covers it.
  const base = img ? Math.max(frameW / img.w, frameH / img.h) : 1;
  const scale = base * zoom;
  const clamp = (p: Point, z = zoom): Point => {
    if (!img) return p;
    const maxX = Math.max(0, (img.w * base * z - frameW) / 2);
    const maxY = Math.max(0, (img.h * base * z - frameH) / 2);
    return { x: Math.min(maxX, Math.max(-maxX, p.x)), y: Math.min(maxY, Math.max(-maxY, p.y)) };
  };

  const centre = () => {
    const ps = [...pointers.current.values()];
    return { x: ps.reduce((a, p) => a + p.x, 0) / ps.length, y: ps.reduce((a, p) => a + p.y, 0) / ps.length };
  };
  const spread = () => {
    const [a, b] = [...pointers.current.values()];
    return b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
  };
  const start = () => (gesture.current = { off, at: centre(), zoom, dist: spread() });

  const setZoomTo = (z: number) => {
    const next = Math.min(4, Math.max(1, z));
    setZoom(next);
    setOff((o) => clamp(o, next));
  };

  const save = async () => {
    if (!img) return;
    setBusy(true);
    try {
      // The frame's top-left corner, in the photo's own pixels.
      const w = frameW / scale;
      const h = frameH / scale;
      const x = img.w / 2 - (frameW / 2 + off.x) / scale;
      const y = img.h / 2 - (frameH / 2 + off.y) / scale;
      onDone(await cropJpeg(file, { x, y, w, h }, width, Math.round(width / aspect)));
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div
        ref={box}
        style={{ height: frameH || undefined, aspectRatio: frameW ? undefined : String(aspect) }}
        className="relative w-full touch-none overflow-hidden rounded-2xl bg-black select-none"
        onPointerDown={(e) => {
          (e.target as Element).setPointerCapture(e.pointerId);
          pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
          start();
        }}
        onPointerMove={(e) => {
          if (!pointers.current.has(e.pointerId)) return;
          pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
          const g = gesture.current;
          if (!g) return;
          const c = centre();
          const z = g.dist && pointers.current.size > 1 ? Math.min(4, Math.max(1, (g.zoom * spread()) / g.dist)) : zoom;
          if (z !== zoom) setZoom(z);
          setOff(clamp({ x: g.off.x + c.x - g.at.x, y: g.off.y + c.y - g.at.y }, z));
        }}
        onPointerUp={(e) => {
          pointers.current.delete(e.pointerId);
          if (pointers.current.size) start();
          else gesture.current = null;
        }}
        onPointerCancel={(e) => {
          pointers.current.delete(e.pointerId);
          gesture.current = null;
        }}
        onWheel={(e) => setZoomTo(zoom * (e.deltaY < 0 ? 1.08 : 1 / 1.08))}
      >
        {url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={url}
            alt=""
            draggable={false}
            onLoad={(e) => setImg({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
            onError={() => setFailed(true)}
            style={
              img
                ? {
                    width: img.w * scale,
                    height: img.h * scale,
                    left: frameW / 2 - (img.w * scale) / 2 + off.x,
                    top: frameH / 2 - (img.h * scale) / 2 + off.y,
                  }
                : { opacity: 0 }
            }
            className="pointer-events-none absolute max-w-none"
          />
        )}
        {round && frameH > 0 && (
          // Darkens what's outside the circle.
          <div
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full shadow-[0_0_0_9999px_rgba(0,0,0,.55)] ring-2 ring-white/80"
            style={{ width: frameH - 8, height: frameH - 8 }}
          />
        )}
        {!round && <div aria-hidden className="pointer-events-none absolute inset-0 rounded-2xl ring-2 ring-white/80 ring-inset" />}
      </div>

      {failed ? (
        <p className="text-[14px] text-music-text">{t("That image couldn’t be opened. Try another one.")}</p>
      ) : (
        <p className="label text-center text-[9px] text-muted">{t("Drag to move · pinch or slide to zoom")}</p>
      )}

      <label className="flex items-center gap-3">
        <span className="label text-[10px] text-muted">{t("Zoom")}</span>
        <input
          type="range"
          min={1}
          max={4}
          step={0.01}
          value={zoom}
          onChange={(e) => setZoomTo(Number(e.target.value))}
          className="grow accent-ink"
        />
      </label>

      <div className="grid grid-cols-2 gap-2">
        <button onClick={onClose} className="h-12 rounded-full border border-ink/15 text-[15px] font-semibold">
          {t("Cancel")}
        </button>
        <button
          onClick={save}
          disabled={!img || busy || failed}
          className="h-12 rounded-full bg-ink text-[15px] font-semibold text-on-ink disabled:opacity-40"
        >
          {busy ? t("Saving…") : t("Use this")}
        </button>
      </div>
    </>
  );
}
