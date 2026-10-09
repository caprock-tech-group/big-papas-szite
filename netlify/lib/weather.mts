import { createHash } from "node:crypto";
import { getStore } from "@netlify/blobs";
import type { PublicCalendarEvent } from "./calendar.mjs";
import type { EventPlan } from "./events.mjs";

const STORE_NAME = "big-papas-weather";
const SETTINGS_KEY = "settings";
const VENUES_KEY = "venues";
const ALERT_STATE_KEY = "alert-state";
const FORECAST_CACHE_MINUTES = 15;
const MAX_FORECAST_DAYS = 16;
const CHICAGO_TIMEZONE = "America/Chicago";

export type WeatherRisk = "good" | "watch" | "high" | "severe" | "unavailable";

export type WeatherSettings = {
  version: 1;
  alertsEnabled: boolean;
  windWatch: number;
  windHigh: number;
  rainWatch: number;
  rainHigh: number;
  heatWatch: number;
  heatHigh: number;
  coldWatch: number;
  coldHigh: number;
};

export type WeatherVenue = {
  id: string;
  name: string;
  aliases: string[];
  address: string;
  latitude: number | null;
  longitude: number | null;
  updatedAt: string;
};

export type WeatherEventInput = {
  id: string;
  source: "calendar" | "planner";
  sourceId: string;
  title: string;
  location: string;
  start: string;
  end: string;
  allDay: boolean;
};

type ResolvedLocation = {
  latitude: number;
  longitude: number;
  label: string;
  source: "google" | "openstreetmap" | "coordinates" | "saved-venue";
  resolvedAt: string;
  venueId?: string;
  venueName?: string;
};

export type WeatherHour = {
  time: string;
  temperature: number | null;
  apparentTemperature: number | null;
  precipitationProbability: number | null;
  precipitation: number | null;
  windSpeed: number | null;
  windGust: number | null;
  weatherCode: number | null;
  conditions: string;
};

type NwsAlert = {
  id: string;
  event: string;
  severity: string;
  urgency: string;
  headline: string;
  onset: string | null;
  ends: string | null;
  expires: string | null;
};

type ForecastBundle = {
  fetchedAt: string;
  sourceUpdatedAt: string;
  hourly: WeatherHour[];
  alerts: NwsAlert[];
  nwsAvailable: boolean;
  openMeteoAvailable: boolean;
};

export type EventWeather = {
  id: string;
  source: "calendar" | "planner";
  sourceId: string;
  title: string;
  location: string;
  resolvedLocation: string | null;
  start: string;
  end: string;
  allDay: boolean;
  risk: WeatherRisk;
  riskScore: number;
  reasons: string[];
  recommendation: string;
  summary: string;
  temperature: number | null;
  apparentTemperature: number | null;
  highTemperature: number | null;
  lowTemperature: number | null;
  precipitationProbability: number | null;
  windSpeed: number | null;
  windGust: number | null;
  conditions: string;
  hourly: WeatherHour[];
  alerts: NwsAlert[];
  forecastSource: string | null;
  confidence: "high" | "medium" | "early" | null;
  updatedAt: string | null;
  availableAt: string | null;
  locationNeedsAttention: boolean;
  matchedVenueName: string | null;
};

export type WeatherSnapshot = {
  generatedAt: string;
  settings: WeatherSettings;
  notificationsConfigured: boolean;
  geocodingSource: "Google Places" | "OpenStreetMap fallback";
  venues: WeatherVenue[];
  events: EventWeather[];
};

const DEFAULT_SETTINGS: WeatherSettings = {
  version: 1,
  alertsEnabled: true,
  windWatch: 25,
  windHigh: 35,
  rainWatch: 40,
  rainHigh: 70,
  heatWatch: 100,
  heatHigh: 110,
  coldWatch: 32,
  coldHigh: 20,
};

const DEFAULT_VENUES: WeatherVenue[] = [{
  id: "the-nesting-place",
  name: "The Nesting Place",
  aliases: ["Bushland at The Nesting Place", "Nesting Place Bushland"],
  address: "1900 S FM 2381, Bushland, TX 79012",
  latitude: 35.1928282,
  longitude: -102.0643532,
  updatedAt: "2026-10-09T00:00:00.000Z",
}];

function store() {
  return getStore({ name: STORE_NAME, consistency: "strong" });
}

function finiteInRange(value: unknown, minimum: number, maximum: number, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(maximum, Math.max(minimum, parsed)) : fallback;
}

