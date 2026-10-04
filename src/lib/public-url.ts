import "server-only";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

// For addresses that come from the visitor (a feed, a story's picture): only
// public http(s) hosts may be fetched, never local or private ones.

function privateIp(ip: string): boolean {
  if (ip.includes(":")) {
    const v = ip.toLowerCase();
    if (v.startsWith("::ffff:")) return privateIp(v.slice(7));
    return v === "::1" || v === "::" || /^f[cd]/.test(v) || /^fe[89ab]/.test(v);
  }
  const [a, b] = ip.split(".").map(Number);
  return (
    a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 198 && (b === 18 || b === 19)) || a >= 224
  );
}

export async function publicUrl(raw: string): Promise<URL | null> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (url.username || url.password) return null;
  if (url.port && url.port !== "80" && url.port !== "443") return null;
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal")) return null;
  const addrs = isIP(host) ? [{ address: host }] : await lookup(host, { all: true }).catch(() => []);
  if (!addrs.length || addrs.some((a) => privateIp(a.address))) return null;
  return url;
}

/**
 * Fetches a visitor-given address, checking every redirect again and
 * stopping at `maxBytes`. Null when it isn't public, fails or is too big.
 */
export async function fetchPublic(
  raw: string,
  maxBytes: number,
  init: RequestInit = {},
): Promise<{ bytes: Buffer; type: string } | null> {
  let next = raw;
  for (let hop = 0; hop < 4; hop++) {
    const url = await publicUrl(next);
    if (!url) return null;
    const res = await fetch(url, { ...init, redirect: "manual", signal: AbortSignal.timeout(10000) }).catch(() => null);
    if (!res) return null;
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      next = new URL(res.headers.get("location")!, url).href;
      continue;
    }
    if (!res.ok || !res.body) return null;
    // Stop reading past the size limit.
    const reader = res.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > maxBytes) {
        reader.cancel().catch(() => {});
        return null;
      }
      chunks.push(value);
    }
    return { bytes: Buffer.concat(chunks), type: res.headers.get("content-type") ?? "" };
  }
  return null;
}
