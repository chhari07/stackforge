import { Fragment } from "react";

// A translated sentence with **bold** parts (lib/i18n.ts strings are plain text).
export function Rich({ text, bold = "" }: { text: string; bold?: string }) {
  return (
    <>
      {text.split("**").map((part, i) =>
        i % 2 ? (
          <b key={i} className={bold}>
            {part}
          </b>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        ),
      )}
    </>
  );
}
