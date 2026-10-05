// The small light next to Telegram: green connected, amber
// connected but the service can't be reached right now, red logged out.
export type DotState = "ok" | "unreachable" | "lost";

const COLOR: Record<DotState, string> = {
  ok: "bg-news",
  unreachable: "bg-pdf",
  lost: "bg-music",
};

export function ConnectionDot({ state }: { state: DotState }) {
  return <span aria-hidden className={`inline-block size-[7px] shrink-0 rounded-full ${COLOR[state]}`} />;
}
