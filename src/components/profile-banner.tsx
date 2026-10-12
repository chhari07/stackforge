"use client";

import { useId, type ReactNode } from "react";
import { accentOf, type Accent, type BannerStyle } from "@/lib/profile";

// The cover over the profile: your banner photo, or a design in your profile
// colour. `children` sit on top of it (the Edit profile button).
export function ProfileBanner({
  banner,
  design = "blocks",
  accent,
  className = "",
  children,
}: {
  banner?: string;
  design?: BannerStyle;
  accent?: Accent;
  className?: string;
  children?: ReactNode;
}) {
  const colour = accentOf(accent);
  return (
    <div className={`relative overflow-hidden ${banner ? "bg-soft" : colour.bg} ${className}`}>
      {banner ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={banner} alt="" className="absolute inset-0 size-full object-cover" />
      ) : (
        <Pattern design={design} className={colour.text} />
      )}
      {children}
    </div>
  );
}

/** A quiet repeating pattern (or none, for "plain"), in the colour of `className`. */
export function Pattern({ design, className = "" }: { design: BannerStyle; className?: string }) {
  const id = useId().replace(/:/g, "");
  if (design === "plain") return null;
  const tile =
    design === "blocks" ? (
      // Stacked blocks, like the logo.
      <pattern id={id} width="28" height="28" patternUnits="userSpaceOnUse">
        <rect x="3" y="3" width="10" height="10" rx="2" fill="currentColor" />
        <rect x="17" y="17" width="8" height="8" rx="2" fill="currentColor" />
      </pattern>
    ) : design === "lines" ? (
      <pattern id={id} width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(-30)">
        <rect width="5" height="14" fill="currentColor" />
      </pattern>
    ) : design === "dots" ? (
      <pattern id={id} width="16" height="16" patternUnits="userSpaceOnUse">
        <circle cx="4" cy="4" r="2.5" fill="currentColor" />
        <circle cx="12" cy="12" r="2.5" fill="currentColor" />
      </pattern>
    ) : (
      <pattern id={id} width="40" height="16" patternUnits="userSpaceOnUse">
        <path d="M0 8 Q10 0 20 8 T40 8" fill="none" stroke="currentColor" strokeWidth="3" />
      </pattern>
    );
  return (
    <svg aria-hidden className={`absolute inset-0 h-full w-full opacity-20 ${className}`}>
      <defs>{tile}</defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  );
}
