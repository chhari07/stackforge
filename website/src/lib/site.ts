// Public facts about the site. Nothing here is secret: it's all shown on the page.
export const SITE = {
  name: "Stack",
  maker: "StackForge Labs",
  url: process.env.NEXT_PUBLIC_SITE_URL || "https://stackforge.in",
  tagline: "Stack makes you remember what you read.",
  line: "Stack makes you remember what you read.",
  email: process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "hello@stackforge.in",
  github: "https://github.com/chhari07/stackforge",
  // The Android app (APK) on Google Drive, until the Play Store release.
  apk: "https://drive.google.com/file/d/1lhGlMl2OPOuB-eqHuNlJUW8HXmqYo6uX/view?usp=sharing",
};
