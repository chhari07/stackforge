"use client";

import { useEffect, useState } from "react";
import {
  CARD_SIZES,
  CARD_THEMES,
  cardAsText,
  cardPicture,
  drawQuoteCard,
  shareCard,
  sharePlainText,
  type CardSize,
  type CardText,
  type CardTheme,
} from "@/lib/quote-card";
import { Chips, Sheet } from "./sheet";
import { ShareIcon } from "./icons";
import { useToast } from "./toast";
import { useT } from "@/lib/i18n";

// "Share": a highlight, word, note or news story as a picture, in a colour you
// pick, with plain text (a story's link) as the other choice. `onShareText`
// replaces what the text button sends.
export function QuoteCardSheet({
  card,
  onClose,
  onShareText,
}: {
  card: CardText | null;
  onClose: () => void;
  onShareText?: () => void;
}) {
  const t = useT();
  const toast = useToast();
  const [theme, setTheme] = useState<CardTheme>("paper");
  const [size, setSize] = useState<CardSize>("portrait");
  const [drawn, setDrawn] = useState<{ blob: Blob; url: string } | null>(null);
  // The card's content as one value, so the picture is only redrawn when it changes.
  const key = card ? JSON.stringify(card) : null;

  useEffect(() => {
    if (!key) return;
    let alive = true;
    let url = "";
    const card: CardText = JSON.parse(key);
    const show = async (c: CardText) => {
      const blob = await drawQuoteCard(c, theme, size);
      if (!alive) return;
      if (url) URL.revokeObjectURL(url);
      url = URL.createObjectURL(blob);
      setDrawn({ blob, url });
    };
    // A story's picture can take a while: the card shows without it until it's here.
    const image = card.image;
    (image
      ? show({ ...card, image: undefined })
          .then(() => cardPicture(image))
          .then((picture) => (picture && alive ? show(card) : undefined))
      : show(card)
    ).catch(() => alive && toast({ text: t("Couldn’t make the card") }));
    return () => {
      alive = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [key, theme, size, toast, t]);

  const share = async () => {
    if (!drawn) return;
    try {
      const caption = card?.link ? cardAsText(card) : undefined;
      if ((await shareCard(drawn.blob, caption)) === "saved") toast({ text: t("Card saved as a picture") });
    } catch (e) {
      // Closing the share sheet without picking an app isn't a failure.
      if ((e as Error)?.name !== "AbortError") toast({ text: t("Couldn’t share the card") });
    }
  };

  const shareText = () => {
    if (onShareText) return onShareText();
    if (!card) return;
    onClose();
    sharePlainText(cardAsText(card))
      .then((sent) => !sent && toast({ text: t("Copied") }))
      .catch(() => {});
  };

  return (
    <Sheet open={card !== null} onClose={onClose} title="Share">
      <div className="flex h-[312px] items-center justify-center">
        {drawn ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={drawn.url}
            alt={t("Preview of the card")}
            className="max-h-full max-w-full rounded-xl shadow-[0_8px_24px_rgba(0,0,0,.12)]"
          />
        ) : (
          <span className="label text-[10px] text-muted">{t("Drawing…")}</span>
        )}
      </div>
      <Chips label="Card colour" options={CARD_THEMES} value={theme} onChange={setTheme} />
      <Chips label="Card shape" options={CARD_SIZES} value={size} onChange={setSize} />
      <button
        onClick={share}
        disabled={!drawn}
        className="flex h-12 items-center justify-center gap-2 rounded-full bg-ink text-[15px] font-semibold text-on-ink disabled:opacity-50"
      >
        <ShareIcon size={18} /> {t("Share as a card")}
      </button>
      <button onClick={shareText} className="h-11 rounded-full border border-ink/20 text-[14px] font-semibold">
        {card?.link ? t("Share the link") : t("Share as text")}
      </button>
    </Sheet>
  );
}
