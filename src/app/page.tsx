"use client";

import { useEffect, useState } from "react";
import { TabBar } from "@/components/tab-bar";
import { TopBar } from "@/components/top-bar";
import { MiniPlayer } from "@/components/mini-player";
import { useStore } from "@/lib/use-store";
import { useNews } from "@/lib/use-news";
import { dayStamp, greeting } from "@/lib/format";
import { getProfile } from "@/lib/profile";
import { NotifyPrompt } from "@/components/notify-prompt";
import { WeekCard } from "@/components/week-card";
import { NowCard, nowLine, useNow } from "@/components/now-card";
import {
  HomeHeader,
  KeptToday,
  NewsForYou,
  QuickActions,
  SavedForLater,
  SignOff,
  YourDay,
  YourReading,
} from "@/components/home-sections";
import { useT } from "@/lib/i18n";

// Today, context first. Top to bottom:
//  1 greeting, a line for this moment and status chips
//  2 Right now: the one thing that matters most at this moment (components/now-card.tsx)
//  3 Your day: what's done, what's now, what's later
//  4 quick actions · 5 saved for later · 6 your reading · 7 kept today
//  8 news for you (moves up into Right now on news mornings) · 9 this week · 10 sign-off
// Only the top changes with the moment; the order below stays the same, so it's easy to learn.
export default function Today() {
  const t = useT();
  const [stamp, setStamp] = useState<{ day: string; date: string; hello: string; hour: number; time: string } | null>(null);
  // Date and time are read on the client only, so server and client HTML match.
  useEffect(() => {
    const d = new Date();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStamp({
      ...dayStamp(),
      hello: greeting(),
      hour: d.getHours(),
      time: d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
    });
  }, []);
  const [profile] = useStore(getProfile, { id: "me", updatedAt: 0 });
  const firstName = profile.name?.trim().split(/\s+/)[0];

  const lead = useNow();
  // Your first interest's news (the morning brief and News for you), or the top stories.
  const topics = profile.interests?.length ? profile.interests.slice(0, 3) : ["top" as const];
  const news = useNews(topics[0]);

  const skipSaved = lead?.kind === "saved" ? lead.story.id : undefined;
  const skipBook = lead?.kind === "continue" ? lead.pdf.id : undefined;

  return (
    <main className="px-(--gutter) pt-1 pb-[calc(var(--above-tabs)+70px)]">
      <TopBar animate />

      <HomeHeader
        name={firstName}
        hello={stamp ? t(stamp.hello) : ""}
        line={nowLine(lead, t) || t("What are we reading?")}
        stamp={stamp ? `${stamp.day} ${stamp.date} · ${stamp.time}` : ""}
      />
      <NowCard lead={lead} stories={news.stories} />
      <YourDay lead={lead} hour={stamp?.hour ?? 12} />
      <QuickActions />
      <NotifyPrompt />
      <SavedForLater skip={skipSaved} />
      <YourReading skip={skipBook} />
      <KeptToday />
      {lead?.kind !== "news" && (
        <NewsForYou stories={news.stories} topics={profile.interests?.length ? topics : []} status={news.status} />
      )}
      <div className="mt-3">
        <WeekCard />
      </div>
      <SignOff />

      <MiniPlayer />
      <TabBar />
    </main>
  );
}
