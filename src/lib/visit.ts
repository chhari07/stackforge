"use client";

// Visitor count: once a day, tell the server "this device opened Stack today"
// (public.visit() in supabase/schema.sql). The device id is random, made here on
// first launch. Without sign-in that's all; when you're signed in, the server
// also notes your account (from the sign-in itself), so the owner's dashboard
// can show which accounts use the app or the website. No content or IP is sent.
import { cloud, sessionUser } from "./cloud";
import { isNative } from "./platform";

const ID_KEY = "stack.visit.id";
const DAY_KEY = "stack.visit.day"; // last UTC day the server took a visit (":in" when signed in)
const VERSION = process.env.NEXT_PUBLIC_STACK_VERSION ?? "";

const utcDay = () => new Date().toISOString().slice(0, 10);

function deviceId() {
  let id = localStorage.getItem(ID_KEY);
  if (!id) {
    id =
      typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) =>
            (+c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (+c / 4)))).toString(16),
          );
    localStorage.setItem(ID_KEY, id);
  }
  return id;
}

// Stack running on this computer (npm run dev, or a test browser) is a local
// test, not a website visitor: the dashboard shows it apart as "Local test".
function isLocalTest() {
  const host = location.hostname;
  return (
    process.env.NODE_ENV === "development" ||
    host === "localhost" ||
    host.endsWith(".localhost") ||
    /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host) ||
    host === "[::1]"
  );
}

export async function countVisit() {
  const db = cloud();
  if (!db) return;
  try {
    const today = utcDay();
    const sent = localStorage.getItem(DAY_KEY);
    // Once a day, and once more if you sign in later that day.
    if (sent === `${today}:in`) return;
    const signedIn = !!(await sessionUser());
    if (sent === today && !signedIn) return;
    const { error } = await db.rpc("visit", {
      device: deviceId(),
      platform: isNative() ? "android" : isLocalTest() ? "local" : "web",
      signed_in: signedIn,
      version: VERSION,
    });
    if (!error) localStorage.setItem(DAY_KEY, signedIn ? `${today}:in` : today);
  } catch {
    // Offline or not set up: try again next launch.
  }
}
