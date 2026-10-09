import type { Config } from "@netlify/functions";
import { readUpcomingCalendarEvents } from "../lib/calendar.mjs";
import { readEventPlannerState } from "../lib/events.mjs";
import { hasValidSession, isPasswordConfigured, isSameOrigin, json } from "../lib/location.mjs";
import {
  collectWeatherEvents,
  getWeatherSnapshot,
  normalizeWeatherSettings,
  saveWeatherSettings,
  sendWeatherTestAlert,
  type WeatherSnapshot,
} from "../lib/weather.mjs";

function reviewSnapshot(): WeatherSnapshot {
  const now = new Date();
  const start = new Date(now.getTime() + 3 * 86_400_000);
  start.setHours(17, 0, 0, 0);
  const end = new Date(start.getTime() + 5 * 3_600_000);
  const settings = normalizeWeatherSettings(null);
  return {
    generatedAt: now.toISOString(),
    settings,
    notificationsConfigured: true,
    geocodingSource: "Google Places",
    events: [{
      id: "calendar:review-upcoming-stop",
      source: "calendar",
      sourceId: "review-upcoming-stop",
      title: "2590 Food Truck Park",
      location: "2590 Food Truck Park",
      resolvedLocation: "2590 Soncy Road, Amarillo, TX",
      start: start.toISOString(),
      end: end.toISOString(),
      allDay: false,
      risk: "watch",
      riskScore: 1,
      reasons: ["Breezy with gusts near 29 mph", "45% chance of precipitation"],
      recommendation: "Keep watching the forecast and protect signs, supplies, and staffing plans.",
      summary: "Partly cloudy · 61–72°F · 45% rain",
      temperature: 72,
      apparentTemperature: 71,
      highTemperature: 72,
      lowTemperature: 61,
      precipitationProbability: 45,
      windSpeed: 18,
      windGust: 29,
      conditions: "Partly cloudy",
      hourly: Array.from({ length: 6 }, (_, index) => ({
        time: new Date(start.getTime() + index * 3_600_000).toLocaleString("sv-SE", { timeZone: "America/Chicago" }).slice(0, 13).replace(" ", "T") + ":00",
        temperature: 72 - index * 2,
        apparentTemperature: 71 - index * 2,
        precipitationProbability: 25 + index * 4,
        precipitation: index > 3 ? 0.02 : 0,
        windSpeed: 15 + index,
        windGust: 24 + index,
        weatherCode: index > 3 ? 61 : 2,
        conditions: index > 3 ? "Light rain" : "Partly cloudy",
      })),
      alerts: [],
      forecastSource: "National Weather Service + Open-Meteo",
      confidence: "high",
      updatedAt: now.toISOString(),
      availableAt: null,
      locationNeedsAttention: false,
    }, {
      id: "planner:review-2590",
      source: "planner",
      sourceId: "review-2590",
      title: "2590 Food Truck Park",
      location: "2590 Food Truck Park",
      resolvedLocation: "2590 Soncy Road, Amarillo, TX",
      start: start.toISOString(),
      end: end.toISOString(),
      allDay: false,
      risk: "watch",
      riskScore: 1,
      reasons: ["Breezy with gusts near 29 mph", "45% chance of precipitation"],
      recommendation: "Keep watching the forecast and protect signs, supplies, and staffing plans.",
      summary: "Partly cloudy · 61–72°F · 45% rain",
      temperature: 72,
      apparentTemperature: 71,
      highTemperature: 72,
      lowTemperature: 61,
      precipitationProbability: 45,
      windSpeed: 18,
      windGust: 29,
      conditions: "Partly cloudy",
      hourly: [],
      alerts: [],
      forecastSource: "National Weather Service + Open-Meteo",
      confidence: "high",
      updatedAt: now.toISOString(),
      availableAt: null,
      locationNeedsAttention: false,
    }],
  };
}

function isReview(request: Request) {
  const url = new URL(request.url);
  return process.env.CONTEXT === "deploy-preview" || url.hostname.startsWith("deploy-preview-");
}

export default async function handler(request: Request) {
  if (request.method !== "GET" && request.method !== "POST") {
    return json({ message: "Method not allowed." }, 405, { Allow: "GET, POST" });
  }
  const review = isReview(request);
  if (review) {
    if (request.method === "POST") return json({ saved: true, preview: true, weather: reviewSnapshot() });
    return json({ weather: reviewSnapshot() });
  }
  if (!isPasswordConfigured()) return json({ message: "The shared staff password has not been configured." }, 503);
  if (!hasValidSession(request)) return json({ authenticated: false, message: "Sign in to continue." }, 401);

  if (request.method === "POST") {
    if (!isSameOrigin(request)) return json({ message: "This request was not accepted." }, 403);
    let body: Record<string, unknown>;
    try { body = await request.json(); } catch { return json({ message: "This request was not understood." }, 400); }
    try {
      if (body.action === "saveSettings") {
        return json({ saved: true, settings: await saveWeatherSettings(body.settings) });
      }
      if (body.action === "testAlert") {
        await sendWeatherTestAlert();
        return json({ sent: true });
      }
      return json({ message: "Choose save settings or test alert." }, 400);
    } catch (error) {
      console.error("Could not update weather settings", error);
      return json({ message: error instanceof Error ? error.message : "Could not update weather settings." }, 503);
    }
  }

  try {
    const [calendar, planner] = await Promise.all([
      readUpcomingCalendarEvents({ limit: 20 }).catch(() => ({ configured: true, events: [] })),
      readEventPlannerState(),
    ]);
    const events = collectWeatherEvents(calendar.events, planner.events);
    return json({ authenticated: true, weather: await getWeatherSnapshot(events) });
  } catch (error) {
    console.error("Could not load event weather", error);
    return json({ message: "Event weather is temporarily unavailable." }, 503);
  }
}

export const config = {
  path: "/api/weather/events",
  method: ["GET", "POST"],
  rateLimit: { action: "rate_limit", aggregateBy: "ip", windowSize: 60, windowLimit: 60 },
} satisfies Config;
