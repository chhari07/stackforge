# Stack: posts and PR

Everything you need to tell people about Stack, ready to copy and paste.
Fill in the `[brackets]` before you post (search the folder for `[`).

## The one message

Use these exact words everywhere. Don't make up new taglines.

| | |
|---|---|
| **Tagline** | Stack makes you remember what you read. |
| **Loop** | Save → Highlight → Remember |
| **Promise** | Highlight anything. Stack brings it back. |
| **Facts** | Free · no ads · works offline · no account needed · open source · Android |

## Links

| | |
|---|---|
| Website | https://stackforge.in |
| GitHub | https://github.com/chhari07/stackforge |
| Email | hello@stackforge.in |
| Play testing link | `[Play testing link]` (from Play Console → Closed testing → How testers join) |
| Screenshots | `docs/screens/`, `website/public/screens/` (light and dark) |
| Banner | `docs/assets/banner.png` |

## What's in here

```
promo/
├── README.md              ← you are here: the message, calendar, rules
├── tracker.md             ← log every post and what it brought in
├── video/
│   └── scripts.md         ← the 35-second Reddit video + 3 Reels/Shorts
├── posts/
│   ├── reddit.md          ← developer posts: r/androidapps, r/SideProject, r/androiddev, r/opensource, r/nextjs, r/Pocket, r/Indian_Academia
│   ├── hacker-news.md     ← Show HN
│   ├── product-hunt.md    ← launch page text + first comment
│   ├── build-in-public.md ← launch video post (Reddit + X) and the daily "Day N" updates
│   ├── x-linkedin.md      ← X thread and LinkedIn post
│   └── telegram-whatsapp.md ← messages for study groups and friends
└── pr/
    ├── press-kit.md       ← facts, descriptions (10/50/100 words), founder bio, assets
    ├── press-release.md   ← soft-launch announcement
    ├── pitch-emails.md    ← to journalists, bloggers and YouTubers
    └── play-store.md      ← store title, descriptions, screenshot captions
```

## Calendar

Start with friends and study groups, then Reddit, then the big launch sites.
The dates follow the soft-launch plan; move them if the Play upload slips.

| When | Where | File |
|---|---|---|
| Before anything | Make the 35-second video. Fill in the Play listing | `video/scripts.md`, `pr/play-store.md` |
| Day 1 (testing opens) | Friends, WhatsApp, 3–5 Telegram study groups (ask admins first) | `posts/telegram-whatsapp.md` |
| Day 2–3 | X thread, LinkedIn | `posts/x-linkedin.md` |
| Day 3 (Tue–Thu) | r/androidapps with the video | `posts/reddit.md` |
| Day 4 | r/SideProject | `posts/reddit.md` |
| Day 6 | r/androiddev (technical write-up) | `posts/reddit.md` |
| Day 8 | r/opensource | `posts/reddit.md` |
| Day 10 | r/nextjs | `posts/reddit.md` |
| Day 12 | r/Pocket | `posts/reddit.md` |
| Day 14 | r/Indian_Academia | `posts/reddit.md` |
| Every day from day 1 | "Day N of building Stack in public" on X; reply to every comment | `posts/build-in-public.md` |
| Every week | 3 Reels / YouTube Shorts; Sunday recap to r/SideProject | `video/scripts.md`, `posts/build-in-public.md` |
| Public launch week | Product Hunt (Tuesday) + Show HN (same week, a different day) | `posts/product-hunt.md`, `posts/hacker-news.md` |
| Public launch week | Press release + pitch emails | `pr/` |

## Rules that keep posts from being removed

1. **Say it's your app** in the first line. Hiding it gets you banned.
2. **Read each subreddit's rules** before posting. Many allow self-promotion only on certain days or with a flair.
3. **Be a member first.** Comment helpfully in a subreddit or group for a week before you post there.
4. **One subreddit a day**, never the same text twice. Each file has a different version.
5. **Answer every comment in the first 2 hours.** That's what gets a post noticed.
6. **Ask for feedback, not downloads.** "What's confusing?" works better than "Please download".
7. **Use the Play testing link, not an APK.** People don't trust APK links, and each tester counts toward Google's 12 testers for 14 days.
8. **Log it** in `tracker.md` the same day.