export function normalizeWeatherSettings(value: unknown): WeatherSettings {
  const record = value && typeof value === "object" ? value as Partial<WeatherSettings> : {};
  const windWatch = finiteInRange(record.windWatch, 5, 70, DEFAULT_SETTINGS.windWatch);
  const windHigh = Math.max(windWatch, finiteInRange(record.windHigh, 10, 100, DEFAULT_SETTINGS.windHigh));
  const rainWatch = finiteInRange(record.rainWatch, 1, 100, DEFAULT_SETTINGS.rainWatch);
  const rainHigh = Math.max(rainWatch, finiteInRange(record.rainHigh, 1, 100, DEFAULT_SETTINGS.rainHigh));
  const heatWatch = finiteInRange(record.heatWatch, 70, 130, DEFAULT_SETTINGS.heatWatch);
  const heatHigh = Math.max(heatWatch, finiteInRange(record.heatHigh, 75, 140, DEFAULT_SETTINGS.heatHigh));
  const coldWatch = finiteInRange(record.coldWatch, -20, 60, DEFAULT_SETTINGS.coldWatch);
  const coldHigh = Math.min(coldWatch, finiteInRange(record.coldHigh, -40, 50, DEFAULT_SETTINGS.coldHigh));
  return {
    version: 1,
    alertsEnabled: record.alertsEnabled !== false,
    windWatch: Math.round(windWatch),
    windHigh: Math.round(windHigh),
    rainWatch: Math.round(rainWatch),
    rainHigh: Math.round(rainHigh),
    heatWatch: Math.round(heatWatch),
    heatHigh: Math.round(heatHigh),
    coldWatch: Math.round(coldWatch),
    coldHigh: Math.round(coldHigh),
  };
}

export async function readWeatherSettings() {
  const saved = await store().get(SETTINGS_KEY, { type: "json", consistency: "strong" });
  return normalizeWeatherSettings(saved);
}

export async function saveWeatherSettings(value: unknown) {
  const settings = normalizeWeatherSettings(value);
  await store().setJSON(SETTINGS_KEY, settings);
  return settings;
}

function cleanText(value: unknown, maximum = 180) {
  return String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, maximum);
}

function venueId(value: unknown, name: string, address: string) {
  const provided = cleanText(value, 80).toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
  if (provided) return provided;
  return `venue-${createHash("sha256").update(`${name}|${address}`).digest("hex").slice(0, 12)}`;
}

