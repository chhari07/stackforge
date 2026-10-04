"use client";

// Spotify Web API with the Authorization Code + PKCE flow. It runs fully in
// the browser, so there is no client secret. Tokens stay in localStorage.
import { Browser } from "@capacitor/browser";
import { isNative } from "./platform";
import { tr } from "./i18n";

// The Client ID can be built in (.env.local) or pasted in Settings at runtime,
// so the APK doesn't need a rebuild. It isn't a secret (PKCE has no secret).
// The Play build ships without a Client ID: Spotify only lets 25 people use a
// small app, so there it's "bring your own" (Settings → Spotify).
const BUILT_IN_ID = process.env.NEXT_PUBLIC_STACK_STORE === "play" ? "" : (process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID ?? "");
const ID_KEY = "stack.spotify.clientId";
const ID_EVENT = "stack-spotify-config";

export function clientId() {
  try {
    return localStorage.getItem(ID_KEY) || BUILT_IN_ID;
  } catch {
    return BUILT_IN_ID;
  }
}

export const isClientId = (id: string) => /^[0-9a-f]{32}$/i.test(id.trim());

export function setClientId(id: string | null) {
  if (id) localStorage.setItem(ID_KEY, id.trim());
  else localStorage.removeItem(ID_KEY);
  localStorage.removeItem(KEY); // tokens belong to the old app
  localStorage.removeItem(LOST);
  window.dispatchEvent(new Event(ID_EVENT));
}

export function onClientIdChange(fn: () => void) {
  window.addEventListener(ID_EVENT, fn);
  return () => window.removeEventListener(ID_EVENT, fn);
}
export const builtInConfigured = () => BUILT_IN_ID.length > 0;
const KEY = "stack.spotify";
const VERIFIER = "stack.spotify.verifier";
// Set when Spotify ended the login (not the user), so Stack can offer Reconnect.
const LOST = "stack.spotify.lost";
const SCOPES = [
  "user-read-playback-state",
  "user-modify-playback-state",
  "user-read-currently-playing",
  "user-read-recently-played",
  "playlist-read-private",
  "playlist-read-collaborative",
  "user-library-read",
  "streaming",
  "user-read-email",
  "user-read-private",
].join(" ");

type Tokens = { access: string; refresh: string; expiresAt: number };

export const spotifyConfigured = () => clientId().length > 0;
// The Android app logs in through the phone's browser, which hands the code
// back through this custom scheme (see AndroidManifest.xml).
export const APP_REDIRECT = "com.chhari.stack://callback";
const redirectUri = () => (isNative() ? APP_REDIRECT : `${window.location.origin}/music/callback`);

function readTokens(): Tokens | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Tokens) : null;
  } catch {
    return null;
  }
}

function saveTokens(t: { access_token: string; refresh_token?: string; expires_in: number }) {
  const prev = readTokens();
  const tokens: Tokens = {
    access: t.access_token,
    refresh: t.refresh_token ?? prev?.refresh ?? "",
    expiresAt: Date.now() + (t.expires_in - 60) * 1000,
  };
  localStorage.setItem(KEY, JSON.stringify(tokens));
  localStorage.removeItem(LOST);
  return tokens;
}

export const isConnected = () => readTokens() !== null;

export function disconnect() {
  localStorage.removeItem(KEY);
  localStorage.removeItem(LOST);
}

/** True when Spotify logged Stack out on its own; cleared by logging in or out. */
export function wasLoggedOut() {
  try {
    return localStorage.getItem(LOST) === "1";
  } catch {
    return false;
  }
}

const b64url = (bytes: ArrayBuffer | Uint8Array) =>
  btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

export async function login() {
  const verifier = b64url(crypto.getRandomValues(new Uint8Array(48)));
  const challenge = b64url(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)),
  );
  localStorage.setItem(VERIFIER, verifier);
  const params = new URLSearchParams({
    client_id: clientId(),
    response_type: "code",
    redirect_uri: redirectUri(),
    code_challenge_method: "S256",
    code_challenge: challenge,
    scope: SCOPES,
  });
  const url = `https://accounts.spotify.com/authorize?${params}`;
  if (isNative()) await Browser.open({ url });
  else window.location.href = url;
}

