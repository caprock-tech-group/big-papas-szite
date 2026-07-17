import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { getStore } from "@netlify/blobs";

export const SESSION_COOKIE = "__Host-bigpapas_location_admin";
const STORE_NAME = "big-papas-live-location";
const STORE_KEY = "current";
const SESSION_SECONDS = 60 * 60 * 24 * 30;
const ALLOWED_EXPIRATION_HOURS = new Set([4, 8, 12]);

export type LiveLocation = {
  live: true;
  latitude: number;
  longitude: number;
  accuracy: number | null;
  locationName: string;
  hours: string;
  note: string;
  updatedAt: string;
  expiresAt: string;
};

type PublishInput = {
  latitude?: unknown;
  longitude?: unknown;
  accuracy?: unknown;
  locationName?: unknown;
  hours?: unknown;
  note?: unknown;
  expiresHours?: unknown;
};

function locationStore() {
  return getStore({ name: STORE_NAME, consistency: "strong" });
}

function cleanText(value: unknown, maximumLength: number) {
  if (typeof value !== "string") return "";
  return value.replace(/[\u0000-\u001F\u007F]/g, " ").replace(/\s+/g, " ").trim().slice(0, maximumLength);
}

function finiteNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : null;
}

function normalizeStoredLocation(value: unknown): LiveLocation | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Partial<LiveLocation>;
  const latitude = finiteNumber(record.latitude);
  const longitude = finiteNumber(record.longitude);
  const updatedAt = typeof record.updatedAt === "string" ? record.updatedAt : "";
  const expiresAt = typeof record.expiresAt === "string" ? record.expiresAt : "";

  if (
    record.live !== true ||
    latitude === null ||
    longitude === null ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180 ||
    Number.isNaN(Date.parse(updatedAt)) ||
    Number.isNaN(Date.parse(expiresAt))
  ) {
    return null;
  }

  const accuracy = finiteNumber(record.accuracy);
  return {
    live: true,
    latitude,
    longitude,
    accuracy: accuracy === null ? null : Math.max(0, Math.round(accuracy)),
    locationName: cleanText(record.locationName, 80),
    hours: cleanText(record.hours, 80),
    note: cleanText(record.note, 180),
    updatedAt,
    expiresAt,
  };
}

export function validatePublishInput(input: PublishInput): LiveLocation {
  const latitude = finiteNumber(input.latitude);
  const longitude = finiteNumber(input.longitude);
  if (latitude === null || latitude < -90 || latitude > 90) {
    throw new Error("The latitude is invalid. Capture your location again.");
  }
  if (longitude === null || longitude < -180 || longitude > 180) {
    throw new Error("The longitude is invalid. Capture your location again.");
  }

  const rawAccuracy = finiteNumber(input.accuracy);
  const requestedHours = finiteNumber(input.expiresHours);
  const expiresHours = requestedHours !== null && ALLOWED_EXPIRATION_HOURS.has(requestedHours)
    ? requestedHours
    : 8;
  const now = new Date();

  return {
    live: true,
    latitude: Number(latitude.toFixed(6)),
    longitude: Number(longitude.toFixed(6)),
    accuracy: rawAccuracy === null ? null : Math.min(50_000, Math.max(0, Math.round(rawAccuracy))),
    locationName: cleanText(input.locationName, 80),
    hours: cleanText(input.hours, 80),
    note: cleanText(input.note, 180),
    updatedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + expiresHours * 60 * 60 * 1000).toISOString(),
  };
}

export async function readStoredLocation() {
  const value = await locationStore().get(STORE_KEY, { type: "json", consistency: "strong" });
  const location = normalizeStoredLocation(value);
  return {
    location,
    expired: Boolean(location && Date.parse(location.expiresAt) <= Date.now()),
  };
}

export async function publishLocation(location: LiveLocation) {
  await locationStore().setJSON(STORE_KEY, location);
  return location;
}

export async function clearLocation() {
  await locationStore().delete(STORE_KEY);
}

export function toPublicLocation(location: LiveLocation) {
  const { accuracy: _accuracy, ...publicLocation } = location;
  return publicLocation;
}

function configuredPassword() {
  const password = process.env.LOCATION_ADMIN_PASSWORD;
  return typeof password === "string" && password.length >= 12 ? password : null;
}

export function isPasswordConfigured() {
  return configuredPassword() !== null;
}

export function verifyPassword(candidate: unknown) {
  const password = configuredPassword();
  if (!password || typeof candidate !== "string" || candidate.length > 256) return false;
  const expected = createHash("sha256").update(password, "utf8").digest();
  const supplied = createHash("sha256").update(candidate, "utf8").digest();
  return timingSafeEqual(expected, supplied);
}

function sessionSignature(payload: string, password: string) {
  return createHmac("sha256", password).update(payload).digest("base64url");
}

export function createSessionCookie() {
  const password = configuredPassword();
  if (!password) throw new Error("Shared password is not configured.");
  const payload = Buffer.from(
    JSON.stringify({ version: 1, expiresAt: Math.floor(Date.now() / 1000) + SESSION_SECONDS }),
  ).toString("base64url");
  const signature = sessionSignature(payload, password);
  return `${SESSION_COOKIE}=${payload}.${signature}; Path=/; Max-Age=${SESSION_SECONDS}; HttpOnly; Secure; SameSite=Strict`;
}

export function clearSessionCookie() {
  return `${SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict`;
}

function cookieValue(request: Request, name: string) {
  const cookieHeader = request.headers.get("cookie") || "";
  for (const part of cookieHeader.split(";")) {
    const separatorIndex = part.indexOf("=");
    if (separatorIndex < 0) continue;
    if (part.slice(0, separatorIndex).trim() === name) return part.slice(separatorIndex + 1).trim();
  }
  return null;
}

export function hasValidSession(request: Request) {
  const password = configuredPassword();
  const value = cookieValue(request, SESSION_COOKIE);
  if (!password || !value) return false;
  const [payload, signature, extra] = value.split(".");
  if (!payload || !signature || extra) return false;

  const expected = Buffer.from(sessionSignature(payload, password));
  const supplied = Buffer.from(signature);
  if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) return false;

  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      version?: unknown;
      expiresAt?: unknown;
    };
    return session.version === 1 && typeof session.expiresAt === "number" && session.expiresAt > Date.now() / 1000;
  } catch {
    return false;
  }
}

export function isSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    const requestUrl = new URL(request.url);
    const originUrl = new URL(origin);
    return requestUrl.host === originUrl.host && requestUrl.protocol === originUrl.protocol;
  } catch {
    return false;
  }
}

export function json(data: unknown, status = 200, extraHeaders: HeadersInit = {}) {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store, max-age=0",
      "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
      "X-Robots-Tag": "noindex, nofollow",
      ...Object.fromEntries(new Headers(extraHeaders)),
    },
  });
}
