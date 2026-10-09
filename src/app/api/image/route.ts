import { fetchPublic } from "@/lib/public-url";

// A story's picture, for the website's share cards (lib/quote-card.ts): a
// canvas can only be saved with pictures the page was allowed to read, and
// most news sites don't allow that. Used by this site's own pages only, for
// public http(s) hosts, pictures only, with a size and time limit.

const MAX_BYTES = 6_000_000;
const TYPES = /^image\/(jpeg|png|webp|avif|gif)\b/;

export async function GET(request: Request) {
  // Browsers say where a request comes from; other sites can't use this.
  const site = request.headers.get("sec-fetch-site");
  if (site && site !== "same-origin") return new Response(null, { status: 403 });
  const url = new URL(request.url).searchParams.get("url") ?? "";
  if (!url || url.length > 2000) return new Response(null, { status: 400 });
  const got = await fetchPublic(url, MAX_BYTES, {
    headers: { "user-agent": "Mozilla/5.0 (compatible; Stack/0.1; share card)", accept: "image/*" },
    next: { revalidate: 3600 },
  });
  if (!got || !TYPES.test(got.type)) return new Response(null, { status: 404 });
  return new Response(new Uint8Array(got.bytes), {
    headers: {
      "content-type": got.type,
      "x-content-type-options": "nosniff",
      "content-security-policy": "default-src 'none'; sandbox",
      "cache-control": "public, max-age=3600, s-maxage=86400",
    },
  });
}
