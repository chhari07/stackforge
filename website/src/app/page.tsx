import { Logo } from "@/components/logo";
import { PhoneShot } from "@/components/phone-shot";
import { SignupForm } from "@/components/signup-form";
import { Footer } from "@/components/footer";
import { TabNav, type TabId } from "@/components/tab-nav";
import { SITE } from "@/lib/site";

// One page, in the same order people meet things in the app, so nothing on
// the site is new to them when they open Stack:
// welcome (hero) → first minute (the app's own onboarding) → the five tabs,
// in tab-bar order, with real screens → Hindi and Indian news → focus and
// music → local first → join → questions.
// Names and button labels are the app's own words.

// Staggered load delays, as classes so no inline styles are needed.
const LETTER_DELAYS = ["[animation-delay:350ms]", "[animation-delay:420ms]", "[animation-delay:490ms]", "[animation-delay:560ms]", "[animation-delay:630ms]"];

// Each tab's title in the type the app uses for that screen's own header:
// condensed caps for Today, News and Music, the serif for Library and Notes.
const HEADINGS = {
  display: "display text-6xl sm:text-7xl",
  serif: "font-serif text-6xl font-medium leading-none tracking-[-0.01em] sm:text-7xl",
};

// The app's first launch (stack/src/app/welcome/page.tsx), step by step.
const FIRST_MINUTE = [
  { n: "01", title: "Three cards", body: "Save from any app. Select a line, and it becomes a note. Every morning, three come back. Or tap Skip." },
  { n: "02", title: "What are you reading for?", body: "Exams (GATE, JEE, NEET, UPSC), work and skills, staying informed, or just for you. Stack sets up Today and your news around it." },
  { n: "03", title: "Try it", body: "A two-minute article opens with one line already highlighted. Select one more line and tap Highlight. Tomorrow morning, both come back." },
  { n: "04", title: "Make it yours", body: "Add your name and a photo, so Stack knows what to call you. You can skip this and do it later." },
  { n: "05", title: "Keep your notes safe?", body: "Only now does Stack offer an account, to back up and sync your notes. “Continue without an account” works just as well." },
];

// The five tabs, in the app's order. The ids match the tab bar (tab-nav.tsx).
const TOUR: {
  id: TabId;
  title: string;
  lead: string;
  points: string[];
  text: string;
  dot: string;
  heading: keyof typeof HEADINGS;
  shot: { light: string; dark?: string; alt: string };
}[] = [
  {
    id: "today",
    title: "TODAY",
    lead: "Every day starts with what you highlighted, then what you’re reading, then the news.",
    points: [
      "Daily review first: “3 things you highlighted”",
      "Pick up where you left off: the PDFs and books you have open",
      "A focus card to start a timer or Pomodoro",
      "This week: time read, articles finished and PDF pages, a bar for each day",
      "Reading for exams or work? Your reading comes before the news",
    ],
    text: "text-music-text",
    dot: "bg-music",
    heading: "display",
    shot: { light: "/screens/today-light.png", dark: "/screens/today-dark.png", alt: "The Today tab with the daily review card, the focus card, this week and the PDFs in progress" },
  },
  {
    id: "library",
    title: "BOOKS",
    lead: "Your PDFs, books and saved articles on coloured shelves. Share anything to Stack and it lands here.",
    points: [
      "PDFs and EPUB books, with highlights, sticky notes, handwriting and reading time left",
      "Share from Chrome, WhatsApp or Files: a “Saved to Stack” card pops up",
      "Import PDFs from Telegram: forward them to your bot, then pick which to add",
      "Every PDF on your phone, found for you, ready to add",
      "Listen: articles and PDFs read aloud, with the same controls as music",
    ],
    text: "text-pdf-deep",
    dot: "bg-pdf",
    heading: "serif",
    shot: { light: "/screens/library-light.png", dark: "/screens/library-dark.png", alt: "The Library tab with coloured shelves of PDFs and Import from Telegram" },
  },
  {
    id: "review",
    title: "RECALL",
    lead: "Every highlight comes back the next morning. A few seconds each, and what you read stays with you.",
    points: [
      "Three a day, picked from what you highlighted",
      "“Got it” pushes it out: 3 days, then longer each time. “Show again soon” brings it back tomorrow",
      "Words you looked up with Meaning come back too, with “Show meaning”",
      "Open where you read it, or share it as a card",
      "A streak for each day you finish the review",
    ],
    text: "text-news-text",
    dot: "bg-news",
    heading: "display",
    shot: { light: "/screens/review-light.png", dark: "/screens/review-dark.png", alt: "The Review tab showing a highlight to recall, with Got it and Show again soon" },
  },
  {
    id: "notes",
    title: "Notes",
    lead: "Every highlight becomes a note that remembers where it came from, next to the notes you write yourself.",
    points: [
      "Each highlight shows its source: the article, or the PDF and page",
      "Titles, checklists, colours, tags, pins and reminders",
      "One search across notes, highlights, articles and PDFs",
      "Export to Markdown for Obsidian, Notion or any editor",
    ],
    text: "text-ink",
    dot: "bg-ink",
    heading: "serif",
    shot: { light: "/screens/notes-light.png", dark: "/screens/notes-dark.png", alt: "The Notes tab showing saved article highlights" },
  },
  {
    id: "news",
    title: "NEWS",
    lead: "12 topics from trusted sources, video news, and any site or RSS feed you add under My feeds.",
    points: [
      "Flash cards or a list, with the date and time on every story",
      "Read any story in Hindi, or in 19 more languages, with one tap",
      "Today’s paper: free official sources, from PIB and DD News to Hindi e-papers",
      "Save a story to read it in a clean reader mode, even offline",
      "Breaking-news alerts for the topics you pick, at most one an hour",
    ],
    text: "text-news-text",
    dot: "bg-news",
    heading: "display",
    shot: { light: "/screens/news-light.png", dark: "/screens/news-dark.png", alt: "The News tab with today’s posts" },
  },
];

