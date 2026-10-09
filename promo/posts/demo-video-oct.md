# Demo video launch: Reddit + X (October 2026)

**Video:** `~/Desktop/Stack_Demo_Video.mp4` (49 s, 1080×1920 vertical, captions burned in, silent)
**Cover:** `~/Desktop/Stack_Demo_Cover.png` (the "Highlight a line" frame)
Copies of both: `~/Desktop/StackForge/products/stack/marketing/`

What the video shows, in order: hook → splash with the tagline → save a Wikipedia article from
Chrome → highlight a line → Explain (Stack AI) → Notes → the daily Recall card → end card.

Before posting, replace `[Play testing link]` (Play Console → Closed testing → How testers join).
Don't post an APK link (see the rules in `promo/README.md`).

---

## X

Attach the video to the first post. Post the rest as replies to it (a thread).

**1/ (with the video)**
> I read every day and remember almost none of it.
>
> So I built Stack: save an article from any app, highlight the line that matters, and it comes back in a daily review so it actually sticks.
>
> Free. No ads. Works offline. Android.

**2/**
> How it works:
>
> 📥 Save: share from Chrome, YouTube or WhatsApp → it's in your Library
> 🖍️ Highlight: select a line → it becomes a note, linked to where you read it
> 🔁 Remember: every morning a few old highlights come back

**3/**
> Stuck on a line? Select it and tap Explain. Stack AI explains it simply, right where you're reading (Hindi too).
>
> It only sends text when you tap an AI button.

**4/**
> I'm building it in public and fixing what testers ask for.
>
> Join the Android test: [Play testing link]
> Code (open source): github.com/chhari07/stackforge
>
> What's the one thing that would make you use it every day?

Optional tags on the last post only: `#buildinpublic #indiedev #androiddev`

**Alt text for the video:**
> Screen recording of the Stack Android app: saving a Wikipedia article on the forgetting curve from Chrome, highlighting a sentence, getting an AI explanation, seeing it in Notes, and a daily review card.

---

## Reddit: r/SideProject (video post)

**Title**
> I kept forgetting everything I read, so I built an app that brings your highlights back every morning [Android, free, open source]

**Body** (if the subreddit allows text with video; otherwise post it as the first comment)
> I'm the developer. I read a lot of articles and PDFs and noticed I could barely remember any of it a week later. So I built **Stack**.
>
> **The loop is Save → Highlight → Remember:**
>
> - **Save** from any app with the share button. The article lands in your Library and is readable offline.
> - **Highlight** a line and it becomes a note, linked back to where you read it.
> - **Remember:** every morning a few old highlights come back in a short review (spaced repetition, nothing to set up).
>
> There's also **Explain** for hard lines (in Hindi too), PDF and EPUB reading, a focus timer and a home-screen widget.
>
> Free, no ads, no account needed. Built with Next.js + Capacitor, with optional Supabase sync. Open source: https://github.com/chhari07/stackforge
>
> It's in testing on Android: [Play testing link]
>
> I'd really like honest feedback: **what's confusing in the first two minutes?** I'm fixing things daily and I'll reply to every comment.

**First comment (post right away)**
> Happy to answer anything about how it's built. Short version: the app is a Next.js static export inside Capacitor, with a few native Android plugins (share card, widget, background news alerts). Everything is stored on the device first; sync is optional.

---

## Reddit: r/androidapps (different text, post on a different day)

r/androidapps usually wants apps that are on the Play Store. Post here once the testing link works, and check the
subreddit's rules and flair (often "Dev Promo" / self-promotion days) first.

**Title**
> [DEV] Stack: highlight lines in articles and PDFs, and it brings them back every morning so you remember what you read (free, no ads)

**First comment**
> Hi, I made this. Stack is a reader for articles, PDFs and EPUBs with one goal: helping you remember what you read.
>
> Share an article into it from any app, highlight what matters, and a daily review brings your highlights back. Hard line? Tap Explain for a simple explanation.
>
> Free, no ads, works offline, no account needed, open source.
>
> Testing link: [Play testing link]
>
> What would make you switch from your current read-later app?

---

## When and how to post

| | |
|---|---|
| **Best time** | Tue–Thu, 8–10 am US Eastern (6:30–8:30 pm IST) for Reddit; X any weekday morning or evening IST |
| **Order** | X first (day 1), r/SideProject (day 2), r/androidapps once the Play testing link is live |
| **First 2 hours** | Reply to every comment. This is what gets a post seen |
| **Reddit upload** | Upload the .mp4 directly (not a YouTube link), so it autoplays in the feed |
| **X upload** | Upload the .mp4 directly; 49 s is well under X's limit |
| **Log it** | Add each post to `promo/tracker.md` the same day |

## Notes about the video

- It's silent: captions tell the story because Reddit and X start videos muted. To add music, use a free track in an editor (CapCut, InShot) before uploading. X has no music library.
- Recorded on the Pixel 9a emulator in dark mode with the demo status bar (9:30, full battery).
- In the share sheet, a contact's name is blurred.
- The Explain answer took about 10 s to arrive. The video jump-cuts from "Thinking…" to the answer.

---

## Reddit image gallery (12 images)

**Images:** `~/Desktop/Stack_Reddit_Images/` (1080×1350, 4:5, numbered in posting order)
Copies: `~/Desktop/StackForge/products/stack/marketing/reddit-images/`

Use the gallery where a subreddit doesn't allow video, or as a second post a week after the video
(different subreddit, different text). Reddit allows up to 20 images and a caption on each.

**Title (r/SideProject)**
> I built an Android app that makes you remember what you read: save from any app, highlight a line, and it comes back in a daily review [12 screenshots]

**Caption for each image** (paste into the gallery's caption field)

| # | Image | Caption |
|---|---|---|
| 1 | `Stack_01_cover.png` | Stack: a reader that helps you remember what you read. Free, no ads, works offline. |
| 2 | `Stack_02_save.png` | Share any article from Chrome, YouTube or WhatsApp. It's saved to your Library. |
| 3 | `Stack_03_highlight.png` | Select a line and tap Highlight. It becomes a note linked to its source. |
| 4 | `Stack_04_remember.png` | Every day, a few old highlights come back for a quick review. |
| 5 | `Stack_05_explain.png` | Hard line? Explain gives a simple answer right in the reader. |
| 6 | `Stack_06_summary.png` | Summarize: the key points of a long article in seconds. |
| 7 | `Stack_07_hindi.png` | Summaries and explanations in Hindi too. |
| 8 | `Stack_08_pdf.png` | PDFs: highlight, draw and add sticky notes on the page. |
| 9 | `Stack_09_notes.png` | All your highlights and notes in one place. Search, filter, export to Markdown. |
| 10 | `Stack_10_library.png` | Articles, PDFs and books on shelves. Saved articles work offline. |
| 11 | `Stack_11_focus.png` | Focus: pick what you're reading, set 25 minutes, add music. |
| 12 | `Stack_12_end.png` | Free, no ads, no account needed, open source. Testing link in the comments. |

**First comment**
> I'm the developer. I made Stack because I kept forgetting what I read. The core is three steps: save, highlight, and a daily review that brings highlights back.
>
> Built with Next.js + Capacitor; everything is stored on your phone, and sync is optional. Code: https://github.com/chhari07/stackforge
>
> Android testing link: [Play testing link]
>
> Which of these would you actually use, and what's missing?

Screenshots are from the Pixel 9a emulator, dark mode, demo status bar. The book title on the Focus card (cover)
and the Harry Potter tile (Focus) are blurred.