// Thrown when Spotify itself says the login is no longer valid (revoked,
// expired refresh token, changed Client ID). Only this logs the user out.
class LoginRevoked extends Error {}

async function tokenRequest(body: Record<string, string>) {
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: clientId(), ...body }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    if (data?.error === "invalid_grant" || data?.error === "invalid_client") {
      throw new LoginRevoked(data.error_description ?? data.error);
    }
    throw new Error(`Spotify token error ${res.status}`);
  }
  return saveTokens(await res.json());
}

export async function finishLogin(code: string) {
  const verifier = localStorage.getItem(VERIFIER);
  if (!verifier) throw new Error(tr("Login expired. Try connecting again."));
  localStorage.removeItem(VERIFIER);
  await tokenRequest({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri(),
    code_verifier: verifier,
  });
}

let refreshing: Promise<Tokens> | null = null;
/**
 * A valid access token, refreshed when needed. A failed refresh (offline,
 * Spotify hiccup) keeps the login so the next call can try again; only a
 * refresh token Spotify rejects logs out.
 */
export async function accessToken(force = false): Promise<string | null> {
  const t = readTokens();
  if (!t) return null;
  if (!force && Date.now() < t.expiresAt) return t.access;
  refreshing ??= tokenRequest({ grant_type: "refresh_token", refresh_token: t.refresh }).finally(
    () => {
      refreshing = null;
    },
  );
  try {
    return (await refreshing).access;
  } catch (e) {
    if (e instanceof LoginRevoked) {
      disconnect();
      localStorage.setItem(LOST, "1");
      return null;
    }
    throw new SpotifyError(0, "OFFLINE", tr("Couldn’t reach Spotify. Check your connection."));
  }
}

export class SpotifyError extends Error {
  constructor(
    public status: number,
    public reason: string,
    message: string,
  ) {
    super(message);
  }
}

// Spotify sometimes answers with plain text instead of JSON.
function parse(text: string) {
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
}

function errorMessage(status: number, text: string, data: { error?: { message?: string } } | null) {
  const msg = data?.error?.message ?? text.trim().slice(0, 200);
  // Since 2026 Spotify only serves development-mode apps whose owner has Premium.
  if (/premium/i.test(msg)) {
    return tr("Spotify needs the owner of this Spotify app (the Client ID in Settings → Spotify) to have Premium");
  }
  return msg || tr("Spotify error {status}", { status });
}

export async function api<T = unknown>(path: string, init: RequestInit = {}): Promise<T | null> {
  const send = async (force: boolean) => {
    const token = await accessToken(force);
    if (!token) throw new SpotifyError(401, "NO_TOKEN", tr("Not connected to Spotify"));
    try {
      return await fetch(`https://api.spotify.com/v1${path}`, {
        ...init,
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json", ...init.headers },
      });
    } catch {
      throw new SpotifyError(0, "OFFLINE", tr("Couldn’t reach Spotify. Check your connection."));
    }
  };
  let res = await send(false);
  // An access token can stop working before its expiry: get a new one and try once more.
  if (res.status === 401) res = await send(true);
  if (res.status === 204 || res.status === 202) return null;
  const text = await res.text();
  const data = parse(text);
  if (!res.ok) {
    throw new SpotifyError(res.status, data?.error?.reason ?? "", errorMessage(res.status, text, data));
  }
  return data as T;
}

// ---- Types for the parts of the API Stack uses ----
export type SpImage = { url: string; width: number | null };
export type SpTrack = {
  id: string;
  uri: string;
  name: string;
  duration_ms: number;
  artists: { name: string }[];
  album: { name: string; images: SpImage[] };
};
export type SpPlayer = {
  is_playing: boolean;
  progress_ms: number | null;
  item: SpTrack | null;
  device: { id: string | null; name: string };
  context: { uri: string; type: string } | null;
  repeat_state?: "off" | "context" | "track";
};
export type SpPlaylist = {
  id: string;
  uri: string;
  name: string;
  images: SpImage[] | null;
  tracks?: { total: number };
  items?: { total: number };
};

export const artists = (t: SpTrack) => t.artists.map((a) => a.name).join(", ");
export const art = (images?: SpImage[] | null, big = false) =>
  images && images.length ? (big ? images[0] : images[images.length - 1]).url : undefined;
