import type { Config } from "@netlify/functions";
import {
  clearSessionCookie,
  hasValidSession,
  isPasswordConfigured,
  isSameOrigin,
  json,
} from "../lib/location.mjs";
import { readMenuState, saveMenuState } from "../lib/menu.mjs";

export default async function handler(request: Request) {
  if (request.method !== "GET" && request.method !== "POST") {
    return json({ message: "Method not allowed." }, 405, { Allow: "GET, POST" });
  }
  if (!isPasswordConfigured()) {
    return json({ message: "The shared staff password has not been configured." }, 503);
  }
  if (!hasValidSession(request)) {
    return json({ authenticated: false, message: "Sign in to continue." }, 401);
  }

  if (request.method === "GET") {
    try {
      return json({ authenticated: true, menu: await readMenuState() });
    } catch (error) {
      console.error("Could not load the menu manager", error);
      return json({ message: "Menu manager temporarily unavailable." }, 503);
    }
  }

  if (!isSameOrigin(request)) {
    return json({ message: "This request was not accepted." }, 403);
  }
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > 96_000) return json({ message: "This request was too large." }, 413);

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return json({ message: "This request was not understood." }, 400);
  }

  if (body.action === "logout") {
    return json({ authenticated: false }, 200, { "Set-Cookie": clearSessionCookie() });
  }

  if (body.action === "save") {
    try {
      const menu = await saveMenuState(body.menu, body.expectedRevision);
      return json({ saved: true, menu });
    } catch (error) {
      if (error instanceof Error && error.message === "MENU_CHANGED") {
        return json(
          { message: "The menu changed on another device. Refresh before saving again." },
          409,
        );
      }
      console.error("Could not save the menu board", error);
      return json({ message: "Could not save the menu board." }, 503);
    }
  }

  return json({ message: "Choose save or logout." }, 400);
}

export const config = {
  path: "/api/menu/manage",
  method: ["GET", "POST"],
  rateLimit: {
    action: "rate_limit",
    aggregateBy: "ip",
    windowSize: 60,
    windowLimit: 90,
  },
} satisfies Config;