const FAQ = [
  {
    q: "What is a soft launch?",
    a: "Stack is finished enough to use every day, and we're opening it to a small group first. Testers get the Android app early through Google Play's closed test, and their feedback shapes the public release.",
  },
  {
    q: "How do I install the APK?",
    a: "Open the download link on your Android phone, tap the download icon in Google Drive, then open the file. If Android asks, allow your browser or Files app to install unknown apps, then tap Install. When Stack reaches the Play Store, it will update from there.",
  },
  { q: "Is it free?", a: "Yes. Stack is free and open source. Testers will also get Stack Plus free for a year when it arrives." },
  { q: "Do I need an account?", a: "No. Stack works fully offline on your phone. Signing in is only for syncing between devices." },
  {
    q: "Can Stack read to me?",
    a: "Yes. Tap the headphones on any article or PDF and Stack reads it aloud with your phone’s own voice, with play, pause, speed and a sleep timer in the notification.",
  },
  {
    q: "Can I get my notes out?",
    a: "Anytime. Export your notes and highlights to Markdown (each with a link to where you read it), or save a full backup file from Settings.",
  },
  {
    q: "Is Stack in Hindi?",
    a: "Yes. Settings → Language switches the whole app to Hindi: every menu, button and message. Your notes, books and news stay in the language they’re written in.",
  },
  {
    q: "Can it translate the news?",
    a: "Yes. Open any story and tap हिंदी under “Read in”, or pick from 19 more languages, including Bengali, Marathi, Tamil, Telugu, Urdu, Spanish and Japanese. Tap “English (original)” to switch back.",
  },
  {
    q: "Where do the newspapers come from?",
    a: "Today’s paper only links to official, free sources: PIB, News On AIR, DD News, Yojana and Kurukshetra, today’s print editions of The Hindu and The Indian Express, and the Hindi papers’ own e-paper sites. Stack never copies anyone’s paper.",
  },
  { q: "Can I turn AI off?", a: "Yes. Stack AI is optional, asks before sending anything, and one switch in Settings turns it off completely." },
  {
    q: "Can I import PDFs from Telegram?",
    a: "Yes. Make a free bot with Telegram’s @BotFather, connect it in Library, forward PDFs to it and pick which ones to add (up to 20 MB each).",
  },
  {
    q: "I have an iPhone. Can I join?",
    a: "There's no iPhone app yet, but Stack also runs in the browser. Join with launch news only and we'll tell you when the web version opens.",
  },
  {
    q: "What does the test ask of me?",
    a: "Install the app from the invite link, stay opted in for 14 days, and use it for a few minutes on some of those days. We'll send one short feedback form.",
  },
];

