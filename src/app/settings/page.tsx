"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { BackIcon, DiscIcon } from "@/components/icons";
import { Avatar } from "@/components/avatar";
import { useAccount } from "@/components/account-provider";
import { getProfile } from "@/lib/profile";
import { useStore } from "@/lib/use-store";
import { useSpotify } from "@/components/spotify-provider";
import { SpotifyLoginNote, SpotifySetup, SpotifyTroubleshooting } from "@/components/spotify-setup";
import { useToast } from "@/components/toast";
import { PLAY_BUILD, useIsNative } from "@/lib/platform";
import { PhoneFiles, useAllFiles } from "@/lib/phone-files";
import { LocalMusic } from "@/lib/local-music";
import {
  askForNotifications,
  getReminder,
  notificationsAllowed,
  sendTestNotification,
  setReminder,
  type Reminder,
} from "@/lib/reminders";
import { login, setClientId } from "@/lib/spotify";
import { getTheme, setTheme, type Theme } from "@/lib/theme";
import { AppSettings } from "@/lib/app-settings";
import { BackupSection } from "@/components/backup-section";
import { NewsAlertsSection } from "@/components/news-alerts-section";
import { addWidget } from "@/lib/widget";
import { AiSection } from "@/components/ai-section";
import { setUiLang, UI_LANGS, useT, useUiLang } from "@/lib/i18n";

function Section({ title, children }: { title: string; children: ReactNode }) {
  const t = useT();
  const [n, name] = title.split(" — ");
  return (
    <section className="mt-6">
      <h2 className="label text-[11px] font-medium">
        {n} — {t(name)}
      </h2>
      <div className="mt-2.5 flex flex-col gap-3 rounded-2xl bg-card p-4">
        {children}
      </div>
    </section>
  );
}

// One permission row: what it's for, its state, and the button that fixes it.
function AccessRow({
  name,
  why,
  status,
  action,
}: {
  name: string;
  why: string;
  status: "on" | "off" | "unknown";
  action?: ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 border-b border-line pb-3 last:border-0 last:pb-0">
      <span
        aria-hidden
        className={`size-2.5 shrink-0 rounded-full ${status === "on" ? "bg-[#1DB954]" : status === "off" ? "bg-music" : "bg-rule"}`}
      />
      <span className="flex min-w-0 grow flex-col">
        <span className="text-[15px] font-semibold">{name}</span>
        <span className="text-[12px] leading-snug text-muted">{why}</span>
      </span>
      {action}
    </div>
  );
}

const small =
  "h-9 shrink-0 rounded-full border border-ink/15 px-3 text-[12px] font-semibold";
const pad = (n: number) => String(n).padStart(2, "0");

