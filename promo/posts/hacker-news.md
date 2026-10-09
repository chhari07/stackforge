# Show HN

Post in public launch week, Tuesday to Thursday, about 8–10 am US Eastern (6:30–8:30 pm IST).
Hacker News readers like plain, technical and honest posts. Don't use marketing words or emoji, and
don't ask friends to upvote (HN detects it and buries the post).

**Title** (80 characters max)
> Show HN: Stack – an open-source Android app that brings your highlights back

**URL:** https://github.com/chhari07/stackforge

**First comment** (post it right away)
> Hi HN, I built Stack because I read a lot (articles, PDFs for exam prep) and remembered very little of it.
>
> The loop is: save something from any app via the share sheet → read it in a clean reader or the PDF viewer → select a line and it becomes a note linked to its source (URL or PDF page) → every morning, three old highlights come back on a simple spaced schedule (Got it / Show again soon / Stop).
>
> Some technical notes:
> - It's a Next.js app exported as static files and wrapped with Capacitor for Android. There's no server of ours in the app: news and articles are fetched on the device with Capacitor's native HTTP, and reader mode uses Readability + DOMPurify.
> - PDFs and EPUBs are read on the device (pdf.js for PDFs), with highlights and page notes.
> - Everything lives in IndexedDB and works offline with no account. Sync is optional, through Supabase.
> - Native bits (background music with Media3, the share card, news alerts via WorkManager, the home-screen widget) are small Java plugins.
> - AI is optional and off by a single switch. It runs through a Supabase Edge Function, with Sarvam for Indian languages.
>
> It's Android-only for now. I'd love feedback on the review schedule in particular. It's deliberately simpler than Anki's, and I'm not sure it's simple in the right way.
