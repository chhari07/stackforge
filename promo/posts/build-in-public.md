# Building Stack in public (Reddit + X)

You're the developer. The goal: **people see a real product that gets better every day**, built by someone
who listens. Post the video once as the launch, then post a short daily update that shows what changed.

**Video:** `~/Desktop/Stack_Reddit_Video.mp4` (36 s, vertical, captions burned in)

---

## Part 1 · The launch post (day 1)

### X (attach the video)

> I built an app that makes you remember what you read.
>
> Highlight a line in any article or PDF → it becomes a note → every morning, 3 old highlights come back.
>
> Free. No ads. Works offline. Open source.
>
> It's live in testing on Android today. I'll post what I ship every day 👇
>
> [Play testing link]

**Reply to your own post right away** (this becomes the thread you add to every day):
> Day 1 of building Stack in public.
>
> Stack: Next.js + Capacitor, pdf.js, IndexedDB, optional Supabase sync. Code: github.com/chhari07/stackforge
>
> Tomorrow: whatever the first testers complain about most. Tell me what's confusing.

### Reddit (r/androidapps, video post)

**Title**
> I'm the developer: Stack brings your highlights back every morning so you remember what you read. Live in testing today, and I'm shipping fixes daily [free, open source, no ads]

**First comment**
> Hi! I built Stack and it went live in testing today.
>
> The loop: **save → highlight → remember.** Save articles and PDFs from any app, highlight a line and it becomes a note linked to its source, and every morning three old highlights come back.
>
> I'm shipping an update **every day** during testing, based on what people here say. Comment what's confusing or missing, and I'll reply with what I changed.
>
> Free, no ads, works offline, no account needed. Open source: https://github.com/chhari07/stackforge
>
> Join the test: [Play testing link]

---

## Part 2 · Showing it's live, every day

### Where to post daily

| Platform | How often | Where |
|---|---|---|
| **X** | **Every day** | Reply to your own launch thread, so all days stay connected and new followers can scroll the whole story |
| **Reddit** | **Daily on your profile, weekly in subreddits** | Daily: post on your own Reddit profile (or a small r/StackApp you create). Weekly: one progress post in r/SideProject. Posting daily in other subreddits gets you banned |
| **Reddit comments** | Every day | Reply to every comment on your posts with "Fixed in today's build ✅" when you fix something they asked for. This shows the product is live better than anything else |

### The daily post format (same every day, takes 10 minutes)

> **Day [N] of building Stack in public**
>
> ✅ Shipped: [one thing, one sentence]
> 💬 Because: [who asked for it / what you noticed]
> 📊 Today: [one real number]
> 🔜 Tomorrow: [one thing]
>
> [10-second screen recording or one screenshot of the change]

**Always attach something visual:** a 5–10 second screen recording of the change (the phone's own screen recorder is enough) or a before/after screenshot.

### What to post each day of the week

| Day | Theme | Example |
|---|---|---|
| Mon | **Shipped** a feature | "Explain this now works in Hinglish" + clip |
| Tue | **Feedback → fix** | Screenshot of the comment, then the fix. Credit the person |
| Wed | **Numbers** | Testers, highlights saved, reviews done. Real numbers only, even small ones |
| Thu | **Under the hood** | A short technical note or code snippet ("how the share card pops up over other apps") |
| Fri | **A highlight of the day** | A Stack quote card of a line you highlighted this week |
| Sat | **Ask** | A poll: "What should I build next? Quiz / Pocket import / iOS" |
| Sun | **Week recap** | 5 bullets: shipped, learned, numbers, mistakes, next week. Make this your weekly r/SideProject post |

### Numbers you can show (from your own dashboards)

Only post real numbers. Small honest numbers build more trust than big vague ones.

| Number | Where to find it |
|---|---|
| Testers who joined | Play Console → Testing → Closed testing |
| Sign-ups | Supabase → Authentication → Users |
| Highlights saved, reviews done | Supabase → `items` table (only for people who sync) |
| AI requests | Supabase `ai_usage` table (it keeps only today's rows, so note the figure each evening) |
| Builds shipped | Your version code in `package.json` / Play Console |

---

## Part 3 · The first 7 days, written out

Change the details to whatever actually happened. Never post a fix you didn't ship.

**Day 2**
> Day 2 of building Stack in public
>
> ✅ Shipped: "Report this answer" on every AI reply
> 💬 Because: if AI gets something wrong, you should be able to tell me in one tap
> 📊 Today: [N] testers joined
> 🔜 Tomorrow: fixing the top complaint from day 1

**Day 3**
> Day 3 of building Stack in public
>
> ✅ Shipped: [fix for the top complaint]
> 💬 Because: @[user] said "[their words]". Thank you!
> 📊 Today: [N] highlights saved by testers
> 🔜 Tomorrow: Pocket import

**Day 4: under the hood**
> Day 4 of building Stack in public
>
> How Stack is built: one Next.js codebase → a website AND an Android app.
>
> The app is a static export wrapped in Capacitor. Where the web wasn't enough, I wrote small Java plugins: background music (Media3), the "Saved to Stack" share card, news alerts (WorkManager) and the home-screen widget.
>
> 🔜 Tomorrow: Pocket import ships

**Day 5**
> Day 5 of building Stack in public
>
> ✅ Shipped: import your Pocket / Omnivore export into Stack
> 💬 Because: Pocket shut down and people still need a home for their saved articles
> 📊 Today: [N] testers, [N] in the daily review
> 🔜 Tomorrow: a poll on what to build next

**Day 6: ask**
> Day 6 of building Stack in public
>
> What should I build next?
> 🧠 Quiz from your own highlights
> 📚 Exam shelves (GATE, JEE, NEET, UPSC)
> 🍎 iPhone app
> 🧩 Chrome extension

**Day 7: week recap** (also post to r/SideProject)
> Week 1 of building Stack in public
>
> ✅ Shipped: [list]
> 📊 [N] testers, [N] highlights, [N] reviews done
> 💡 Learned: [one honest lesson]
> 😬 Mistake: [one honest mistake]
> 🔜 Next week: [the poll winner]
>
> Thank you to everyone who tested and complained. Every fix this week came from you.

---

## Rules

1. **Never skip a day on X.** A short post beats no post. If nothing shipped, post what you learned or a number.
2. **Real numbers, real fixes.** If nothing changed, say so. People follow build-in-public for honesty.
3. **Credit the people who give feedback,** by name if they're OK with it. They'll share it.
4. **Answer every reply on X and every Reddit comment within a few hours** during testing.
5. **Reddit is weekly, not daily,** outside your own profile. Daily self-promotion in subreddits gets posts removed.
6. **Use the same hashtags on X every day:** `#buildinpublic #indiedev #androiddev`. Don't use more than 2–3.
