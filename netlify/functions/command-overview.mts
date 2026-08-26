import type { Config } from "@netlify/functions";
import { readUpcomingCalendarEvents } from "../lib/calendar.mjs";
import { readEventPlannerState } from "../lib/events.mjs";
import { getFacebookAdminStatus } from "../lib/facebook.mjs";
import { hasValidSession, isPasswordConfigured, json, readStoredLocation } from "../lib/location.mjs";
import { readMenuState } from "../lib/menu.mjs";

export default async function handler(request: Request) {
  if (request.method !== "GET") {
    return json({ message: "Method not allowed." }, 405, { Allow: "GET" });
  }
  if (!isPasswordConfigured()) {
    return json({ message: "The shared staff password has not been configured." }, 503);
  }
  if (!hasValidSession(request)) {
    return json({ authenticated: false, message: "Sign in to continue." }, 401);
  }

  try {
    const [locationResult, facebook, menu, planner, calendar] = await Promise.all([
      readStoredLocation(),
      getFacebookAdminStatus(),
      readMenuState(),
      readEventPlannerState(),
      readUpcomingCalendarEvents({ limit: 12 }).catch(() => ({ configured: true, events: [] })),
    ]);
    return json({
      authenticated: true,
      location: locationResult.location,
      locationExpired: locationResult.expired,
      facebook,
      menu,
      planner,
      calendar,
      refreshedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Could not load the command center", error);
    return json({ message: "The command center is temporarily unavailable." }, 503);
  }
}

export const config = {
  path: "/api/command/overview",
  method: "GET",
  rateLimit: {
    action: "rate_limit",
    aggregateBy: "ip",
    windowSize: 60,
    windowLimit: 90,
  },
} satisfies Config;
