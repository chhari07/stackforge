import type { Metadata, Viewport } from "next";
import { Archivo, Bodoni_Moda, IBM_Plex_Mono } from "next/font/google";
import { ToastProvider } from "@/components/toast";
import { NativeBoot } from "@/components/native-boot";
import { LocalMusicProvider } from "@/components/local-music-provider";
import { OnlineMusicProvider } from "@/components/online-music-provider";
import { FocusProvider } from "@/components/focus-provider";
import { AccountProvider } from "@/components/account-provider";
import { FirstRun } from "@/components/first-run";
import { StatusScrim } from "@/components/status-scrim";
import { THEME_BOOT } from "@/lib/theme-boot";
import "./globals.css";

const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  axes: ["wdth"],
});

const bodoni = Bodoni_Moda({
  variable: "--font-bodoni",
  subsets: ["latin"],
  style: ["normal", "italic"],
  axes: ["opsz"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "Stack",
  description: "Stack makes you remember what you read. Save → Highlight → Remember.",
};

export const viewport: Viewport = {
  themeColor: "#F7F5F0",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      // data-theme is set before hydration by THEME_BOOT.
      suppressHydrationWarning
      // Lets Next turn smooth scrolling off while it changes pages.
      data-scroll-behavior="smooth"
      className={`${archivo.variable} ${bodoni.variable} ${plexMono.variable} antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
      </head>
      <body>
        <LocalMusicProvider>
        <OnlineMusicProvider>
          <ToastProvider>
            <AccountProvider>
            <FocusProvider>
            <NativeBoot />
            <FirstRun />
            <StatusScrim />
            {/* One layout for phones and tablets: the column fills the screen. */}
            <div className="relative min-h-dvh w-full bg-paper pt-[env(safe-area-inset-top)]">
              {children}
            </div>
            </FocusProvider>
            </AccountProvider>
          </ToastProvider>
        </OnlineMusicProvider>
        </LocalMusicProvider>
      </body>
    </html>
  );
}
