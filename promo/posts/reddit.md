# Reddit posts (developer's point of view)

You're the developer who built Stack. Say so in the first line of every post, explain
**why you built it and how**, and ask other people for feedback. One subreddit a day,
with different text each time. Read each subreddit's rules first: some only allow
self-promotion on certain days or in a weekly thread.

| Day | Subreddit | Angle | Format |
|---|---|---|---|
| 3 | r/androidapps | What the app does for the user | Video |
| 4 | r/SideProject | The story: why I built it, what I learned | Video or screenshots |
| 6 | r/androiddev | How it's built: Next.js + Capacitor + native plugins | Text |
| 8 | r/opensource | Open-source, offline-first, no tracking | Text + GitHub link |
| 10 | r/nextjs | One Next.js codebase as a website and an Android app | Text |
| 12 | r/Pocket | A free alternative after Pocket shut down | Text |
| 14 | r/Indian_Academia | A developer building a free study tool for Indian students | Screenshots |

---

## 1 · r/androidapps (video, day 3)

**Flair:** Developer (or the subreddit's flair for your own app)
**Video:** `~/Desktop/Stack_Reddit_Video.mp4`

**Title**
> I built a free Android app that brings your highlights back every morning, so you actually remember what you read [dev, open source, no ads]

**Text / first comment**
> Hi r/androidapps, I'm the developer of **Stack**.
>
> I built it because I kept running into the same problem: I'd read good articles and PDFs, highlight things, and never see those highlights again. Read-later apps help you save, note apps help you write, but nothing brought the important lines *back*.
>
> So Stack is built around one loop: **save → highlight → remember.**
>
> - **Save from any app:** share links, PDFs or text from Chrome, WhatsApp, Telegram or YouTube
> - **Highlight a line** in an article, PDF or EPUB and it becomes a note linked to where it came from
> - **Every morning, 3 old highlights come back** on a simple spaced schedule (Got it / Show again soon / Stop)
> - Focus timer with music, read-aloud, a home-screen widget, news feeds, and a Hindi interface
> - Optional AI (summarise, explain a line) that always asks before sending anything, with one switch to turn it off
>
> **Free, no ads, works fully offline, no account needed.** Open source: https://github.com/chhari07/stackforge
>
> It's in testing on Play now. I'd really like feedback from people who read a lot: what's confusing in the first minute, and what would make you open it every day?
>
> Join the test: [Play testing link]

---

## 2 · r/SideProject (day 4)

**Title**
> My side project: an offline-first reading app that resurfaces your highlights. What I learned building it.

**Text**
> I'm a developer, and for the last few months my side project has been **Stack**, an Android app that makes you remember what you read. You save articles and PDFs, highlight lines, and every morning three old highlights come back.
>
> A few things I learned building it:
>
> 1. **My first version did too much.** News, music, PDFs, notes, AI. Testers couldn't say what it was for. I cut the message down to one line, "Stack makes you remember what you read", rebuilt the first screen around it, and moved music out of the tab bar.
> 2. **Show the core loop in the first minute.** New users now open a two-minute sample article with one line already highlighted, highlight one more, and see both in the next morning's review.
> 3. **Offline-first was worth it.** Everything lives on the device, and accounts and sync are optional. That made it faster and easier to trust.
> 4. **Ask before AI does anything.** AI is optional, asks before sending text, and has one off switch. People noticed and liked it.
>
> Stack: Next.js + Capacitor + Supabase (optional sync), with a few native Android plugins.
>
> It's free, open source and in testing: [Play testing link] · https://github.com/chhari07/stackforge
>
> I'd love feedback on the first-run flow in particular. Is it clear what the app is for within 10 seconds?

---

## 3 · r/androiddev (text, day 6)

Check the rules: r/androiddev is strict about promotion. Lead with the technical
write-up; the app link goes last. If the rules require it, post in the weekly thread instead.

**Title**
> Shipping a Next.js app as a native-feeling Android app with Capacitor: what worked and what needed native code

**Text**
> I'm building **Stack**, a reading app (save → highlight → remember), as one Next.js codebase that's both a website and an Android app. Some notes from getting it to feel native:
>
> **What stayed in the web layer**
> - The whole UI, built as a static export (`next build` with a target flag → `out/`), wrapped by Capacitor. There's no server of mine in the app.
> - Networking with Capacitor's native HTTP, so the app fetches news and articles directly with no CORS problems. Reader mode uses Readability + DOMPurify.
> - PDFs with pdf.js, EPUB in the web view, all data in IndexedDB. Optional sync through Supabase.
>
> **What needed native Java plugins**
> - **Background music** with Media3: a media notification, lock-screen controls and headset keys
> - **Share target:** a small "Saved to Stack" card that pops up over the app you shared from, instead of opening Stack
> - **Breaking-news alerts** with WorkManager background fetches, at most one an hour
> - **A home-screen widget** showing today's highlight and streak
> - An animated splash screen and a notification icon
>
> **The Play Store build**
> - A separate build script for the Play version, which drops "All files access" (Play only allows it for file managers) and plain-http access
>
> **Things I'd do differently**
> - Plan the native/web boundary early. Each plugin is small, but the bridging adds up
> - Test the WebView on low-end phones from day one
>
> The app is open source if you want to see how the plugins are wired: https://github.com/chhari07/stackforge
>
> Happy to answer questions about the setup. I'd also love to hear how others handle background media in a Capacitor app.

---

## 4 · r/opensource (day 8)

**Title**
> Stack: an open-source, offline-first Android app for remembering what you read (no ads, no tracking, no account needed)

**Text**
> I'm the developer of Stack and I've just opened it for testing. The code is public: https://github.com/chhari07/stackforge
>
> **What it does:** save articles and PDFs from any app, highlight lines (they become notes linked to their source), and get three old highlights back every morning.
>
> **Why open source:** it holds people's reading and notes, so it should be inspectable. Everything works offline without an account; data stays on the device unless you choose to sign in and sync. Notes export to Markdown, and there's a full backup and restore to one file. No lock-in.
>
> **Stack:** Next.js (static export) + Capacitor, pdf.js, IndexedDB; optional Supabase sync; a few small native Android plugins.
>
> **Where help would be great:** an iOS build, EPUB edge cases, more translations (English and Hindi so far), and accessibility review.
>
> Feedback, issues and PRs are all welcome. Android test link: [Play testing link]

---

## 5 · r/nextjs (day 10)

**Title**
> One Next.js codebase as both a website and an offline Android app (static export + Capacitor)

**Text**
> I build **Stack** (a reading and highlights app) from one Next.js App Router project:
>
> - **Website:** the normal build, with route handlers for news and article fetching
> - **Android app:** the same pages as a static export with a build-time flag, wrapped in Capacitor. There's no server in the app; on the phone, fetching goes through Capacitor's native HTTP instead of the route handlers
>
> What made it work:
> - Keeping data access behind small functions that use IndexedDB in both places
> - Treating every page as a client page that works offline
> - A build flag that switches the fetch layer between "our API route" and "fetch on the device"
>
> Pain points: anything that needs a server at request time has to have a device-side version, and static export rules out some features.
>
> Code: https://github.com/chhari07/stackforge. Curious whether others ship Next.js to mobile this way, or whether you'd go React Native instead.

---

## 6 · r/Pocket (day 12)

Only where the rules allow it. Otherwise, reply helpfully in existing "Pocket alternative?" threads.

**Title**
> I'm building a free, open-source read-it-later app for Android with highlights and a daily review

**Text**
> Disclosure: I'm the developer. Since Pocket shut down, I've been building **Stack**, and it's now in testing.
>
> - Save links from any app via the share sheet
> - Clean reader mode, offline reading
> - Highlights become notes linked to the article; export to Markdown (Obsidian, Notion)
> - A daily review brings 3 old highlights back each morning
> - Also reads PDFs and EPUBs, and can read articles aloud
>
> Free, no ads, no account needed, open source: https://github.com/chhari07/stackforge
>
> A Pocket import is next on my list. What did you rely on in Pocket that you still miss?
>
> [Play testing link]

---

## 7 · r/Indian_Academia (screenshots, day 14)

**Title**
> I'm a developer building a free, offline study app for Indian students. Would love feedback from people preparing for exams.

**Text**
> I'm the developer of **Stack**. I built it after seeing how students around me study: PDFs from coaching and Telegram groups, notes in five different apps, and most of it forgotten a week later. The paid apps only work with their own material.
>
> What Stack does:
> - Reads **any** PDF or EPUB on your phone: coaching notes, NCERT, PYQs. Imports PDFs from Telegram
> - Select a line → it becomes a note. Select a hard line → **Explain**, in English or Hindi (optional AI)
> - **Daily review:** 3 of your old highlights every morning
> - Focus timer with the PDF open, read-aloud, and Indian news you can highlight
> - The whole app in **Hindi** as well as English
>
> Free, no ads, works offline, open source.
>
> What would make this useful for **your** exam: GATE, UPSC, NEET or CAT? I'm deciding what to build next (a syllabus checklist and quizzes from your highlights are top of the list).
>
> [Play testing link]

---

## Replies you'll need

**"Is it really free? What's the catch?"**
> The app is free and everything that works offline stays free. If I add a paid tier later, it'll be optional AI extras. The code is open source, so you can check what it does.

**"What data do you collect?"**
> Nothing unless you sign in. Without an account everything stays on your phone. AI features ask before sending any text, and one switch in Settings turns AI off. Privacy policy: https://stackforge.in/privacy

**"Why not Flutter / React Native / native Kotlin?"**
> One codebase gives me the website and the app, and most of Stack is reading UI that the web does well. Where the web wasn't enough (background audio, the share card, the widget, background fetch), I wrote small native plugins.

**"iPhone?"**
> Android only for now. Capacitor makes iOS possible, and it's on the list. The more people ask, the sooner it happens.

**"Why not just use Readwise / Anki / Notion?"**
> They're great. Stack is for when you don't want to make cards or build a system: you highlight while you read, and it brings those lines back on its own. Notes export to Markdown, so they work with Notion and Obsidian too.

**"Can I contribute?"**
> Yes, please! The repo is https://github.com/chhari07/stackforge. Issues and PRs are welcome, especially for iOS, translations and accessibility.
