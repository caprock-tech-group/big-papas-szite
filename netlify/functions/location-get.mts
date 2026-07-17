import type { Config } from "@netlify/functions";
import { json, readStoredLocation, toPublicLocation } from "../lib/location.mjs";

export default async function handler() {
  try {
    const { location, expired } = await readStoredLocation();
    if (!location || expired) return json({ live: false, location: null });
    return json({ live: true, location: toPublicLocation(location) });
  } catch (error) {
    console.error("Could not read the live location", error);
    return json({ live: false, location: null, message: "Location service unavailable." }, 503);
  }
}

export const config = {
  path: "/api/location",
  method: "GET",
  rateLimit: {
    action: "rate_limit",
    aggregateBy: "ip",
    windowSize: 60,
    windowLimit: 120,
  },
} satisfies Config;
