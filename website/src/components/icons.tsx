import type { SVGProps } from "react";

// The app's tab icons, copied from stack/src/components/icons.tsx and
// stack-icons.tsx (Review) so the
// website's tab bar looks exactly like the one people will see in the app.

type P = SVGProps<SVGSVGElement> & { size?: number };

const stroke = ({ size = 24, ...p }: P) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinejoin: "round" as const,
  strokeLinecap: "round" as const,
  "aria-hidden": true,
  ...p,
});

export const HomeIcon = (p: P) => (
  <svg {...stroke(p)}>
    <path d="M4 11l8-7 8 7v9h-5v-6H9v6H4z" />
  </svg>
);
export const NewsIcon = (p: P) => (
  <svg {...stroke(p)}>
    <rect x="4" y="5" width="16" height="14" rx="1" />
    <path d="M8 9h8M8 13h8M8 16h5" />
  </svg>
);
export const DiscIcon = (p: P) => (
  <svg {...stroke(p)}>
    <circle cx="12" cy="12" r="8" />
    <circle cx="12" cy="12" r="2" />
  </svg>
);
export const ShelfIcon = (p: P) => (
  <svg {...stroke(p)}>
    <path d="M4 4h4v16H4zM10 4h4v16h-4zM16 6l3-1 2.5 14-3 1z" />
  </svg>
);
export const NoteIcon = (p: P) => (
  <svg {...stroke(p)}>
    <path d="M6 3h9l4 4v14H6z" />
    <path d="M9 12h7M9 16h7" />
  </svg>
);
export const ReviewIcon = (p: P) => (
  <svg {...stroke(p)}>
    <path d="M4 12a8 8 0 0 1 13.7-5.6" />
    <path d="M18 3v4h-4" />
    <path d="M20 12a8 8 0 0 1-13.7 5.6" />
    <path d="M6 21v-4h4" />
    <path d="M12 12h.01" />
  </svg>
);
