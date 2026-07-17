import type { Config } from "@netlify/functions";
import {
  createSessionCookie,
  isPasswordConfigured,
  isSameOrigin,
  json,
  verifyPassword,
} from "../lib/location.mjs";

export default async function handler(request: Request) {
  if (request.method !== "POST") {
    return json({ message: "Method not allowed." }, 405, { Allow: "POST" });
  }

  if (!isPasswordConfigured()) {
    return json({ message: "The shared password has not been configured." }, 503);
  }
  if (!isSameOrigin(request)) {
    return json({ message: "This request was not accepted." }, 403);
  }

  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > 2_048) return json({ message: "This request was not accepted." }, 413);

  let body: { password?: unknown };
  try {
    body = await request.json();
  } catch {
    return json({ message: "Enter the shared password." }, 400);
  }

  if (!verifyPassword(body.password)) {
    return json({ message: "That password didn't work." }, 401);
  }

  return json(
    { authenticated: true },
    200,
    { "Set-Cookie": createSessionCookie() },
  );
}

export const config = {
  path: "/api/location/login",
  method: "POST",
  rateLimit: {
    action: "rate_limit",
    aggregateBy: "ip",
    windowSize: 60,
    windowLimit: 8,
  },
} satisfies Config;