function coordinate(value: unknown, minimum: number, maximum: number) {
  if (value === "" || value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= minimum && parsed <= maximum ? parsed : null;
}

export function normalizeWeatherVenues(value: unknown): WeatherVenue[] {
  if (!Array.isArray(value)) return DEFAULT_VENUES.map((venue) => ({ ...venue, aliases: [...venue.aliases] }));
  const seen = new Set<string>();
  return value.slice(0, 100).flatMap((entry): WeatherVenue[] => {
    const record = entry && typeof entry === "object" ? entry as Partial<WeatherVenue> : {};
    const name = cleanText(record.name, 100);
    const address = cleanText(record.address, 220);
    if (!name || !address) return [];
    let id = venueId(record.id, name, address);
    if (seen.has(id)) id = `${id}-${seen.size + 1}`;
    seen.add(id);
    const rawAliases = Array.isArray(record.aliases) ? record.aliases : String(record.aliases ?? "").split(/[,\n]/);
    const aliases = [...new Set(rawAliases.map((alias) => cleanText(alias, 100)).filter(Boolean))].slice(0, 12);
    return [{
      id,
      name,
      aliases,
      address,
      latitude: coordinate(record.latitude, -90, 90),
      longitude: coordinate(record.longitude, -180, 180),
      updatedAt: cleanText(record.updatedAt, 40) || new Date().toISOString(),
    }];
  });
}

export async function readWeatherVenues() {
  const saved = await store().get(VENUES_KEY, { type: "json", consistency: "strong" });
  return normalizeWeatherVenues(saved);
}

export function normalizeVenueMatchText(value: unknown) {
  return cleanText(value, 500)
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/\b(?:farm\s+to\s+market|fm\s*road)\b/g, " fm ")
    .replace(/\b(?:south)\b/g, " s ")
    .replace(/\b(?:north)\b/g, " n ")
    .replace(/\b(?:east)\b/g, " e ")
    .replace(/\b(?:west)\b/g, " w ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function matchWeatherVenue(event: Pick<WeatherEventInput, "title" | "location">, venues: WeatherVenue[]) {
  const eventText = normalizeVenueMatchText(`${event.title} ${event.location}`);
  if (!eventText) return null;
  return venues.find((venue) => [venue.name, ...venue.aliases, venue.address].some((candidate) => {
    const needle = normalizeVenueMatchText(candidate);
    return needle.length >= 4 && (` ${eventText} `).includes(` ${needle} `);
  })) || null;
}

function chicagoOffsetMinutes(approximate: Date) {
  const name = new Intl.DateTimeFormat("en-US", {
    timeZone: CHICAGO_TIMEZONE,
    timeZoneName: "shortOffset",
  }).formatToParts(approximate).find((part) => part.type === "timeZoneName")?.value || "GMT-6";
  const match = name.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
  if (!match) return -360;
  const amount = Number(match[2]) * 60 + Number(match[3] || 0);
  return match[1] === "+" ? amount : -amount;
}

export function chicagoLocalDateTime(date: string, time: string) {
  const approximate = new Date(`${date}T${time}:00.000Z`);
  if (!Number.isFinite(approximate.getTime())) return null;
  const first = new Date(approximate.getTime() - chicagoOffsetMinutes(approximate) * 60_000);
  const corrected = new Date(approximate.getTime() - chicagoOffsetMinutes(first) * 60_000);
  return corrected;
}

function addDays(date: string, days: number) {
  const value = new Date(`${date}T12:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export function calendarEventToWeatherInput(event: PublicCalendarEvent): WeatherEventInput | null {
  if (!event.location || /\bclosed\b/i.test(event.title)) return null;
  if (event.allDay || /^\d{4}-\d{2}-\d{2}$/.test(event.start)) {
    const start = chicagoLocalDateTime(event.start.slice(0, 10), "09:00");
    const end = chicagoLocalDateTime(event.start.slice(0, 10), "21:00");
    if (!start || !end) return null;
    return {
      id: `calendar:${event.id}`,
      source: "calendar",
      sourceId: event.id,
      title: event.title,
      location: event.location,
      start: start.toISOString(),
      end: end.toISOString(),
      allDay: true,
    };
  }
  const start = new Date(event.start);
  const end = new Date(event.end);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) return null;
  return {
    id: `calendar:${event.id}`,
    source: "calendar",
    sourceId: event.id,
    title: event.title,
    location: event.location,
    start: start.toISOString(),
    end: end.toISOString(),
    allDay: false,
  };
}

export function plannerEventToWeatherInput(event: EventPlan): WeatherEventInput | null {
  if (!event.location || !event.eventDate || /\bclosed\b/i.test(event.name)) return null;
  const start = chicagoLocalDateTime(event.eventDate, event.setupTime || event.openTime || "09:00");
  let end = chicagoLocalDateTime(event.eventDate, event.closeTime || event.openTime || "21:00");
  if (!start || !end) return null;
  end = new Date(end.getTime() + 60 * 60_000);
  if (end <= start) end = new Date(end.getTime() + 86_400_000);
  return {
    id: `planner:${event.id}`,
    source: "planner",
    sourceId: event.id,
    title: event.name,
    location: event.location,
    start: start.toISOString(),
    end: end.toISOString(),
    allDay: false,
  };
}

export function collectWeatherEvents(calendar: PublicCalendarEvent[], planner: EventPlan[], now = new Date()) {
  const horizon = new Date(now.getTime() + (MAX_FORECAST_DAYS + 1) * 86_400_000);
  const calendarEvents = calendar.map(calendarEventToWeatherInput).filter((value): value is WeatherEventInput => Boolean(value));
  const plannerEvents = planner.map(plannerEventToWeatherInput).filter((value): value is WeatherEventInput => Boolean(value));
  return [...calendarEvents, ...plannerEvents]
    .filter((event) => Date.parse(event.end) >= now.getTime() - 3_600_000 && Date.parse(event.start) <= horizon.getTime())
    .sort((left, right) => Date.parse(left.start) - Date.parse(right.start));
}

function cacheKey(prefix: string, value: string) {
  return `${prefix}:${createHash("sha256").update(value.trim().toLowerCase()).digest("hex").slice(0, 32)}`;
}

async function fetchJson(url: string, init: RequestInit = {}, timeoutMs = 12_000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    if (!response.ok) throw new Error(`Weather service returned ${response.status}.`);
    return await response.json() as any;
  } finally {
    clearTimeout(timer);
  }
}

function coordinatesFromText(location: string): ResolvedLocation | null {
  const match = location.match(/^\s*(-?\d{1,2}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)\s*$/);
  if (!match) return null;
  const latitude = Number(match[1]);
  const longitude = Number(match[2]);
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;
  return { latitude, longitude, label: location.trim(), source: "coordinates", resolvedAt: new Date().toISOString() };
}

async function resolveWithGoogle(location: string, apiKey: string): Promise<ResolvedLocation | null> {
  const data = await fetchJson("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "places.displayName,places.formattedAddress,places.location",
    },
    body: JSON.stringify({ textQuery: /\b(?:TX|Texas)\b/i.test(location) ? location : `${location}, Texas`, maxResultCount: 1 }),
  });
  const place = Array.isArray(data.places) ? data.places[0] : null;
  const latitude = Number(place?.location?.latitude);
  const longitude = Number(place?.location?.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return {
    latitude,
    longitude,
    label: place.formattedAddress || place.displayName?.text || location,
    source: "google",
    resolvedAt: new Date().toISOString(),
  };
}

async function resolveWithOpenStreetMap(location: string): Promise<ResolvedLocation | null> {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "1");
  url.searchParams.set("countrycodes", "us");
  url.searchParams.set("q", /\b(?:TX|Texas)\b/i.test(location) ? location : `${location}, Texas`);
  const data = await fetchJson(url.toString(), {
    headers: { "User-Agent": "Big-Papas-Command-Center/1.0 (https://bigpapastaters.com)" },
  });
  const place = Array.isArray(data) ? data[0] : null;
  const latitude = Number(place?.lat);
  const longitude = Number(place?.lon);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return {
    latitude,
    longitude,
    label: typeof place.display_name === "string" ? place.display_name : location,
    source: "openstreetmap",
    resolvedAt: new Date().toISOString(),
  };
}

export async function resolveWeatherLocation(location: string): Promise<ResolvedLocation | null> {
  const direct = coordinatesFromText(location);
  if (direct) return direct;
  const key = cacheKey("location", location);
  const cached = await store().get(key, { type: "json", consistency: "strong" }) as ResolvedLocation | null;
  if (cached && Number.isFinite(cached.latitude) && Number.isFinite(cached.longitude)) return cached;
  const googleKey = process.env.GOOGLE_MAPS_API_KEY?.trim();
  let resolved: ResolvedLocation | null = null;
  try {
    resolved = googleKey ? await resolveWithGoogle(location, googleKey) : await resolveWithOpenStreetMap(location);
  } catch (error) {
    console.warn("Weather location could not be resolved", location, error);
  }
  if (resolved) await store().setJSON(key, resolved);
  return resolved;
}

async function resolvedSavedVenue(venue: WeatherVenue): Promise<ResolvedLocation | null> {
  if (venue.latitude !== null && venue.longitude !== null) return {
    latitude: venue.latitude,
    longitude: venue.longitude,
    label: venue.address,
    source: "saved-venue",
    resolvedAt: venue.updatedAt,
    venueId: venue.id,
    venueName: venue.name,
  };
  const resolved = await resolveWeatherLocation(venue.address);
  return resolved ? { ...resolved, label: venue.address, source: "saved-venue", venueId: venue.id, venueName: venue.name } : null;
}

export async function saveWeatherVenues(value: unknown) {
  if (Array.isArray(value) && value.some((entry) => {
    const record = entry && typeof entry === "object" ? entry as Partial<WeatherVenue> : {};
    return !cleanText(record.name, 100) || !cleanText(record.address, 220);
  })) throw new Error("Every saved venue needs both a venue name and a complete address.");
  const venues = normalizeWeatherVenues(value);
  const resolved: WeatherVenue[] = [];
  for (const venue of venues) {
    if (venue.latitude !== null && venue.longitude !== null) {
      resolved.push({ ...venue, updatedAt: new Date().toISOString() });
      continue;
    }
    const location = await resolveWeatherLocation(venue.address);
    if (!location) throw new Error(`We could not verify the address for ${venue.name}. Check the street, city, state, and ZIP code.`);
    resolved.push({ ...venue, latitude: location.latitude, longitude: location.longitude, updatedAt: new Date().toISOString() });
  }
  await store().setJSON(VENUES_KEY, resolved);
  return resolved;
}

function localHourKey(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: CHICAGO_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const part = (type: string) => parts.find((entry) => entry.type === type)?.value || "00";
  return `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:00`;
}

function numberOrNull(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function maxWindSpeed(value: unknown) {
  const matches = String(value ?? "").match(/\d+(?:\.\d+)?/g);
  if (!matches?.length) return null;
  return Math.max(...matches.map(Number));
}

function weatherCodeLabel(code: number | null) {
  if (code === null) return "Forecast available";
  if (code === 0) return "Clear";
  if (code <= 3) return "Partly cloudy";
  if ([45, 48].includes(code)) return "Fog";
  if (code >= 95) return "Thunderstorms";
  if (code >= 85) return "Snow showers";
  if (code >= 71) return "Snow";
  if (code >= 66) return "Freezing rain";
  if (code >= 61) return "Rain";
  if (code >= 51) return "Drizzle";
  return "Mixed weather";
}

async function fetchOpenMeteo(latitude: number, longitude: number) {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", latitude.toFixed(5));
  url.searchParams.set("longitude", longitude.toFixed(5));
  url.searchParams.set("timezone", CHICAGO_TIMEZONE);
  url.searchParams.set("forecast_days", String(MAX_FORECAST_DAYS));
  url.searchParams.set("temperature_unit", "fahrenheit");
  url.searchParams.set("wind_speed_unit", "mph");
  url.searchParams.set("precipitation_unit", "inch");
  url.searchParams.set("hourly", "temperature_2m,apparent_temperature,precipitation_probability,precipitation,weather_code,wind_speed_10m,wind_gusts_10m");
  const data = await fetchJson(url.toString());
  const hourly = data.hourly || {};
  const times = Array.isArray(hourly.time) ? hourly.time : [];
  return times.map((time: string, index: number): WeatherHour => {
    const code = numberOrNull(hourly.weather_code?.[index]);
    return {
      time,
      temperature: numberOrNull(hourly.temperature_2m?.[index]),
      apparentTemperature: numberOrNull(hourly.apparent_temperature?.[index]),
      precipitationProbability: numberOrNull(hourly.precipitation_probability?.[index]),
      precipitation: numberOrNull(hourly.precipitation?.[index]),
      windSpeed: numberOrNull(hourly.wind_speed_10m?.[index]),
      windGust: numberOrNull(hourly.wind_gusts_10m?.[index]),
      weatherCode: code,
      conditions: weatherCodeLabel(code),
    };
  });
}

async function fetchNws(latitude: number, longitude: number) {
  const headers = {
    Accept: "application/geo+json, application/json",
    "User-Agent": "Big-Papas-Command-Center/1.0 (https://bigpapastaters.com)",
  };
  const point = await fetchJson(`https://api.weather.gov/points/${latitude.toFixed(4)},${longitude.toFixed(4)}`, { headers });
  const hourlyUrl = point?.properties?.forecastHourly;
  const [hourlyData, alertData] = await Promise.all([
    hourlyUrl ? fetchJson(hourlyUrl, { headers }) : Promise.resolve(null),
    fetchJson(`https://api.weather.gov/alerts/active?point=${latitude.toFixed(4)},${longitude.toFixed(4)}`, { headers }).catch(() => null),
  ]);
  const hourly = Array.isArray(hourlyData?.properties?.periods)
    ? hourlyData.properties.periods.map((period: any): WeatherHour => ({
      time: localHourKey(period.startTime),
      temperature: numberOrNull(period.temperature),
      apparentTemperature: null,
      precipitationProbability: numberOrNull(period.probabilityOfPrecipitation?.value),
      precipitation: null,
      windSpeed: maxWindSpeed(period.windSpeed),
      windGust: null,
      weatherCode: null,
      conditions: typeof period.shortForecast === "string" ? period.shortForecast : "Forecast available",
    }))
    : [];
  const alerts = Array.isArray(alertData?.features)
    ? alertData.features.map((feature: any): NwsAlert => ({
      id: String(feature.id || feature.properties?.id || "weather-alert"),
      event: String(feature.properties?.event || "Weather alert"),
      severity: String(feature.properties?.severity || "Unknown"),
      urgency: String(feature.properties?.urgency || "Unknown"),
      headline: String(feature.properties?.headline || feature.properties?.event || "Weather alert"),
      onset: typeof feature.properties?.onset === "string" ? feature.properties.onset : null,
      ends: typeof feature.properties?.ends === "string" ? feature.properties.ends : null,
      expires: typeof feature.properties?.expires === "string" ? feature.properties.expires : null,
    }))
    : [];
  return { hourly, alerts, updatedAt: String(hourlyData?.properties?.updateTime || new Date().toISOString()) };
}

function combineForecasts(openMeteo: WeatherHour[], nws: WeatherHour[]) {
  const combined = new Map(openMeteo.map((hour) => [hour.time, hour]));
  nws.forEach((hour) => {
    const existing = combined.get(hour.time);
    combined.set(hour.time, existing ? {
      ...existing,
      temperature: hour.temperature ?? existing.temperature,
      precipitationProbability: hour.precipitationProbability ?? existing.precipitationProbability,
      windSpeed: hour.windSpeed ?? existing.windSpeed,
      conditions: hour.conditions || existing.conditions,
    } : hour);
  });
  return [...combined.values()].sort((left, right) => left.time.localeCompare(right.time));
}

async function fetchForecastBundle(location: ResolvedLocation): Promise<ForecastBundle> {
  const cacheId = `forecast:${location.latitude.toFixed(2)}:${location.longitude.toFixed(2)}`;
  const cached = await store().get(cacheId, { type: "json", consistency: "strong" }) as ForecastBundle | null;
  if (cached && Date.now() - Date.parse(cached.fetchedAt) < FORECAST_CACHE_MINUTES * 60_000) return cached;
  const [openResult, nwsResult] = await Promise.allSettled([
    fetchOpenMeteo(location.latitude, location.longitude),
    fetchNws(location.latitude, location.longitude),
  ]);
  const openMeteo = openResult.status === "fulfilled" ? openResult.value : [];
  const nws = nwsResult.status === "fulfilled" ? nwsResult.value : { hourly: [], alerts: [], updatedAt: new Date().toISOString() };
  if (!openMeteo.length && !nws.hourly.length) throw new Error("No weather forecast was available.");
  const result: ForecastBundle = {
    fetchedAt: new Date().toISOString(),
    sourceUpdatedAt: nws.updatedAt,
    hourly: combineForecasts(openMeteo, nws.hourly),
    alerts: nws.alerts,
    nwsAvailable: nwsResult.status === "fulfilled",
    openMeteoAvailable: openResult.status === "fulfilled",
  };
  await store().setJSON(cacheId, result);
  return result;
}

function maxValue(values: Array<number | null>) {
  const finite = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  return finite.length ? Math.max(...finite) : null;
}

function minValue(values: Array<number | null>) {
  const finite = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  return finite.length ? Math.min(...finite) : null;
}

function riskName(score: number): WeatherRisk {
  if (score >= 3) return "severe";
  if (score >= 2) return "high";
  if (score >= 1) return "watch";
  return "good";
}

function alertOverlaps(alert: NwsAlert, start: string, end: string) {
  const alertStart = Date.parse(alert.onset || start);
  const alertEnd = Date.parse(alert.ends || alert.expires || end);
  return (!Number.isFinite(alertStart) || alertStart <= Date.parse(end))
    && (!Number.isFinite(alertEnd) || alertEnd >= Date.parse(start));
}

export function scoreWeatherWindow(
  hours: WeatherHour[],
  alerts: NwsAlert[],
  settings = DEFAULT_SETTINGS,
) {
  const reasons: string[] = [];
  let score = 0;
  const maxRain = maxValue(hours.map((hour) => hour.precipitationProbability));
  const maxWind = maxValue(hours.map((hour) => hour.windSpeed));
  const maxGust = maxValue(hours.map((hour) => hour.windGust));
  const highTemperature = maxValue(hours.map((hour) => hour.temperature));
  const lowTemperature = minValue(hours.map((hour) => hour.temperature));
  const maxApparent = maxValue(hours.map((hour) => hour.apparentTemperature ?? hour.temperature));
  const minApparent = minValue(hours.map((hour) => hour.apparentTemperature ?? hour.temperature));
  const strongestWind = maxGust ?? maxWind;

  const warning = alerts.find((alert) => /warning/i.test(alert.event));
  const watch = alerts.find((alert) => /watch/i.test(alert.event));
  const advisory = alerts.find((alert) => /advisory/i.test(alert.event));
  if (warning) { score = 3; reasons.push(warning.event); }
  else if (watch) { score = Math.max(score, 2); reasons.push(watch.event); }
  else if (advisory) { score = Math.max(score, 1); reasons.push(advisory.event); }

  if (strongestWind !== null && strongestWind >= settings.windHigh) {
    score = Math.max(score, 2); reasons.push(`Wind gusts may reach ${Math.round(strongestWind)} mph`);
  } else if (strongestWind !== null && strongestWind >= settings.windWatch) {
    score = Math.max(score, 1); reasons.push(`Breezy with gusts near ${Math.round(strongestWind)} mph`);
  }
  if (maxRain !== null && maxRain >= settings.rainHigh) {
    score = Math.max(score, 2); reasons.push(`${Math.round(maxRain)}% chance of precipitation`);
  } else if (maxRain !== null && maxRain >= settings.rainWatch) {
    score = Math.max(score, 1); reasons.push(`${Math.round(maxRain)}% chance of precipitation`);
  }
  if (maxApparent !== null && maxApparent >= settings.heatHigh) {
    score = Math.max(score, 2); reasons.push(`Feels like may reach ${Math.round(maxApparent)}°F`);
  } else if (maxApparent !== null && maxApparent >= settings.heatWatch) {
    score = Math.max(score, 1); reasons.push(`Heat index near ${Math.round(maxApparent)}°F`);
  }
  if (minApparent !== null && minApparent <= settings.coldHigh) {
    score = Math.max(score, 2); reasons.push(`Feels like may fall to ${Math.round(minApparent)}°F`);
  } else if (minApparent !== null && minApparent <= settings.coldWatch) {
    score = Math.max(score, 1); reasons.push(`Cold conditions near ${Math.round(minApparent)}°F`);
  }
  if (hours.some((hour) => (hour.weatherCode ?? 0) >= 95 || /thunder/i.test(hour.conditions))) {
    score = Math.max(score, 2); reasons.push("Thunderstorms are possible during the event");
  }
  if (hours.some((hour) => [66, 67, 71, 73, 75, 77, 85, 86].includes(hour.weatherCode ?? -1))) {
    score = Math.max(score, 2); reasons.push("Snow or freezing precipitation is possible");
  }

  const risk = riskName(score);
  const recommendation = risk === "severe"
    ? "Take action now and review whether this event can operate safely."
    : risk === "high"
      ? "Prepare a backup plan and make a go/no-go decision closer to service."
      : risk === "watch"
        ? "Keep watching the forecast and protect signs, supplies, and staffing plans."
        : "Weather should support normal event operations.";
  return { risk, score, reasons: [...new Set(reasons)], recommendation, maxRain, maxWind, maxGust, highTemperature, lowTemperature, maxApparent, minApparent };
}

function unavailableEvent(event: WeatherEventInput, details: Partial<EventWeather> = {}): EventWeather {
  return {
    id: event.id,
    source: event.source,
    sourceId: event.sourceId,
    title: event.title,
    location: event.location,
    resolvedLocation: null,
    start: event.start,
    end: event.end,
    allDay: event.allDay,
    risk: "unavailable",
    riskScore: -1,
    reasons: [],
    recommendation: "Weather will appear automatically when a forecast is available.",
    summary: "Forecast not available yet",
    temperature: null,
    apparentTemperature: null,
    highTemperature: null,
    lowTemperature: null,
    precipitationProbability: null,
    windSpeed: null,
    windGust: null,
    conditions: "Forecast pending",
    hourly: [],
    alerts: [],
    forecastSource: null,
    confidence: null,
    updatedAt: null,
    availableAt: null,
    locationNeedsAttention: false,
    matchedVenueName: null,
    ...details,
  };
}

async function weatherForEvent(event: WeatherEventInput, settings: WeatherSettings, venues: WeatherVenue[], now: Date): Promise<EventWeather> {
  const daysAway = (Date.parse(event.start) - now.getTime()) / 86_400_000;
  if (daysAway > MAX_FORECAST_DAYS) {
    const eventDate = localHourKey(event.start).slice(0, 10);
    return unavailableEvent(event, { availableAt: addDays(eventDate, -MAX_FORECAST_DAYS) });
  }
  const matchedVenue = matchWeatherVenue(event, venues);
  const resolved = matchedVenue ? await resolvedSavedVenue(matchedVenue) : await resolveWeatherLocation(event.location);
  if (!resolved) return unavailableEvent(event, {
    summary: "Location needs confirmation",
    recommendation: "Use a complete street address or venue and city so weather can be matched accurately.",
    locationNeedsAttention: true,
  });
  try {
    const bundle = await fetchForecastBundle(resolved);
    const startKey = localHourKey(event.start);
    const endKey = localHourKey(event.end);
    const hours = bundle.hourly.filter((hour) => hour.time >= startKey && hour.time <= endKey);
    if (!hours.length) return unavailableEvent(event, {
      resolvedLocation: resolved.label,
      availableAt: daysAway > 0 ? addDays(startKey.slice(0, 10), -MAX_FORECAST_DAYS) : null,
    });
    const alerts = bundle.alerts.filter((alert) => alertOverlaps(alert, event.start, event.end));
    const scored = scoreWeatherWindow(hours, alerts, settings);
    const first = hours[0];
    const high = scored.highTemperature;
    const low = scored.lowTemperature;
    const temperatureRange = high !== null && low !== null
      ? (Math.round(high) === Math.round(low) ? `${Math.round(high)}°F` : `${Math.round(low)}–${Math.round(high)}°F`)
      : "Temperature pending";
    const summary = `${first.conditions} · ${temperatureRange}${scored.maxRain !== null ? ` · ${Math.round(scored.maxRain)}% rain` : ""}`;
    return {
      id: event.id,
      source: event.source,
      sourceId: event.sourceId,
      title: event.title,
      location: event.location,
      resolvedLocation: resolved.label,
      start: event.start,
      end: event.end,
      allDay: event.allDay,
      risk: scored.risk,
      riskScore: scored.score,
      reasons: scored.reasons,
      recommendation: scored.recommendation,
      summary,
      temperature: first.temperature,
      apparentTemperature: first.apparentTemperature,
      highTemperature: high,
      lowTemperature: low,
      precipitationProbability: scored.maxRain,
      windSpeed: scored.maxWind,
      windGust: scored.maxGust,
      conditions: first.conditions,
      hourly: hours.slice(0, 18),
      alerts,
      forecastSource: daysAway <= 7 && bundle.nwsAvailable ? "National Weather Service + Open-Meteo" : "Open-Meteo early outlook",
      confidence: daysAway <= 3 ? "high" : daysAway <= 7 ? "medium" : "early",
      updatedAt: bundle.fetchedAt,
      availableAt: null,
      locationNeedsAttention: false,
      matchedVenueName: resolved.venueName || null,
    };
  } catch (error) {
    console.warn("Weather forecast unavailable", event.title, error);
    return unavailableEvent(event, { resolvedLocation: resolved.label, summary: "Forecast temporarily unavailable" });
  }
}

export function notificationsConfigured() {
  const token = (process.env.PUSHOVER_WEATHER_APP_TOKEN || process.env.PUSHOVER_APP_TOKEN || process.env.PUSHOVER_API_TOKEN || "").trim();
  const recipients = (process.env.PUSHOVER_WEATHER_GROUP_KEY || process.env.PUSHOVER_GROUP_KEY || process.env.PUSHOVER_USER_KEYS || "").trim();
  return Boolean(token && recipients);
}

export async function getWeatherSnapshot(events: WeatherEventInput[], options: { now?: Date } = {}): Promise<WeatherSnapshot> {
  const now = options.now ?? new Date();
  const [settings, venues] = await Promise.all([readWeatherSettings(), readWeatherVenues()]);
  const output: EventWeather[] = [];
  for (const event of events.slice(0, 30)) output.push(await weatherForEvent(event, settings, venues, now));
  return {
    generatedAt: new Date().toISOString(),
    settings,
    notificationsConfigured: notificationsConfigured(),
    geocodingSource: process.env.GOOGLE_MAPS_API_KEY?.trim() ? "Google Places" : "OpenStreetMap fallback",
    venues,
    events: output,
  };
}

type AlertHistory = Record<string, {
  lastRisk: WeatherRisk;
  lastScore: number;
  milestones: string[];
  lastFingerprint: string;
  lastSentAt: string | null;
  allClearSent: boolean;
}>;

function milestoneFor(event: EventWeather, now: Date) {
  const hours = (Date.parse(event.start) - now.getTime()) / 3_600_000;
  if (hours <= 6) return "6h";
  if (hours <= 24) return "24h";
  if (hours <= 72) return "72h";
  if (hours <= 168) return "7d";
  return null;
}

function alertFingerprint(event: EventWeather) {
  return createHash("sha256").update(`${event.risk}|${event.reasons.join("|")}|${event.alerts.map((alert) => alert.id).join("|")}`).digest("hex").slice(0, 24);
}

export function weatherAlertDecision(event: EventWeather, previous: AlertHistory[string] | undefined, now = new Date()) {
  if (event.risk === "unavailable" || Date.parse(event.end) < now.getTime()) return { send: false, kind: "none" as const };
  const milestone = milestoneFor(event, now);
  const fingerprint = alertFingerprint(event);
  const severeWarning = event.alerts.some((alert) => /warning/i.test(alert.event));
  const worsened = Boolean(previous && event.riskScore > previous.lastScore);
  const newMilestone = Boolean(milestone && !previous?.milestones?.includes(milestone));
  const changed = fingerprint !== previous?.lastFingerprint;
  if (event.riskScore >= 1 && (severeWarning || worsened || newMilestone || (!previous && changed))) {
    return { send: true, kind: severeWarning ? "warning" as const : "risk" as const, milestone, fingerprint };
  }
  if (previous && previous.lastScore >= 2 && event.riskScore === 0 && !previous.allClearSent) {
    return { send: true, kind: "clear" as const, milestone, fingerprint };
  }
  return { send: false, kind: "none" as const, milestone, fingerprint };
}

function pushoverCredentials() {
  const token = (process.env.PUSHOVER_WEATHER_APP_TOKEN || process.env.PUSHOVER_APP_TOKEN || process.env.PUSHOVER_API_TOKEN || "").trim();
  const recipients = (process.env.PUSHOVER_WEATHER_GROUP_KEY || process.env.PUSHOVER_GROUP_KEY || process.env.PUSHOVER_USER_KEYS || "")
    .split(/[\s,;]+/).map((value) => value.trim()).filter(Boolean);
  return { token, recipients };
}

async function sendPushover(event: EventWeather, kind: "warning" | "risk" | "clear") {
  const { token, recipients } = pushoverCredentials();
  if (!token || !recipients.length) throw new Error("Pushover weather delivery is not configured.");
  const priority = kind === "warning" ? 2 : event.riskScore >= 2 ? 1 : 0;
  const title = kind === "clear" ? `Weather improved: ${event.title}` : `Weather ${event.risk === "severe" ? "warning" : "watch"}: ${event.title}`;
  const detail = kind === "clear"
    ? `Conditions have improved. ${event.summary}`
    : `${event.summary}. ${event.reasons.join("; ") || event.recommendation}`;
  for (const user of recipients) {
    const body = new URLSearchParams({
      token,
      user,
      title,
      message: detail.slice(0, 1024),
      priority: String(priority),
      url: `https://bigpapastaters.com/command/?view=events&event=${encodeURIComponent(event.sourceId)}`,
      url_title: "Open event weather",
      sound: priority >= 1 ? "siren" : "pushover",
    });
    if (priority === 2) { body.set("retry", "300"); body.set("expire", "3600"); }
    const response = await fetch("https://api.pushover.net/1/messages.json", { method: "POST", body });
    if (!response.ok) throw new Error(`Pushover returned ${response.status}.`);
  }
}

export async function monitorWeather(snapshot: WeatherSnapshot, now = new Date()) {
  const history = (await store().get(ALERT_STATE_KEY, { type: "json", consistency: "strong" }) || {}) as AlertHistory;
  const sent: Array<{ eventId: string; kind: string }> = [];
  for (const event of snapshot.events) {
    const previous = history[event.id];
    const decision = weatherAlertDecision(event, previous, now);
    if (snapshot.settings.alertsEnabled && snapshot.notificationsConfigured && decision.send && decision.kind !== "none") {
      await sendPushover(event, decision.kind);
      sent.push({ eventId: event.id, kind: decision.kind });
    }
    history[event.id] = {
      lastRisk: event.risk,
      lastScore: event.riskScore,
      milestones: [...new Set([...(previous?.milestones || []), ...(decision.milestone ? [decision.milestone] : [])])],
      lastFingerprint: decision.fingerprint || alertFingerprint(event),
      lastSentAt: decision.send ? new Date().toISOString() : previous?.lastSentAt || null,
      allClearSent: decision.kind === "clear" ? true : event.riskScore >= 2 ? false : previous?.allClearSent || false,
    };
  }
  await store().setJSON(ALERT_STATE_KEY, history);
  return sent;
}

export async function sendWeatherTestAlert() {
  const now = new Date();
  const test: EventWeather = {
    ...unavailableEvent({ id: "test", source: "calendar", sourceId: "test", title: "Big Papa's test event", location: "Amarillo, TX", start: now.toISOString(), end: new Date(now.getTime() + 3_600_000).toISOString(), allDay: false }),
    risk: "watch",
    riskScore: 1,
    summary: "Weather alerts are connected",
    recommendation: "No action is needed. This is a test notification.",
    reasons: ["Test notification from the Command Center"],
  };
  await sendPushover(test, "risk");
}
