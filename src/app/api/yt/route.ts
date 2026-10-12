import { allowedYtUrl } from "@/lib/live";

// The website's way to read YouTube channel pages and feeds and Google Trends
// for Live and Trending (lib/live.ts); browsers can't fetch them directly.
// Only those exact addresses are allowed. The Android app reads them itself.
export async function GET(request: Request) {
  const url = new URL(request.url).searchParams.get("url") ?? "";
  if (!allowedYtUrl(url)) return new Response("not allowed", { status: 400 });
  // Live status changes often; channel feeds and trends less.
  const live = /\/live$/.test(url);
  try {
    const res = await fetch(url, {
      next: { revalidate: live ? 300 : 900 },
      headers: {
        "user-agent": "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0 Mobile Safari/537.36",
        "accept-language": "en-IN,en;q=0.9,hi;q=0.8",
      },
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return new Response("upstream failed", { status: 502 });
    return new Response(await res.text(), {
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "cache-control": `public, s-maxage=${live ? 300 : 900}, stale-while-revalidate=600`,
      },
    });
  } catch {
    return new Response("upstream failed", { status: 502 });
  }
}
