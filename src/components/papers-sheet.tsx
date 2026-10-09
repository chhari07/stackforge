"use client";

import { ExternalIcon } from "./icons";
import { Sheet } from "./sheet";
import { useT } from "@/lib/i18n";

// Today's paper, from official sources only: the government's own free news
// and magazines, and each newspaper's own site. Links open in the browser.
type Paper = { name: string; note: string; url: string };

const GROUPS: { title: string; papers: Paper[] }[] = [
  {
    title: "Free · Government of India",
    papers: [
      { name: "PIB", note: "Today’s official press releases", url: "https://pib.gov.in/allRel.aspx" },
      { name: "News On AIR", note: "All India Radio news, English & Hindi", url: "https://www.newsonair.gov.in/" },
      { name: "DD News", note: "Doordarshan news", url: "https://ddnews.gov.in/" },
      {
        name: "Yojana & Kurukshetra",
        note: "Monthly magazines, free PDFs (great for exams)",
        url: "https://www.publicationsdivision.nic.in/",
      },
    ],
  },
  {
    title: "Today’s print edition · on the paper’s site",
    papers: [
      { name: "The Hindu", note: "Today’s paper, page by page", url: "https://www.thehindu.com/todays-paper/" },
      { name: "The Indian Express", note: "Today’s paper", url: "https://indianexpress.com/todays-paper/" },
    ],
  },
  {
    title: "हिंदी ई-पेपर · official e-papers",
    papers: [
      { name: "दैनिक जागरण", note: "Dainik Jagran e-paper", url: "https://epaper.jagran.com/" },
      { name: "दैनिक भास्कर", note: "Dainik Bhaskar e-paper", url: "https://epaper.bhaskar.com/" },
      { name: "अमर उजाला", note: "Amar Ujala e-paper", url: "https://epaper.amarujala.com/" },
      { name: "हिन्दुस्तान", note: "Hindustan e-paper", url: "https://epaper.livehindustan.com/" },
      { name: "नवभारत टाइम्स", note: "Navbharat Times e-paper", url: "https://epaper.navbharattimes.com/" },
      { name: "राजस्थान पत्रिका", note: "Patrika e-paper", url: "https://epaper.patrika.com/" },
    ],
  },
];

export function PapersSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT();
  return (
    <Sheet open={open} onClose={onClose} title="Today’s paper">
      <div className="-mx-5 flex max-h-[65dvh] flex-col gap-5 overflow-y-auto px-5">
        {GROUPS.map((g) => (
          <section key={g.title} className="flex flex-col gap-1.5">
            <h3 className="label text-[10px] text-muted">{t(g.title)}</h3>
            {g.papers.map((p) => (
              <a
                key={p.url}
                href={p.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex min-h-14 items-center gap-3 rounded-2xl bg-card px-4 py-2.5"
              >
                <span className="flex min-w-0 grow flex-col">
                  <span className="truncate text-[15px] font-semibold">{p.name}</span>
                  <span className="truncate text-[12px] text-muted">{t(p.note)}</span>
                </span>
                <ExternalIcon size={16} className="shrink-0 text-muted" />
              </a>
            ))}
          </section>
        ))}
        <p className="text-[12px] leading-relaxed text-muted">
          {t("Some e-papers ask you to sign in, and a few pages may be for subscribers. Each opens on the newspaper’s own site.")}
        </p>
      </div>
    </Sheet>
  );
}
