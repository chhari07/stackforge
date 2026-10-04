"use client";

import { useState } from "react";
import { HeadphonesIcon } from "./stack-icons";
import { useToast } from "./toast";
import { canListen, listen, stopListening } from "@/lib/listen";
import { isNative } from "@/lib/platform";
import { useT } from "@/lib/i18n";

// "Listen": reads the article or PDF aloud (lib/listen.ts).
export function ListenButton({
  getText,
  title,
  source,
  label = "Listen to this",
}: {
  getText: () => Promise<string> | string;
  title: string;
  source: string;
  label?: string;
}) {
  const t = useT();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [speaking, setSpeaking] = useState(false); // website only
  if (!canListen()) return null;

  const start = async () => {
    if (speaking) {
      stopListening();
      setSpeaking(false);
      return;
    }
    setBusy(true);
    try {
      const text = (await getText()).trim();
      if (!text) throw new Error(t("Nothing to read here"));
      await listen({ title, source, text });
      if (isNative()) {
        toast({ text: t("Reading aloud · controls are in the player and notification"), href: "/music" });
      } else setSpeaking(true);
    } catch (e) {
      toast({ text: (e as Error).message || t("Couldn't read this aloud") });
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      aria-label={speaking ? t("Stop reading aloud") : t(label)}
      aria-pressed={speaking}
      aria-busy={busy}
      onClick={start}
      disabled={busy}
      className={`flex size-11 items-center justify-center ${busy ? "animate-pulse opacity-60" : ""} ${speaking ? "text-news" : ""}`}
    >
      <HeadphonesIcon size={20} />
    </button>
  );
}