export default function Home() {
  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-ink focus:px-4 focus:py-2 focus:text-on-ink"
      >
        Skip to content
      </a>

      <header className="sticky top-0 z-40 border-b border-line bg-paper/85 backdrop-blur">
        {/* Reading progress: fills as you scroll down the story */}
        <div className="progress absolute inset-x-0 bottom-[-1px] h-[2px] origin-left bg-ink" aria-hidden="true" />
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <a href="#main" className="flex items-center gap-2" aria-label="Stack, back to top">
            <Logo size={28} />
            <span className="display text-2xl">STACK</span>
          </a>
          <a href={SITE.apk} target="_blank" rel="noopener noreferrer" className="rounded-full bg-ink px-4 py-2.5 text-sm font-semibold text-on-ink transition hover:opacity-90">
            Download<span className="max-sm:hidden"> the app</span>
          </a>
        </div>
      </header>

      <main id="main" className="scroll-mt-20 overflow-x-clip">
        <Hero />
        <Problem />
        <FirstMinute />
        <Tour />
        <ForIndia />
        <FocusMusic />
        <LocalFirst />
        <Join />
        <Questions />
      </main>

      <Footer />
    </>
  );
}

function Hero() {
  return (
    <section className="relative">
      {/* Soft colour behind the phone: the four app colours, blurred */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute right-[-10%] top-[8%] size-[28rem] rounded-full bg-pdf-tint opacity-70 blur-3xl" />
        <div className="absolute right-[18%] top-[45%] size-[20rem] rounded-full bg-news-tint opacity-70 blur-3xl" />
        <div className="absolute left-[-8%] top-[60%] size-[18rem] rounded-full bg-blue-tint opacity-50 blur-3xl" />
      </div>

      <div className="mx-auto grid min-h-[calc(100dvh-4rem)] max-w-6xl items-center gap-14 px-4 py-14 sm:px-6 md:grid-cols-[1.15fr_1fr] md:py-10">
        <div>
          <p className="rise label inline-flex items-center gap-2 rounded-full border border-rule bg-card/60 px-3 py-1.5 text-xs text-muted">
            <span className="relative flex size-2" aria-hidden="true">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-news opacity-60 motion-reduce:animate-none" />
              <span className="relative inline-flex size-2 rounded-full bg-news" />
            </span>
            Soft launch · Closed test open
          </p>

          <h1 className="mt-8">
            <span className="flex items-end gap-3 sm:gap-5">
              <Logo size={116} animate className="shrink-0 max-sm:size-[70px]" />
              <span className="letters display whitespace-nowrap text-[5.6rem] sm:text-[8.5rem] lg:text-[10rem]" aria-label="STACK">
                {"STACK".split("").map((l, i) => (
                  <span key={i} aria-hidden="true">
                    <span className={LETTER_DELAYS[i]}>{l}</span>
                  </span>
                ))}
              </span>
            </span>
            <span className="rise mt-7 block text-balance font-serif text-4xl italic leading-tight [animation-delay:750ms] sm:text-5xl">
              {SITE.tagline}
            </span>
          </h1>

          <p className="rise mt-6 max-w-xl text-lg text-prose [animation-delay:900ms] sm:text-xl">
            <mark className="marker font-semibold">Highlight anything. Stack brings it back.</mark> Save an article or a
            PDF, select the lines that matter, and every morning three of them come back. Save → Highlight → Remember.
          </p>

          <div className="rise mt-9 flex flex-wrap items-center gap-3 [animation-delay:1050ms]">
            <a href={SITE.apk} target="_blank" rel="noopener noreferrer" className="group inline-flex h-14 items-center gap-2 rounded-full bg-ink px-7 text-[15px] font-semibold text-on-ink shadow-[0_10px_28px_rgba(0,0,0,.18)] transition hover:opacity-90">
              Download for Android
              <span aria-hidden="true" className="transition group-hover:translate-y-0.5">↓</span>
            </a>
            <a href="#join" className="inline-flex h-14 items-center rounded-full border border-ink/15 bg-card px-7 text-[15px] font-semibold transition hover:border-ink">
              Join the soft launch
            </a>
            <a href="#first-minute" className="inline-flex h-14 items-center rounded-full border border-ink/15 bg-card px-7 text-[15px] font-semibold transition hover:border-ink">
              See the app
            </a>
          </div>

          <ul className="rise label mt-8 flex flex-wrap gap-2 text-[11px] [animation-delay:1200ms]">
            {["Free", "Open source", "Works offline", "No ads", "हिंदी में भी"].map((t, i) => (
              <li key={t} className={`rounded-full px-3.5 py-2 ${i === 0 ? "bg-ink text-on-ink" : "border border-ink/15 text-ink"}`}>
                {t}
              </li>
            ))}
          </ul>
        </div>

        {/* The phone with little cards from the app floating around it */}
        <div className="relative mx-auto w-full max-w-[290px] py-10 sm:max-w-[310px]">
          <PhoneShot
            light="/screens/today-light.png"
            dark="/screens/today-dark.png"
            alt="Stack's Today screen with the top story, PDFs in progress and recent notes"
            priority
            className="phone-in"
          />

          {/* A highlight, as the app's note cards show it (stack/src/components/note-card.tsx) */}
          <div
            aria-hidden="true"
            className="float absolute -left-16 top-[14%] w-60 rounded-[14px] bg-card px-4 py-3.5 shadow-[0_18px_40px_rgb(0_0_0/0.14)] [animation-delay:1400ms,2.9s] max-sm:-left-6 max-sm:w-52"
          >
            <span className="label inline-block rounded-full border border-ink/15 px-2 py-0.5 text-[9px] text-pdf-deep">Highlight · PDF p. 1</span>
            <p className="mt-2 font-serif text-[17px] italic leading-snug">
              “<span className="bg-pdf/40">Signifiers tell you where the action should happen.</span>”
            </p>
          </div>

          <div
            aria-hidden="true"
            className="float absolute -right-12 top-[4%] flex items-center gap-2 rounded-full bg-news px-3.5 py-2 text-sm font-semibold text-white shadow-lg [animation-delay:1650ms,3.2s] max-sm:-right-3"
          >
            <span className="grid size-5 place-items-center rounded-full bg-white/25 text-xs">✓</span>
            Saved to Stack
          </div>

          {/* The app's music bar (stack/src/components/mini-player.tsx): a slim pill */}
          <div
            aria-hidden="true"
            className="float absolute -right-14 bottom-[12%] flex h-[46px] w-60 items-center gap-2.5 rounded-full bg-card pr-1.5 pl-3 shadow-[0_18px_40px_rgb(0_0_0/0.16)] [animation-delay:1900ms,3.5s] max-sm:-right-4 max-sm:w-52"
          >
            <span className="size-[22px] shrink-0 rounded-[5px] bg-music" />
            <span className="min-w-0 grow truncate text-[13px] font-semibold">Deep Work</span>
            <span className="grid size-9 shrink-0 place-items-center">
              <span className="flex gap-[3px]">
                <span className="h-3 w-[3px] rounded-sm bg-ink" />
                <span className="h-3 w-[3px] rounded-sm bg-ink" />
              </span>
            </span>
          </div>
        </div>
      </div>

      <a href="#problem" className="rise absolute bottom-4 left-1/2 hidden -translate-x-1/2 flex-col items-center gap-2 [animation-delay:1600ms] md:flex" aria-label="Scroll to the story">
        <span className="label text-[10px] text-muted">Scroll</span>
        <span className="h-10 w-px overflow-hidden bg-rule">
          <span className="cue block h-full w-full bg-ink" />
        </span>
      </a>
    </section>
  );
}

function Problem() {
  return (
    <section id="problem" className="scroll-mt-16 border-y border-line bg-paper-2">
      <div className="reveal mx-auto max-w-4xl px-4 py-20 text-center sm:px-6 sm:py-28">
        <p className="label text-xs text-muted">The problem</p>
        <p className="mt-5 font-serif text-3xl italic leading-snug sm:text-5xl">
          You read a lot. A week later, you remember almost none of it.
        </p>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-muted">
          Bookmarks pile up and highlights stay buried. Stack is built around one habit: keep the lines that matter,
          and see them again before you forget them.
        </p>
      </div>
    </section>
  );
}

function FirstMinute() {
  return (
    <section id="first-minute" className="scroll-mt-16 mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
      <div className="grid items-center gap-12 md:grid-cols-[1fr_240px]">
        <div className="reveal">
          <p className="label text-xs text-muted">When you open the app</p>
          <h2 className="display mt-3 text-6xl sm:text-8xl">YOUR FIRST MINUTE</h2>
          <p className="mt-5 max-w-2xl text-lg text-prose">
            The same five steps you’ll see on your phone, in the same order. You make your first highlight before
            Stack asks for anything.
          </p>
        </div>
        <div className="reveal-phone mx-auto w-full max-w-[220px]">
          <PhoneShot light="/screens/welcome-light.png" dark="/screens/welcome-dark.png" alt="Stack’s first screen: Stack makes you remember what you read, with the first of three cards, Save from any app" />
        </div>
      </div>
      <ol className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {FIRST_MINUTE.map((s, i) => (
          <li key={s.n} className="reveal relative rounded-2xl bg-card p-6 shadow-[0_8px_24px_rgba(0,0,0,.05)]">
            <p className="label text-[11px] font-medium text-muted">Step {s.n}</p>
            <h3 className="mt-8 text-xl font-extrabold tracking-tight">{s.title}</h3>
            <p className="mt-2 text-muted">{s.body}</p>
            {i < FIRST_MINUTE.length - 1 && (
              <span aria-hidden="true" className="label absolute -right-3 top-1/2 z-10 hidden size-6 -translate-y-1/2 place-items-center rounded-full bg-ink text-[11px] text-on-ink lg:grid">
                →
              </span>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}

function Tour() {
  return (
    <section id="tour" aria-labelledby="tour-title" className="border-y border-line bg-paper-2">
      <div className="mx-auto max-w-6xl px-4 pt-20 sm:px-6 sm:pt-28">
        <div className="reveal">
          <p className="label text-xs text-muted">Inside the app</p>
          <h2 id="tour-title" className="display mt-3 text-6xl sm:text-8xl">FIVE TABS</h2>
          <p className="mt-5 max-w-2xl text-lg text-prose">
            Stack has the same five tabs at the bottom of every screen: the loop first (Today, Library, Review,
            Notes), the news last. Here’s what’s in each one, in the same order.
          </p>
        </div>
      </div>

      {/* Phones: the app's floating tab pill, while the tour is on screen. */}
      <div className="md:hidden">
        <TabNav layout="pill" />
      </div>

      <div className="mx-auto grid max-w-6xl gap-10 px-4 pb-20 sm:px-6 sm:pb-28 md:mt-12 md:grid-cols-[88px_1fr]">
        {/* Tablets and computers: the app's tab bar, standing up on the left. */}
        <div className="hidden md:block">
          <div className="sticky top-28">
            <TabNav layout="rail" />
          </div>
        </div>

        <div>
          {TOUR.map((t, i) => (
            <article
              key={t.id}
              id={`tab-${t.id}`}
              className="grid scroll-mt-24 items-center gap-10 border-b border-rule py-16 first:pt-6 last:border-0 md:scroll-mt-24 md:grid-cols-[1fr_260px] md:gap-16"
            >
              <div className="reveal">
                <p className={`label text-[11px] font-medium ${t.text}`}>
                  0{i + 1} — {t.id}
                </p>
                <h3 className={`mt-4 ${HEADINGS[t.heading]}`}>{t.title}</h3>
                <p className="mt-5 max-w-lg text-lg text-prose">{t.lead}</p>
                <ul className="mt-6 grid max-w-lg divide-y divide-line rounded-2xl bg-card px-4 shadow-[0_8px_24px_rgba(0,0,0,.05)]">
                  {t.points.map((p) => (
                    <li key={p} className="flex gap-3 py-3 text-prose">
                      <span className={`mt-2 size-2 shrink-0 rounded-full ${t.dot}`} aria-hidden="true" />
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="reveal-phone mx-auto w-full max-w-[240px]">
                <PhoneShot light={t.shot.light} dark={t.shot.dark} alt={t.shot.alt} />
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

// Made for India: the whole app in Hindi, any story translated, and today's
// paper from official free sources. Screens from the app in Hindi.
function ForIndia() {
  const shots = [
    { light: "/screens/hindi-light.png", dark: "/screens/hindi-dark.png", alt: "Stack’s Today screen in Hindi", label: "Settings → Language → हिंदी" },
    { light: "/screens/translate-light.png", dark: "/screens/translate-dark.png", alt: "A news story translated into Hindi in the reader", label: "Read in: हिंदी" },
    { light: "/screens/paper-light.png", dark: "/screens/paper-dark.png", alt: "The Today’s paper sheet with PIB, News On AIR, DD News and Hindi e-papers", label: "News → Today’s paper" },
  ];
  return (
    <section id="india" className="scroll-mt-16 mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
      <div className="reveal grid gap-8 md:grid-cols-[1fr_1fr] md:items-end">
        <div>
          <p className="label text-xs text-muted">Made in India, for India</p>
          {/* Devanagari needs normal letter-spacing and room for its vowel signs. */}
          <h2 lang="hi" className="mt-4 text-6xl leading-[1.25] font-extrabold sm:text-8xl">
            हिंदी में भी
          </h2>
        </div>
        <ul className="grid gap-3 text-prose">
          <li className="flex gap-3">
            <span className="mt-2 size-2 shrink-0 rounded-full bg-music" aria-hidden="true" />
            <span><b>The whole app in Hindi.</b> Every menu, button and message, with one switch in Settings.</span>
          </li>
          <li className="flex gap-3">
            <span className="mt-2 size-2 shrink-0 rounded-full bg-news" aria-hidden="true" />
            <span><b>Any story, in your language.</b> Hindi with one tap, or 19 more languages, from Bengali to Japanese.</span>
          </li>
          <li className="flex gap-3">
            <span className="mt-2 size-2 shrink-0 rounded-full bg-pdf" aria-hidden="true" />
            <span><b>Today’s paper.</b> PIB, AIR, DD News, Yojana and the Hindi e-papers, straight from their official sites.</span>
          </li>
          <li className="flex gap-3">
            <span className="mt-2 size-2 shrink-0 rounded-full bg-blue" aria-hidden="true" />
            <span><b>Summaries in Indian languages.</b> Stack AI answers in Hindi, Bengali, Tamil, Telugu and six more.</span>
          </li>
        </ul>
      </div>
      <div className="mt-14 grid gap-10 sm:grid-cols-3">
        {shots.map((s) => (
          <figure key={s.light} className="reveal-phone mx-auto w-full max-w-[240px]">
            <PhoneShot light={s.light} dark={s.dark} alt={s.alt} />
            <figcaption className="label mt-4 text-center text-[11px] text-muted">{s.label}</figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}

// Music isn't a tab any more: it plays behind your reading and your focus sessions.
function FocusMusic() {
  return (
    <section id="focus" className="scroll-mt-16 border-y border-line bg-paper-2">
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-20 sm:px-6 sm:py-28 md:grid-cols-[1fr_auto]">
        <div className="reveal">
          <p className="label text-xs text-muted">While you read</p>
          <h2 className="display mt-3 text-6xl sm:text-8xl">FOCUS &amp; MUSIC</h2>
          <p className="mt-5 max-w-xl text-lg text-prose">
            Pick one thing and give it 25 minutes. Music plays in the background, in a slim bar above the tabs, and
            pauses on your breaks.
          </p>
          <ul className="mt-6 grid max-w-lg divide-y divide-line rounded-2xl bg-card px-4 shadow-[0_8px_24px_rgba(0,0,0,.05)]">
            {[
              "15, 25, 45 or 60 minutes, or Pomodoro rounds with breaks",
              "Capture a thought without leaving the page; it’s saved to Notes",
              "A summary at the end: minutes, pages, highlights and notes",
              "Songs on your phone, or free music online",
              "Shuffle, repeat, speed, sleep timer and an Up next queue",
            ].map((p) => (
              <li key={p} className="flex gap-3 py-3 text-prose">
                <span className="mt-2 size-2 shrink-0 rounded-full bg-music" aria-hidden="true" />
                {p}
              </li>
            ))}
          </ul>
        </div>
        <div className="flex justify-center gap-5">
          <div className="reveal-phone w-[200px] sm:w-[220px]">
            <PhoneShot light="/screens/focus-light.png" dark="/screens/focus-dark.png" alt="The Focus screen: pick what to read, how long, and music" />
          </div>
          <div className="reveal-phone hidden w-[200px] translate-y-10 sm:block sm:w-[220px]">
            <PhoneShot light="/screens/music-light.png" dark="/screens/music-dark.png" alt="The Music screen with free music online" />
          </div>
        </div>
      </div>
    </section>
  );
}

function LocalFirst() {
  const points = [
    { t: "Works offline, no account", b: "Notes, highlights, PDFs and saved articles live on your phone, readable without a connection. Sign in only if you want sync." },
    { t: "No ads, no trackers", b: "We don’t sell or share your data, and never will." },
    { t: "AI only when you ask", b: "Stack AI is optional, asks before any text leaves your phone, and turns off completely in Settings." },
    { t: "Open source", b: `Built in the open by ${SITE.maker}, made in India.` },
  ];
  return (
    <section className="bg-ink text-on-ink">
      <div className="mx-auto grid max-w-6xl gap-12 px-4 py-20 sm:px-6 sm:py-24 md:grid-cols-[1fr_1.4fr]">
        <div className="reveal">
          <p className="label text-xs opacity-60">Your reading stays yours</p>
          <h2 className="display mt-3 text-6xl sm:text-7xl">LOCAL FIRST</h2>
        </div>
        <ul className="reveal grid gap-8 sm:grid-cols-2">
          {points.map((p) => (
            <li key={p.t} className="border-t border-on-ink/15 pt-4">
              <h3 className="text-lg font-bold">{p.t}</h3>
              <p className="mt-1 opacity-70">{p.b}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function Join() {
  return (
    <section id="join" className="scroll-mt-16 mx-auto grid max-w-6xl gap-12 px-4 py-20 sm:px-6 sm:py-28 md:grid-cols-2">
      <div className="reveal">
        <Logo size={56} />
        <p className="label mt-8 text-xs text-muted">Soft launch</p>
        <h2 className="display mt-3 text-6xl sm:text-8xl">BE ONE OF THE FIRST</h2>
        <p className="mt-6 text-lg text-prose">
          We’re inviting a small group to use Stack before the public Play Store release. Join the list and we’ll
          send your invite by email.
        </p>
        <ul className="mt-8 grid gap-3">
          {["Early access to the Android app", "A direct line to the people building it", "Stack Plus free for a year when it arrives"].map((t) => (
            <li key={t} className="flex items-center gap-3">
              <span className="size-2.5 shrink-0 rounded-full bg-news" aria-hidden="true" />
              {t}
            </li>
          ))}
        </ul>
        <div className="mt-10 rounded-2xl bg-ink p-6 text-on-ink">
          <p className="label text-[11px] font-medium">Try it now</p>
          <p className="mt-3 opacity-80">
            Don’t want to wait for the invite? Download the Android app (APK) from Google Drive and install it today.
          </p>
          <a
            href={SITE.apk}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-5 inline-flex h-12 items-center gap-2 rounded-full bg-paper px-6 text-[15px] font-semibold text-ink transition hover:opacity-90"
          >
            Download Stack (APK) <span aria-hidden="true">↓</span>
          </a>
        </div>
        <div className="mt-4 rounded-2xl bg-paper-2 p-6">
          <p className="label text-[11px] font-medium">What happens next</p>
          <ol className="mt-4 grid gap-3">
            {[
              "Join the list here",
              "We email you an invite link",
              "Tap it, opt in, and install Stack from Google Play",
              "Open Stack: your first minute starts, as above",
            ].map((t, i) => (
              <li key={t} className="flex items-baseline gap-3 text-prose">
                <span className="label text-[11px] text-muted">0{i + 1}</span>
                {t}
              </li>
            ))}
          </ol>
        </div>
      </div>
      <div className="reveal rounded-[1.75rem] bg-card p-6 shadow-[0_20px_60px_rgb(0_0_0/0.08)] sm:p-8">
        <SignupForm />
      </div>
    </section>
  );
}

function Questions() {
  return (
    <section id="faq" className="border-t border-line bg-paper-2">
      <div className="mx-auto max-w-3xl px-4 py-20 sm:px-6 sm:py-28">
        <div className="reveal">
          <p className="label text-xs text-muted">Questions</p>
          <h2 className="display mt-3 text-6xl sm:text-8xl">FAQ</h2>
        </div>
        <div className="reveal mt-10 grid gap-2.5">
          {FAQ.map((f) => (
            <details key={f.q} className="group rounded-2xl bg-card px-5 py-4">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-lg font-semibold">
                {f.q}
                <span
                  className="grid size-8 shrink-0 place-items-center rounded-full bg-paper-2 text-lg text-ink transition group-open:rotate-45 group-open:bg-ink group-open:text-on-ink"
                  aria-hidden="true"
                >
                  +
                </span>
              </summary>
              <p className="mt-3 text-prose">{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