export default function Settings() {
  const native = useIsNative();
  const sp = useSpotify();
  const toast = useToast();
  const t = useT();
  const [theme, setThemeState] = useState<Theme>("system");
  const [folder, setFolder] = useState<string | null>(null);
  const [notify, setNotify] = useState<boolean | null>(null);
  const [music, setMusic] = useState<string | null>(null);
  const [reminder, setReminderState] = useState<Reminder | null>(null);
  const [showSpotifySetup, setShowSpotifySetup] = useState(false);
  const allFiles = useAllFiles();

  const refresh = useCallback(() => {
    if (!native) return;
    PhoneFiles.getFolder()
      .then((f) => setFolder(f.name ?? null))
      .catch(() => {});
    notificationsAllowed()
      .then(setNotify)
      .catch(() => setNotify(false));
    LocalMusic.checkAudio()
      .then((r) => setMusic(r.audio))
      .catch(() => setMusic(null));
    setReminderState(getReminder());
  }, [native]);

  useEffect(() => {
    if (allFiles.granted)
      LocalMusic.checkAudio()
        .then((r) => setMusic(r.audio))
        .catch(() => {});
  }, [allFiles.granted]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setThemeState(getTheme());
    refresh();
    // Coming back from Android Settings: re-read every permission.
    const onVisible = () => document.visibilityState === "visible" && refresh();
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [refresh]);

  const openAndroidSettings = (page?: "app" | "notifications") =>
    AppSettings.open({ page }).catch(() => {});

  const pickFolder = async () => {
    try {
      const f = await PhoneFiles.pickFolder();
      setFolder(f.name);
      toast({
        text: t("Stack can read PDFs in {folder}", { folder: f.name }),
        href: "/library",
        action: t("Library"),
      });
    } catch {
      /* cancelled */
    }
  };

  const updateReminder = async (next: Reminder) => {
    const ok = await setReminder(next);
    setReminderState(getReminder());
    setNotify(await notificationsAllowed());
    if (next.on && !ok)
      toast({ text: t("Notifications are blocked. Tap Allow under Access.") });
    else if (next.on)
      toast({ text: t("Daily digest at {time}", { time: `${pad(next.hour)}:${pad(next.minute)}` }) });
  };

  return (
    <main className="px-5 pt-5 pb-16">
      <div className="flex h-11 items-center">
        <Link
          href="/"
          aria-label={t("Back")}
          className="-ml-2 flex size-11 items-center justify-center"
        >
          <BackIcon size={22} />
        </Link>
      </div>
      <h1 className="display mt-2 text-[76px]">{t("SETTINGS")}</h1>
      <AccountRow />
      {/* Music left the tab bar: it's background audio for reading and focus. */}
      <Link href="/music" className="mt-2.5 flex items-center gap-3.5 rounded-2xl bg-card p-4">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-music text-white">
          <DiscIcon size={22} />
        </span>
        <span className="flex min-w-0 grow flex-col gap-0.5">
          <span className="text-[16px] font-semibold">{t("Music")}</span>
          <span className="label truncate text-[10px] text-muted">{t("Background audio while you read and focus")}</span>
        </span>
        <span className="label text-[10px] underline">{t("Open")}</span>
      </Link>
      <div className="">
        <LanguageSection />

        <Section title="02 — Appearance">
          <div
            role="radiogroup"
            aria-label={t("Theme")}
            className="grid grid-cols-3 gap-2"
          >
            {(["system", "light", "dark"] as Theme[]).map((th) => (
              <button
                key={th}
                role="radio"
                aria-checked={theme === th}
                onClick={() => {
                  setTheme(th);
                  setThemeState(th);
                }}
                className={`flex h-20 flex-col items-center justify-center gap-2 rounded-xl border text-[13px] font-semibold ${
                  theme === th ? "border-ink" : "border-ink/15"
                }`}
              >
                <span
                  aria-hidden
                  className={`flex size-7 overflow-hidden rounded-full border border-ink/20 ${
                    th === "dark"
                      ? "bg-[#141413]"
                      : th === "light"
                        ? "bg-[#F7F5F0]"
                        : ""
                  }`}
                >
                  {th === "system" && (
                    <>
                      <span className="h-full w-1/2 bg-[#F7F5F0]" />
                      <span className="h-full w-1/2 bg-[#141413]" />
                    </>
                  )}
                </span>
                {t(th === "system" ? "Auto" : th === "light" ? "Light" : "Dark")}
              </button>
            ))}
          </div>
          <p className="text-[12px] text-muted">
            {t("Auto follows your phone’s dark theme.")}
          </p>
        </Section>

        <Section title="03 — Access">
          {!native ? (
            <p className="text-[14px] text-muted">
              {t("Phone permissions (notifications, music, files) are managed in the Android app.")}
            </p>
          ) : (
            <>
              {!PLAY_BUILD && (
              <AccessRow
                name={t("All files")}
                why={t("Finds every PDF and song on this phone")}
                status={
                  allFiles.granted === null
                    ? "unknown"
                    : allFiles.granted
                      ? "on"
                      : "off"
                }
                action={
                  <button
                    onClick={() =>
                      allFiles.granted
                        ? openAndroidSettings()
                        : allFiles.request()
                    }
                    className={small}
                  >
                    {allFiles.granted ? t("Manage") : t("Allow")}
                  </button>
                }
              />
              )}
              <AccessRow
                name={t("Notifications")}
                why={t("Daily digest and music controls")}
                status={notify === null ? "unknown" : notify ? "on" : "off"}
                action={
                  notify ? (
                    <button
                      onClick={() => openAndroidSettings("notifications")}
                      className={small}
                    >
                      {t("Manage")}
                    </button>
                  ) : (
                    <button
                      onClick={async () => {
                        const ok = await askForNotifications();
                        setNotify(ok);
                        if (!ok) openAndroidSettings("notifications");
                      }}
                      className={small}
                    >
                      {t("Allow")}
                    </button>
                  )
                }
              />
              <AccessRow
                name={t("Music and audio")}
                why={t("Play songs stored on this phone")}
                status={
                  music === null
                    ? "unknown"
                    : music === "granted"
                      ? "on"
                      : "off"
                }
                action={
                  music === "granted" ? (
                    <button
                      onClick={() => openAndroidSettings()}
                      className={small}
                    >
                      {t("Manage")}
                    </button>
                  ) : (
                    <button
                      onClick={async () => {
                        const r = await LocalMusic.requestAudio();
                        setMusic(r.audio);
                        if (r.audio !== "granted") openAndroidSettings();
                      }}
                      className={small}
                    >
                      {t("Allow")}
                    </button>
                  )
                }
              />
              {!allFiles.granted && (
                <AccessRow
                  name={t("PDF folder")}
                  why={
                    folder
                      ? t("Reads PDFs in {folder}", { folder })
                      : t("Pick one folder, e.g. Documents")
                  }
                  status={folder ? "on" : "off"}
                  action={
                    <button onClick={pickFolder} className={small}>
                      {folder ? t("Change") : t("Choose")}
                    </button>
                  }
                />
              )}
              {folder && !allFiles.granted && (
                <button
                  onClick={async () => {
                    await PhoneFiles.forgetFolder();
                    setFolder(null);
                  }}
                  className="self-start text-[12px] text-muted underline"
                >
                  {t("Remove folder access")}
                </button>
              )}
              <button
                onClick={() => openAndroidSettings()}
                className="h-11 rounded-full border border-ink/15 text-[14px] font-semibold"
              >
                {t("Open Stack in Android settings")}
              </button>
            </>
          )}
        </Section>

        <Section title="04 — Spotify">
          {PLAY_BUILD && !sp.configured && !showSpotifySetup ? (
            <>
              <p className="text-[14px] text-muted">
                {t("Spotify only lets each app have a few users, so Stack can’t sign you in by itself. If you have a Spotify developer app, add its Client ID to use your playlists here.")}
              </p>
              <button
                onClick={() => setShowSpotifySetup(true)}
                className="self-start text-[12px] text-muted underline"
              >
                {t("Advanced: use my own Spotify app")}
              </button>
            </>
          ) : !sp.configured || showSpotifySetup ? (
            <SpotifySetup compact />
          ) : sp.connected ? (
            <>
              <div className="flex items-center gap-2 text-[15px]">
                <span className="size-2 rounded-full bg-[#1DB954]" /> {t("Connected")}
              </div>
              <p className="text-[13px] text-muted">
                {t("Your playlists and Liked Songs are in Music → Spotify.")}
              </p>
              <button
                onClick={sp.disconnect}
                className="h-11 rounded-full border border-ink/15 text-[14px] font-semibold"
              >
                {t("Log out of Spotify")}
              </button>
            </>
          ) : (
            <>
              <p className="text-[14px] text-muted">
                {t("Your Spotify app is set up. Log in to see your playlists and control playback.")}
              </p>
              <button
                onClick={login}
                className="h-12 rounded-full bg-[#1DB954] text-[15px] font-semibold text-black"
              >
                {t("Log in with Spotify")}
              </button>
              {sp.error && (
                <p className="text-[13px] text-music-deep">{sp.error}</p>
              )}
              <SpotifyLoginNote />
              <SpotifyTroubleshooting />
            </>
          )}
          {sp.configured && (
            <div className="flex gap-4">
              <button
                onClick={() => setShowSpotifySetup((v) => !v)}
                className="text-[12px] text-muted underline"
              >
                {showSpotifySetup ? t("Hide setup") : t("Change Spotify app (Client ID)")}
              </button>
              <button
                onClick={() => {
                  setClientId(null);
                  setShowSpotifySetup(false);
                  toast({ text: t("Spotify app removed") });
                }}
                className="text-[12px] text-muted underline"
              >
                {t("Reset")}
              </button>
            </div>
          )}
        </Section>

        <Section title="05 — Daily digest">
          {!native || !reminder ? (
            <p className="text-[14px] text-muted">
              {t("The daily digest notification is available in the Android app.")}
            </p>
          ) : (
            <>
              <label className="flex items-center justify-between gap-4">
                <span className="flex flex-col">
                  <span className="text-[15px] font-semibold">
                    {t("Morning digest")}
                  </span>
                  <span className="text-[13px] text-muted">
                    {t("Top story + the PDF you’re reading")}
                  </span>
                </span>
                <input
                  type="checkbox"
                  role="switch"
                  checked={reminder.on}
                  onChange={(e) =>
                    updateReminder({ ...reminder, on: e.target.checked })
                  }
                  className="h-7 w-12 shrink-0 cursor-pointer appearance-none rounded-full bg-rule transition-colors before:block before:size-6 before:translate-x-0.5 before:rounded-full before:bg-white before:shadow before:transition-transform checked:bg-music checked:before:translate-x-[22px]"
                />
              </label>
              <label className="flex items-center justify-between">
                <span className="text-[14px]">{t("Time")}</span>
                <input
                  type="time"
                  value={`${pad(reminder.hour)}:${pad(reminder.minute)}`}
                  onChange={(e) => {
                    const [h, m] = e.target.value.split(":").map(Number);
                    if (!Number.isNaN(h) && !Number.isNaN(m))
                      updateReminder({ ...reminder, hour: h, minute: m });
                  }}
                  className="h-11 rounded-xl border border-ink/15 bg-paper px-3 text-[15px]"
                />
              </label>
              <button
                onClick={async () => {
                  const ok = await sendTestNotification();
                  setNotify(await notificationsAllowed());
                  toast({
                    text: ok ? t("Test notification sent") : t("Notifications are blocked for Stack"),
                  });
                }}
                className="h-11 rounded-full border border-ink/15 text-[14px] font-semibold"
              >
                {t("Send a test notification")}
              </button>
            </>
          )}
        </Section>

        <Section title="06 — Breaking news">
          <NewsAlertsSection />
        </Section>

        <Section title="07 — Home screen widget">
          {!native ? (
            <p className="text-[14px] text-muted">{t("The home screen widget is available in the Android app.")}</p>
          ) : (
            <>
              <p className="text-[14px] leading-relaxed">
                {t("Today’s highlight, your streak and the book you’re reading, on your home screen.")}
              </p>
              <button
                onClick={async () => {
                  const asked = await addWidget().catch(() => false);
                  if (!asked) toast({ text: t("Hold an empty spot on your home screen, tap Widgets, then pick Stack") });
                }}
                className="h-11 rounded-full border border-ink/15 text-[14px] font-semibold"
              >
                {t("Add to home screen")}
              </button>
            </>
          )}
        </Section>

        <Section title="08 — Stack AI">
          <AiSection />
        </Section>

        <Section title="09 — Backup">
          <BackupSection />
        </Section>
      </div>
      <p className="label mt-8 text-center text-[10px] text-muted">
        {t("Everything is stored on this device, in your account when you’re signed in, and in backups you save")}
      </p>
    </main>
  );
}

