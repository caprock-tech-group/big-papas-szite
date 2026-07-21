import type { Config } from "@netlify/functions";
import {
  facebookCloseFinished,
  getFacebookAdminStatus,
  retryFacebookAutomation,
  syncFacebookClosed,
  syncFacebookOpen,
} from "../lib/facebook.mjs";
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
      const [{ location, expired }, facebook] = await Promise.all([
        readStoredLocation(),
        getFacebookAdminStatus(),
      ]);
      return json({ authenticated: true, location, expired, facebook });
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
      const { location } = await readStoredLocation();
      if (location) {
        await publishLocation({ ...location, expiresAt: new Date().toISOString() });
      }
      const facebook = await syncFacebookClosed(location?.updatedAt);
      if (facebookCloseFinished(facebook)) await clearLocation();
      return json({ cleared: true, location: null, facebook });
    } catch (error) {
      console.error("Could not clear the live location", error);
      return json({ message: "Could not remove the live location." }, 503);
    }
  }

  if (body.action === "publish") {
    try {
      const previous = await readStoredLocation();
      const location = validatePublishInput(body);
      await publishLocation(location);
      const facebook = await syncFacebookOpen(location, {
        reuseExistingPost: Boolean(previous.location && !previous.expired),
      });
      return json({ published: true, location, facebook });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not publish the live location.";
      const status = message.includes("invalid") ? 400 : 503;
      if (status === 503) console.error("Could not publish the live location", error);
      return json({ message }, status);
    }
  }

  if (body.action === "retryFacebook") {
    try {
      const { location, expired } = await readStoredLocation();
      const facebook = await retryFacebookAutomation(
        location,
        expired,
        body.confirmedNoPost === true,
      );
      if (expired && facebookCloseFinished(facebook)) await clearLocation();
      return json({ retried: true, location: expired ? null : location, expired, facebook });
    } catch (error) {
      console.error("Could not retry the Facebook update", error);
      return json({ message: "Could not retry the Facebook update." }, 503);
    }
  }

  return json({ message: "Choose publish, clear, retry Facebook, or logout." }, 400);
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
