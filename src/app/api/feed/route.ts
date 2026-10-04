import { readFeed } from "@/lib/news";
import { fetchPublic } from "@/lib/public-url";

// Reads a feed for the website's "My feeds". The address comes from the
// visitor, so only public http(s) hosts are fetched (no local or private
// addresses, checked again on every redirect), with a size and time limit.

const MAX_BYTES = 2_000_000;

async function getText(raw: string, fresh: boolean): Promise<string | null> {
  const got = await fetchPublic(raw, MAX_BYTES, {
    ...(fresh ? { cache: "no-store" as const } : { next: { revalidate: 600 } }),
    headers: { "user-agent": "Mozilla/5.0 (compatible; Stack/0.1; feed reader)", accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, text/html;q=0.8" },
  });
  return got && new TextDecoder().decode(got.bytes);
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const url = params.get("url") ?? "";
  const fresh = params.get("fresh") === "1";
  if (!url || url.length > 2000) return Response.json({ error: "bad url" }, { status: 400 });
  const found = await readFeed(url, (u) => getText(u, fresh));
  if (!found) return Response.json({ error: "no feed" }, { status: 404 });
  return Response.json(found, {
    headers: { "cache-control": fresh ? "no-store" : "public, s-maxage=600, stale-while-revalidate=1200" },
  });
}
