import type { Config } from "@netlify/functions";
import {
  clearSessionCookie,
  hasValidSession,
  isPasswordConfigured,
  isSameOrigin,
  json,
} from "../lib/location.mjs";
import { createEventTemplate, readEventPlannerState, saveEventPlannerState } from "../lib/events.mjs";

export default async function handler(request: Request) {
  if (request.method !== "GET" && request.method !== "POST") {
    return json({ message: "Method not allowed." }, 405, { Allow: "GET, POST" });
  }
  if (!isPasswordConfigured()) return json({ message: "The shared staff password has not been configured." }, 503);
  if (!hasValidSession(request)) return json({ authenticated: false, message: "Sign in to continue." }, 401);

  if (request.method === "GET") {
    try {
      return json({ authenticated: true, planner: await readEventPlannerState() });
    } catch (error) {
      console.error("Could not load event planner", error);
      return json({ message: "Event planner temporarily unavailable." }, 503);
    }
  }

  if (!isSameOrigin(request)) return json({ message: "This request was not accepted." }, 403);
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > 320_000) return json({ message: "This request was too large." }, 413);

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return json({ message: "This request was not understood." }, 400);
  }

  if (body.action === "logout") return json({ authenticated: false }, 200, { "Set-Cookie": clearSessionCookie() });
  if (body.action === "template") return json({ event: createEventTemplate(body.template) });
  if (body.action !== "save") return json({ message: "Choose save, template, or logout." }, 400);

  try {
    const planner = await saveEventPlannerState(body.planner, body.expectedRevision);
    return json({ saved: true, planner });
  } catch (error) {
    if (error instanceof Error && error.message === "EVENTS_CHANGED") {
      return json({ message: "The planner changed on another device. Reload before saving again." }, 409);
    }
    console.error("Could not save event planner", error);
    return json({ message: "Could not save the event planner." }, 503);
  }
}

export const config = {
  path: "/api/event-planner/manage",
  method: ["GET", "POST"],
  rateLimit: { action: "rate_limit", aggregateBy: "ip", windowSize: 60, windowLimit: 90 },
} satisfies Config;
