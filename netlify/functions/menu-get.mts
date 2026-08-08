import type { Config } from "@netlify/functions";
import { readMenuState } from "../lib/menu.mjs";

export default async function handler(request: Request) {
  if (request.method !== "GET") {
    return Response.json({ message: "Method not allowed." }, { status: 405, headers: { Allow: "GET" } });
  }

  try {
    const menu = await readMenuState();
    return Response.json(menu, {
      headers: {
        "Cache-Control": "public, max-age=2, s-maxage=5, stale-while-revalidate=30",
        "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
        "Referrer-Policy": "no-referrer",
        "X-Content-Type-Options": "nosniff",
        "X-Robots-Tag": "noindex, nofollow",
      },
    });
  } catch (error) {
    console.error("Could not load the menu board", error);
    return Response.json(
      { message: "Menu board temporarily unavailable." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}

export const config = {
  path: "/api/menu",
  method: "GET",
  rateLimit: {
    action: "rate_limit",
    aggregateBy: "ip",
    windowSize: 60,
    windowLimit: 180,
  },
} satisfies Config;
