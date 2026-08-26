import type { Config } from "@netlify/functions";
import { readUpcomingCalendarEvents } from "../lib/calendar.mjs";
import { createEventTemplate, readEventPlannerState } from "../lib/events.mjs";
import { getFacebookAdminStatus } from "../lib/facebook.mjs";
import { hasValidSession, isPasswordConfigured, json, readStoredLocation } from "../lib/location.mjs";
import { getDefaultMenuState, readMenuState } from "../lib/menu.mjs";

function reviewOverview() {
  const now = new Date();
  const start = new Date(now.getTime() + 3 * 86_400_000);
  start.setHours(18, 0, 0, 0);
  const end = new Date(start.getTime() + 3 * 3_600_000);
  const menu = getDefaultMenuState();
  menu.products.find((product) => product.id === "broccoli-cheddar")!.available = false;
  const event = createEventTemplate("2590");
  event.id = "review-2590";
  event.eventDate = start.toISOString().slice(0, 10);
  return {
    authenticated: true,
    reviewDemo: true,
    location: null,
    locationExpired: false,
    facebook: {
      configured: true,
      state: "ready",
      message: "Connected — the next live pin will post automatically.",
      canRetry: false,
      requiresConfirmation: false,
      lastAction: "",
    },
    menu,
    planner: { version: 1, revision: 1, updatedAt: now.toISOString(), events: [event] },
    calendar: {
      configured: true,
      events: [{
        id: "review-upcoming-stop",
        title: "2590 Food Truck Park",
        location: "2590 Food Truck Park",
        start: start.toISOString(),
        end: end.toISOString(),
        allDay: false,
        detailsUrl: null,
        detailsLabel: null,
      }],
    },
    refreshedAt: now.toISOString(),
  };
}

export default async function handler(request: Request) {
  if (request.method !== "GET") {
    return json({ message: "Method not allowed." }, 405, { Allow: "GET" });
  }
  const url = new URL(request.url);
  const isDeployPreview = process.env.CONTEXT === "deploy-preview" || url.hostname.startsWith("deploy-preview-");
  if (!isPasswordConfigured() && isDeployPreview) {
    return json(reviewOverview());
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
