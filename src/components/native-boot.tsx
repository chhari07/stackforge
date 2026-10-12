"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { App } from "@capacitor/app";
import { registerPlugin } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import { isNative } from "@/lib/platform";
import { countPage } from "@/lib/nav";
import { importShared, RESULT_KEY, resultTitle, ShareIn, type ShareResult } from "@/lib/share-in";
import { useToast } from "./toast";
import { scheduleDigest, scheduleNoteReminders } from "@/lib/reminders";
import { applyNewsAlerts, importAlertSaves, NewsAlertsNative } from "@/lib/news-alerts";
import { applyTheme, watchSystemTheme } from "@/lib/theme";
import { subscribe } from "@/lib/db";
import { updateWidget } from "@/lib/widget";
import { checkInBackground } from "@/lib/telegram";
import { countVisit } from "@/lib/visit";
import { tr, useUiLang } from "@/lib/i18n";

const Splash = registerPlugin<{ hide(): Promise<void> }>("Splash");

// Android-app-only startup work: open the right screen when a notification is
// tapped, and refresh tomorrow's digest text.
export function NativeBoot() {
  const router = useRouter();
  const path = usePathname();
  const toast = useToast();

  useEffect(() => countPage(path), [path]);

  // Notifications speak the app's language: when it changes, write the
  // scheduled ones again and give the news alerts their new words.
  const lang = useUiLang();
  const firstLang = useRef(true);
  useEffect(() => {
    if (firstLang.current) {
      firstLang.current = false; // start-up does this below
      return;
    }
    if (!isNative()) return;
    applyNewsAlerts().catch(() => {});
    scheduleDigest().catch(() => {});
    scheduleNoteReminders().catch(() => {});
  }, [lang]);

  // Theme: status bar colour, and follow the phone in "system" mode (web too).
  useEffect(() => {
    applyTheme();
    return watchSystemTheme();
  }, []);

  // Anonymous daily visitor count (no personal info: see lib/visit.ts), once
  // the first screen has settled. Also when Stack comes back on a new day.
  useEffect(() => {
    const timer = setTimeout(countVisit, 4000);
    const onVisible = () => document.visibilityState === "visible" && countVisit();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  // Telegram import: collect PDFs forwarded to the bot when Stack opens or
  // comes back, before Telegram drops them (it keeps them about a day).
  useEffect(() => {
    const run = () =>
      checkInBackground()
        .then((n) => {
          if (n) toast({ text: `${n} new PDF${n === 1 ? "" : "s"} from Telegram`, href: "/library" });
        })
        .catch(() => {});
    const timer = setTimeout(run, 3000); // after the first screen settles
    const onVisible = () => document.visibilityState === "visible" && run();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [toast]);

  useEffect(() => {
    if (!isNative()) return;
    // First screen is painted: let the native splash go (next frame, so it's on screen).
    requestAnimationFrame(() => Splash.hide().catch(() => {}));
    const sub = LocalNotifications.addListener("localNotificationActionPerformed", ({ notification }) => {
      const href = notification.extra?.href;
      if (typeof href === "string" && href.startsWith("/")) router.push(href);
    });
    // Breaking-news alerts open com.chhari.stack://open?href=/read?id=…
    const openLink = (url?: string) => {
      if (!url?.startsWith("com.chhari.stack://open")) return;
      const href = new URL(url).searchParams.get("href");
      if (href?.startsWith("/")) router.push(href);
    };
    const opened = App.addListener("appUrlOpen", ({ url }) => openLink(url));
    App.getLaunchUrl()
      .then((l) => {
        // Only once per launch, not again after a reload.
        if (!l?.url || sessionStorage.getItem("stack.launch-url") === l.url) return;
        sessionStorage.setItem("stack.launch-url", l.url);
        openLink(l.url);
      })
      .catch(() => {});
    applyNewsAlerts().catch(() => {});
    scheduleDigest().catch(() => {});

    // Home screen widget, note reminders and the daily highlights: refresh now,
    // and a moment after anything is saved.
    updateWidget().catch(() => {});
    scheduleNoteReminders().catch(() => {});
    let widgetTimer: ReturnType<typeof setTimeout>;
    const offWidget = subscribe(() => {
      clearTimeout(widgetTimer);
      widgetTimer = setTimeout(() => {
        updateWidget().catch(() => {});
        scheduleNoteReminders().catch(() => {});
        scheduleDigest(undefined, { withNews: false }).catch(() => {});
      }, 1500);
    });

    // Share to Stack: import what the share card saved, at launch, when Stack
    // comes back to the front, and when a share arrives while it's open.
    // One import at a time, so an item is never saved twice.
    let busy = Promise.resolve();
    const importInbox = () => {
      busy = busy.then(async () => {
        const { items, open } = await ShareIn.takeInbox().catch(() => ({ items: [], open: false }));
        let last: ShareResult | null = null;
        for (const item of items) {
          last = await importShared(item);
          // Confirm each one as it's saved, so none is lost or saved twice.
          await ShareIn.ackInbox({ count: 1 }).catch(() => {});
        }
        if (open && last) {
          sessionStorage.setItem(RESULT_KEY, JSON.stringify(last));
          router.push(`/share?t=${Date.now()}`);
        } else if (last && last.kind !== "error") {
          toast({
            text:
              items.length > 1
                ? tr("{n} items saved from other apps", { n: items.length })
                : tr("Saved “{title}”", { title: resultTitle(last) }),
            href: last.kind === "note" ? "/notes" : "/library",
          });
        }
      });
    };
    importInbox();
    const shared = ShareIn.addListener("shared", importInbox);

    // "Save for later" on a news alert: add those stories to the Library
    // (card now, full story for offline reading next).
    const importSaves = () =>
      importAlertSaves()
        .then((n) => {
          if (n) toast({ text: n === 1 ? tr("Saved to your Library") : tr("{n} stories saved to your Library", { n }), href: "/library" });
        })
        .catch(() => {});
    importSaves();
    const alertSaved = NewsAlertsNative.addListener("saved", importSaves);
    const resumed = App.addListener("resume", () => {
      importInbox();
      importSaves();
    });
    return () => {
      clearTimeout(widgetTimer);
      offWidget();
      sub.then((s) => s.remove());
      opened.then((s) => s.remove());
      shared.then((s) => s.remove());
      alertSaved.then((s) => s.remove());
      resumed.then((s) => s.remove());
    };
  }, [router, toast]);

  return null;
}
