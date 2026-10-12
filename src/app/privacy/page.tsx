import type { Metadata } from "next";
import Link from "next/link";
import { PolicyPage, PolicySection } from "@/components/policy-page";

export const metadata: Metadata = {
  title: "Privacy · Stack",
  description: "What Stack stores, where it goes, and how to delete it.",
};

const CONTACT = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "hello@stackforge.in";
const AI_ENGINE = process.env.NEXT_PUBLIC_AI_ENGINE || "our AI provider";

export default function Privacy() {
  return (
    <PolicyPage title="PRIVACY" updated="11 October 2026">
      <p>
        Stack is a reading and notes app made by StackForge Labs. Reading, notes, highlights and PDFs work fully on your device without an account; Stack AI needs one.
        This page explains what Stack stores, what leaves your device, and how to delete it.
      </p>

      <PolicySection title="On your device">
        <p>
          Your notes, highlights, saved articles, PDFs, playlists, focus history, reading stats, offline copies of
          articles and profile are stored inside Stack on your phone or in your browser. Nobody else can see them,
          including us.
        </p>
      </PolicySection>

      <PolicySection title="If you sign in (optional)">
        <p>
          Signing in with Google or an email address turns on sync and Stack AI. We then store your <b>email address</b>,{" "}
          <b>name and photo</b> (from Google, which you can change), and the things you choose to keep in Stack: notes,
          highlights, saved articles, playlists, focus history, your profile and, where available, PDF files. They
          are stored in Supabase and are sent over encrypted connections.
        </p>
      </PolicySection>

      <PolicySection title="AI features (signed in, optional)">
        <p>
          Stack AI is available when you’re signed in. When you use Summarize, Explain, Ask this PDF, Ask your Stack or
          Tidy note, the text needed for that request is sent through Stack’s server to {AI_ENGINE} to produce the
          answer. Your account is used only to apply a daily limit per person; we keep a count of requests per day,
          not the requests themselves. Stack asks before the first use of each feature, and you can turn Stack AI off
          completely in Settings. We don’t use your content to train models and don’t sell it.
        </p>
      </PolicySection>

      <PolicySection title="News and music">
        <p>
          News is fetched from public news sites and feeds. If you turn on breaking-news alerts, Stack checks those
          feeds in the background; nothing about you is sent. Music on your phone is played from your phone.
        </p>
        <p>
          Video news plays in YouTube’s privacy-enhanced player: when you play a video, your device loads it from
          YouTube (Google), and Google’s privacy policy applies to that request.
        </p>
        <p>
          To show which Indian news channels are live and what’s trending in India, Stack reads those channels’ public
          YouTube pages and Google Trends’ public feed (on the website, through our server, which keeps no record).
          Nothing about you is sent with them. YouTube channels you add are kept in Stack and synced if you’re signed in.
        </p>
        <p>
          Listen mode reads articles and PDFs aloud with your phone’s own text-to-speech; the text stays on your device.
        </p>
      </PolicySection>

      <PolicySection title="Word meanings">
        <p>
          When you tap Meaning on a word, that word (and nothing else) is sent from your device to Wiktionary for its
          English definition and to MyMemory for its Hindi meaning. Their privacy policies apply to those requests.
          When you translate a news story, its title and text are sent from your device to Google Translate (or to
          MyMemory if Google can’t be reached) and the translation comes straight back.
          Share cards are drawn on your device and go only to the app you choose to share them with. On the website,
          a news story’s picture may be fetched for its card through our server, which keeps no record of it.
        </p>
      </PolicySection>

      <PolicySection title="Telegram (optional)">
        <p>
          If you connect a Telegram bot to import PDFs, its token is stored only on your device (it isn’t synced or
          put in backups). Stack talks to Telegram directly to list and download the PDFs you forward to that bot; we
          never see them. Telegram’s privacy policy applies to your bot and chats. Disconnect removes the token.
        </p>
      </PolicySection>

      <PolicySection title="Visitor count">
        <p>
          Once a day, Stack tells our server that it was opened: a random id made on your device, whether it’s the
          app or the website, the app version and whether you’re signed in. Without an account, that’s all: it isn’t
          linked to you, your phone or your IP address. If you’re signed in, the visit is also linked to your account,
          so we can see which accounts use the Android app or the website and when they last opened Stack. Nothing you
          read or write is sent. Deleting your account removes that link.
        </p>
      </PolicySection>

      <PolicySection title="What we don’t do">
        <ul className="list-disc pl-5">
          <li>No ads and no advertising trackers.</li>
          <li>We don’t sell or share your data with anyone for marketing.</li>
          <li>We only use what’s described above to run Stack.</li>
        </ul>
      </PolicySection>

      <PolicySection title="Your choices">
        <ul className="list-disc pl-5">
          <li>Export everything: Settings → Backup. Export notes as Markdown: Notes → ⬇.</li>
          <li>
            Delete your account and all synced data: Account → Delete account, or see{" "}
            <Link href="/delete-account" className="underline">
              how to delete your account
            </Link>
            .
          </li>
          <li>Remove Stack’s data from a device: sign out and choose “remove from this phone”, or uninstall Stack.</li>
        </ul>
      </PolicySection>

      <PolicySection title="Contact">
        <p>
          Questions or requests: <a href={`mailto:${CONTACT}`} className="underline">{CONTACT}</a>. We reply within 7
          days.
        </p>
      </PolicySection>
    </PolicyPage>
  );
}