// Profile and sign-in status, opening the Account screen.
// The whole app in English or Hindi (lib/i18n.ts).
function LanguageSection() {
  const t = useT();
  const lang = useUiLang();
  return (
    <Section title="01 — Language">
      <div role="radiogroup" aria-label={t("Language")} className="grid grid-cols-2 gap-2">
        {UI_LANGS.map((l) => (
          <button
            key={l.value}
            role="radio"
            aria-checked={lang === l.value}
            lang={l.value}
            onClick={() => setUiLang(l.value)}
            className={`flex h-16 flex-col items-center justify-center gap-0.5 rounded-xl border ${
              lang === l.value ? "border-ink" : "border-ink/15"
            }`}
          >
            <span className="text-[17px] font-semibold">{l.label}</span>
            <span className="label text-[9px] text-muted">{l.hint}</span>
          </button>
        ))}
      </div>
      <p className="text-[12px] text-muted">
        {t("Menus, buttons and messages. Your notes, books and news stay in the language they’re written in.")}
      </p>
    </Section>
  );
}

function AccountRow() {
  const { user, sync } = useAccount();
  const [profile] = useStore(getProfile, { id: "me", updatedAt: 0 });
  const t = useT();
  return (
    <Link href="/account" className="mt-5 flex items-center gap-3.5 rounded-2xl bg-card p-4">
      <Avatar size={48} />
      <span className="flex min-w-0 grow flex-col gap-0.5">
        <span className="truncate text-[16px] font-semibold">{profile.name || t("Your profile")}</span>
        <span className="label truncate text-[10px] text-muted">
          {user
            ? `${user.email ?? t("Signed in")} · ${sync.state === "error" ? t("sync problem") : t("synced")}`
            : t("Not signed in · this device only")}
        </span>
      </span>
      <span className="label text-[10px] underline">{user ? t("Account") : t("Sign in")}</span>
    </Link>
  );
}
