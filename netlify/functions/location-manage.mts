import type { Config } from "@netlify/functions";
import {
  clearLocation,
  clearSessionCookie,
  hasValidSession,
  isPasswordConfigured,
  isSameOrigin,
  json,
  publishLocation,
  readStoredLocation,
  validatePublishInput,
} from "../lib/location.mjs";

export default async function handler(request: Request) {
  if (request.method !== "GET" && request.method !== "POST") {
    return json({ message: "Method not allowed." }, 405, { Allow: "GET, POST" });
  }

  if (!isPasswordConfigured()) {
    return json({ message: "The shared password has not been configured." }, 503);
  }
  if (!hasValidSession(request)) {
    return json({ authenticated: false, message: "Sign in to continue." }, 401);
  }

  if (request.method === "GET") {
    try {
      const { location, expired } = await readStoredLocation();
      return json({ authenticated: true, location, expired });
    } catch (error) {
      console.error("Could not read the admin location", error);
      return json({ message: "Location service unavailable." }, 503);
    }
  }

  if (!isSameOrigin(request)) {
    return json({ message: "This request was not accepted." }, 403);
  }

  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > 8_192) return json({ message: "This request was too large." }, 413);

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return json({ message: "This request was not understood." }, 400);
  }

  if (body.action === "logout") {
    return json(
      { authenticated: false },
      200,
      { "Set-Cookie": clearSessionCookie() },
    );
  }

  if (body.action === "clear") {
    try {
      await clearLocation();
      return json({ cleared: true, location: null });
    } catch (error) {
      console.error("Could not clear the live location", error);
      return json({ message: "Could not remove the live location." }, 503);
    }
  }

  if (body.action === "publish") {
    try {
      const location = validatePublishInput(body);
      await publishLocation(location);
      return json({ published: true, location });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not publish the live location.";
      const status = message.includes("invalid") ? 400 : 503;
      if (status === 503) console.error("Could not publish the live location", error);
      return json({ message }, status);
    }
  }

  return json({ message: "Choose publish, clear, or logout." }, 400);
}

export const config = {
  path: "/api/location/manage",
  method: ["GET", "POST"],
  rateLimit: {
    action: "rate_limit",
    aggregateBy: "ip",
    windowSize: 60,
    windowLimit: 60,
  },
} satisfies Config;
