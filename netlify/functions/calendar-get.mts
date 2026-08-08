import type { Config } from "@netlify/functions";
import { readUpcomingCalendarEvents } from "../lib/calendar.mjs";

function json(value: unknown, status = 200, cache = "public, max-age=60, s-maxage=300, stale-while-revalidate=900") {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      "Cache-Control": cache,
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}

export default async function handler(request: Request) {
  if (request.method !== "GET") {
    return json({ message: "Method not allowed." }, 405, "no-store");
  }

  try {
    const result = await readUpcomingCalendarEvents();
    return json({ ...result, updatedAt: new Date().toISOString() });
  } catch (error) {
    console.error("Could not refresh the public calendar", error);
    return json(
      { configured: true, events: [], message: "Schedule refresh temporarily unavailable." },
      503,
      "no-store",
    );
  }
}

export const config = {
  path: "/api/calendar",
  method: "GET",
  rateLimit: {
    action: "rate_limit",
    aggregateBy: "ip",
    windowSize: 60,
    windowLimit: 120,
  },
} satisfies Config;
