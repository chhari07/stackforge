"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { App } from "@capacitor/app";
import { registerPlugin } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import { isNative } from "@/lib/platform";
import { countPage } from "@/lib/nav";
import { importShared, RESULT_KEY, resultTitle, ShareIn, type ShareResult } from "@/lib/share-in";
import { useToast } from "./toast";
import { scheduleDigest, scheduleNoteReminders } from "@/lib/reminders";
import { applyNewsAlerts } from "@/lib/news-alerts";
import { applyTheme, watchSystemTheme } from "@/lib/theme";
import { subscribe } from "@/lib/db";
import { updateWidget } from "@/lib/widget";
import { checkInBackground } from "@/lib/telegram";
import { tr } from "@/lib/i18n";

const Splash = registerPlugin<{ hide(): Promise<void> }>("Splash");

// Android-app-only startup work: open the right screen when a notification is
// tapped, and refresh tomorrow's digest text.
export function NativeBoot() {
  const router = useRouter();
  const path = usePathname();
  const toast = useToast();

  useEffect(() => countPage(path), [path]);

  // Theme: status bar colour, and follow the phone in "system" mode (web too).
  useEffect(() => {
    applyTheme();
    return watchSystemTheme();
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

    // Home screen widget and note reminders: refresh now, and a moment after anything is saved.
    updateWidget().catch(() => {});
    scheduleNoteReminders().catch(() => {});
    let widgetTimer: ReturnType<typeof setTimeout>;
    const offWidget = subscribe(() => {
      clearTimeout(widgetTimer);
      widgetTimer = setTimeout(() => {
        updateWidget().catch(() => {});
        scheduleNoteReminders().catch(() => {});
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
    const resumed = App.addListener("resume", importInbox);
    return () => {
      clearTimeout(widgetTimer);
      offWidget();
      sub.then((s) => s.remove());
      opened.then((s) => s.remove());
      shared.then((s) => s.remove());
      resumed.then((s) => s.remove());
    };
  }, [router, toast]);

  return null;
}
