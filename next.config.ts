import type { NextConfig } from "next";
import pkg from "./package.json";

// `STACK_TARGET=apk next build` makes a static bundle for the Android app
// (see build-apk.sh). The app has no server, so API routes (route.ts) are left
// out by only treating .tsx files as routes; the app fetches news itself.
const apk = process.env.STACK_TARGET === "apk";
// The app version the visitor count reports (lib/visit.ts).
const env = { NEXT_PUBLIC_STACK_VERSION: pkg.version };

const nextConfig: NextConfig = apk
  ? {
      output: "export",
      pageExtensions: ["tsx"],
      images: { unoptimized: true },
      env,
    }
  : { env };

export default nextConfig;
