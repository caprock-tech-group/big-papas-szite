import { createHash, randomUUID } from "node:crypto";
import { getStore } from "@netlify/blobs";
import type { PublicCalendarEvent } from "./calendar.mjs";
import { readUpcomingCalendarEvents } from "./calendar.mjs";

const STORE_NAME = "big-papas-facebook-calendar";
const DEFAULT_GRAPH_API_VERSION = "v25.0";
const PUBLIC_SCHEDULE_URL = "https://bigpapastaters.com/#schedule";
const DEFAULT_IMAGE_URLS = [
  "https://bigpapastaters.com/images/facebook-event-announcement.jpg",
  "https://bigpapastaters.com/images/facebook-event-big-hoss.jpg",
  "https://bigpapastaters.com/images/facebook-event-brand.jpg",
];
const HOUR_MILLISECONDS = 60 * 60 * 1_000;
const ANNOUNCEMENT_LEAD_MILLISECONDS = 24 * HOUR_MILLISECONDS;
const POSTING_WINDOW_START_HOUR = 8;
const POSTING_WINDOW_END_HOUR = 21;
const PENDING_LOCK_MILLISECONDS = 10 * 60 * 1_000;
const RETRY_DELAY_MILLISECONDS = 30 * 60 * 1_000;
const CENTRAL_HOUR_FORMATTER = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Chicago",
  hour: "2-digit",
  hourCycle: "h23",
});

export type CalendarFacebookPhase = "preview" | "reminder";

type FacebookConfig = {
  pageId: string;
  accessToken: string;
  graphApiVersion: string;
  imageUrls: string[];
};

type PhaseState = {
  status: "idle" | "pending" | "posted" | "failed";
  postId: string;
  lockId: string;
  attemptedAt: string;
  postedAt: string;
  error: string;
  retrySafe: boolean;
};

type CampaignState = {
  eventId: string;
  snapshotHash: string;
  title: string;
  location: string;
  start: string;
  end: string;
  allDay: boolean;
  lastSeenAt: string;
  preview: PhaseState;
  reminder: PhaseState;
};

type StateEntry = {
  state: CampaignState | null;
  etag?: string;
};

type ClaimedPhase = {
  key: string;
  phase: CalendarFacebookPhase;
  lockId: string;
};

type RunSummary = {
  configured: boolean;
  checked: number;
  posted: number;
  updated: number;
  skipped: number;
  failed: number;
};

class CalendarFacebookError extends Error {
  retrySafe: boolean;

  constructor(message: string, retrySafe: boolean) {
    super(message);
    this.name = "CalendarFacebookError";
    this.retrySafe = retrySafe;
  }
}

function campaignStore() {
  return getStore({ name: STORE_NAME, consistency: "strong" });
}

function cleanText(value: unknown, maximumLength: number) {
  if (typeof value !== "string") return "";
  return value
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maximumLength);
}

function validPostId(value: unknown) {
  return typeof value === "string" && /^[0-9_]{3,100}$/.test(value) ? value : "";
}

function validIsoDate(value: unknown) {
  return typeof value === "string" && !Number.isNaN(Date.parse(value)) ? value : "";
}

function phaseState(value: unknown): PhaseState {
  const record = value && typeof value === "object" ? value as Partial<PhaseState> : {};
  const status = record.status && ["idle", "pending", "posted", "failed"].includes(record.status)
    ? record.status
    : "idle";
  return {
    status,
    postId: validPostId(record.postId),
    lockId: cleanText(record.lockId, 80),
    attemptedAt: validIsoDate(record.attemptedAt),
    postedAt: validIsoDate(record.postedAt),
    error: cleanText(record.error, 240),
    retrySafe: record.retrySafe !== false,
  };
}

function normalizeCampaign(value: unknown): CampaignState | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Partial<CampaignState>;
  const eventId = cleanText(record.eventId, 500);
  const start = validIsoDate(record.start);
  const end = validIsoDate(record.end);
  if (!eventId || !start || !end) return null;
  return {
    eventId,
    snapshotHash: cleanText(record.snapshotHash, 64),
    title: cleanText(record.title, 180),
    location: cleanText(record.location, 240),
    start,
    end,
    allDay: record.allDay === true,
    lastSeenAt: validIsoDate(record.lastSeenAt),
    preview: phaseState(record.preview),
    reminder: phaseState(record.reminder),
  };
}

function emptyPhase(): PhaseState {
  return {
    status: "idle",
    postId: "",
    lockId: "",
    attemptedAt: "",
    postedAt: "",
    error: "",
    retrySafe: true,
  };
}

function snapshotHash(event: PublicCalendarEvent) {
  return createHash("sha256")
    .update(JSON.stringify({
      title: event.title,
      location: event.location,
      start: event.start,
      end: event.end,
      allDay: event.allDay,
    }))
    .digest("hex");
}

function campaignKey(eventId: string) {
  const digest = createHash("sha256").update(eventId).digest("hex");
  return `campaign-${digest}`;
}

function stateForEvent(event: PublicCalendarEvent, now: Date, current?: CampaignState | null): CampaignState {
  return {
    eventId: event.id,
    snapshotHash: snapshotHash(event),
    title: cleanText(event.title, 180),
    location: cleanText(event.location, 240),
    start: event.start,
    end: event.end,
    allDay: event.allDay,
    lastSeenAt: now.toISOString(),
    preview: current?.preview ?? emptyPhase(),
    reminder: current?.reminder ?? emptyPhase(),
  };
}

async function readState(key: string): Promise<StateEntry> {
  const entry = await campaignStore().getWithMetadata(key, {
    type: "json",
    consistency: "strong",
  });
  return {
    state: normalizeCampaign(entry?.data),
    etag: entry?.etag,
  };
}

async function writeState(key: string, state: CampaignState, entry: StateEntry) {
  return entry.etag
    ? campaignStore().setJSON(key, state, { onlyIfMatch: entry.etag })
    : campaignStore().setJSON(key, state, { onlyIfNew: true });
}

function getConfig(): FacebookConfig | null {
  const pageId = process.env.FACEBOOK_PAGE_ID?.trim() || "";
  const accessToken = process.env.FACEBOOK_PAGE_ACCESS_TOKEN?.trim() || "";
  const requestedVersion = process.env.FACEBOOK_GRAPH_API_VERSION?.trim() || DEFAULT_GRAPH_API_VERSION;
  const graphApiVersion = /^v\d+\.\d+$/.test(requestedVersion)
    ? requestedVersion
    : DEFAULT_GRAPH_API_VERSION;
  const requestedImageUrls = process.env.FACEBOOK_EVENT_IMAGE_URLS
    ?.split(/[\n,]/)
    .map((value) => value.trim())
    .filter(Boolean) || [];
  const legacyImageUrl = process.env.FACEBOOK_EVENT_IMAGE_URL?.trim() || "";
  const candidates = requestedImageUrls.length
    ? requestedImageUrls
    : legacyImageUrl
      ? [legacyImageUrl, ...DEFAULT_IMAGE_URLS]
      : DEFAULT_IMAGE_URLS;
  const imageUrls = Array.from(new Set(candidates.flatMap((value) => {
    try {
      const url = new URL(value);
      return url.protocol === "https:" ? [url.toString()] : [];
    } catch {
      return [];
    }
  })));

  if (!/^\d{3,30}$/.test(pageId) || accessToken.length < 20 || !imageUrls.length) return null;
  return { pageId, accessToken, graphApiVersion, imageUrls };
}

async function graphPost(config: FacebookConfig, path: string, fields: Record<string, string>) {
  const url = new URL(`https://graph.facebook.com/${config.graphApiVersion}/${path}`);
  const body = new URLSearchParams({ ...fields, access_token: config.accessToken });

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
      },
      body,
      signal: AbortSignal.timeout(12_000),
    });
  } catch (error) {
    const message = error instanceof Error && error.name === "TimeoutError"
      ? "Facebook took too long to confirm the post. Automatic retry was stopped to prevent a duplicate."
      : "Facebook did not confirm the post. Automatic retry was stopped to prevent a duplicate.";
    throw new CalendarFacebookError(message, false);
  }

  let result: Record<string, unknown> = {};
  try {
    result = await response.json() as Record<string, unknown>;
  } catch {
    result = {};
  }

  const graphError = result.error && typeof result.error === "object"
    ? result.error as { message?: unknown }
    : null;
  if (!response.ok || graphError) {
    const detail = cleanText(graphError?.message, 180);
    throw new CalendarFacebookError(
      detail ? `Facebook rejected the event post: ${detail}` : "Facebook rejected the event post.",
      true,
    );
  }
  return result;
}

function formatEventDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(new Date(value));
}

function formatEventTime(event: PublicCalendarEvent) {
  if (event.allDay) return "All day";
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    hour: "numeric",
    minute: "2-digit",
  });
  return `${formatter.format(new Date(event.start))}–${formatter.format(new Date(event.end))}`;
}

export function buildCalendarFacebookMessage(
  event: PublicCalendarEvent,
  phase: CalendarFacebookPhase,
) {
  const title = cleanText(event.title, 180) || "Big Papa's next stop";
  const lines = phase === "preview"
    ? ["🚚 BIG PAPA’S IS ROLLING OUT!", title]
    : ["⏰ BIG PAPA’S IS ROLLING OUT TODAY!", title];

  lines.push("", `📅 ${formatEventDate(event.start)}`);
  lines.push(`⏰ ${formatEventTime(event)}`);
  if (event.location) lines.push(`📍 ${cleanText(event.location, 240)}`);
  lines.push("", "Texas-sized loaded potatoes. Come hungry!");
  lines.push(`Stop details and full schedule: ${PUBLIC_SCHEDULE_URL}`);
  return lines.join("\n");
}

function centralHour(value: Date) {
  return Number(CENTRAL_HOUR_FORMATTER.format(value));
}

export function dueCalendarFacebookPhase(
  event: PublicCalendarEvent,
  now = new Date(),
): CalendarFacebookPhase | null {
  const remaining = Date.parse(event.start) - now.getTime();
  if (!Number.isFinite(remaining) || remaining <= 0) return null;
  if (remaining > ANNOUNCEMENT_LEAD_MILLISECONDS) return null;

  const hour = centralHour(now);
  if (hour < POSTING_WINDOW_START_HOUR || hour >= POSTING_WINDOW_END_HOUR) return null;

  return "preview";
}

function imageUrlForEvent(config: FacebookConfig, event: PublicCalendarEvent) {
  const digest = createHash("sha256").update(event.id).digest("hex");
  const index = Number.parseInt(digest.slice(0, 8), 16) % config.imageUrls.length;
  return config.imageUrls[index];
}

async function claimPhase(
  event: PublicCalendarEvent,
  phase: CalendarFacebookPhase,
  now: Date,
): Promise<ClaimedPhase | null> {
  const key = campaignKey(event.id);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const entry = await readState(key);
    const current = stateForEvent(event, now, entry.state);
    const phaseRecord = current[phase];

    if (phase === "preview" && current.reminder.status === "posted") return null;
    if (phaseRecord.status === "posted" || (phaseRecord.status === "failed" && !phaseRecord.retrySafe)) {
      return null;
    }
    if (phaseRecord.status === "pending") {
      const attemptedAt = Date.parse(phaseRecord.attemptedAt);
      if (Number.isFinite(attemptedAt) && attemptedAt > now.getTime() - PENDING_LOCK_MILLISECONDS) {
        return null;
      }
      const stopped: PhaseState = {
        ...phaseRecord,
        status: "failed",
        lockId: "",
        error: "The previous attempt ended without confirmation. Automatic retry was stopped to prevent a duplicate.",
        retrySafe: false,
      };
      const staleWrite = await writeState(key, { ...current, [phase]: stopped }, entry);
      if (staleWrite.modified) return null;
      continue;
    }
    if (phaseRecord.status === "failed" && phaseRecord.attemptedAt) {
      const attemptedAt = Date.parse(phaseRecord.attemptedAt);
      if (Number.isFinite(attemptedAt) && attemptedAt > now.getTime() - RETRY_DELAY_MILLISECONDS) {
        return null;
      }
    }

    const lockId = randomUUID();
    const pending: PhaseState = {
      ...phaseRecord,
      status: "pending",
      lockId,
      attemptedAt: now.toISOString(),
      error: "",
      retrySafe: true,
    };
    const write = await writeState(key, { ...current, [phase]: pending }, entry);
    if (write.modified) return { key, phase, lockId };
  }
  return null;
}

async function finishPhase(
  claim: ClaimedPhase,
  update: Partial<PhaseState>,
  now: Date,
) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const entry = await readState(claim.key);
    const current = entry.state;
    if (!current || !entry.etag || current[claim.phase].lockId !== claim.lockId) return false;
    const next: CampaignState = {
      ...current,
      lastSeenAt: now.toISOString(),
      [claim.phase]: {
        ...current[claim.phase],
        ...update,
        lockId: "",
      },
    };
    const write = await campaignStore().setJSON(claim.key, next, { onlyIfMatch: entry.etag });
    if (write.modified) return true;
  }
  return false;
}

async function updateExistingPosts(
  config: FacebookConfig,
  event: PublicCalendarEvent,
  now: Date,
) {
  const key = campaignKey(event.id);
  const entry = await readState(key);
  if (!entry.state || entry.state.snapshotHash === snapshotHash(event)) return 0;

  let updated = 0;
  for (const phase of ["preview", "reminder"] as const) {
    const postId = entry.state[phase].status === "posted" ? entry.state[phase].postId : "";
    if (!postId) continue;
    await graphPost(config, postId, { message: buildCalendarFacebookMessage(event, phase) });
    updated += 1;
  }

  const latest = await readState(key);
  if (latest.state && latest.etag) {
    await campaignStore().setJSON(key, stateForEvent(event, now, latest.state), { onlyIfMatch: latest.etag });
  }
  return updated;
}

async function publishPhase(
  config: FacebookConfig,
  event: PublicCalendarEvent,
  phase: CalendarFacebookPhase,
  now: Date,
) {
  const claim = await claimPhase(event, phase, now);
  if (!claim) return "skipped" as const;

  try {
    const result = await graphPost(config, `${config.pageId}/photos`, {
      url: imageUrlForEvent(config, event),
      caption: buildCalendarFacebookMessage(event, phase),
      published: "true",
    });
    const postId = validPostId(result.post_id) || validPostId(result.id);
    if (!postId) {
      throw new CalendarFacebookError(
        "Facebook published the photo but did not return a post ID. Automatic retry was stopped to prevent a duplicate.",
        false,
      );
    }
    await finishPhase(claim, {
      status: "posted",
      postId,
      postedAt: now.toISOString(),
      error: "",
      retrySafe: true,
    }, now);
    return "posted" as const;
  } catch (error) {
    const message = error instanceof Error
      ? cleanText(error.message, 240)
      : "Facebook could not publish the event announcement.";
    const retrySafe = error instanceof CalendarFacebookError ? error.retrySafe : false;
    await finishPhase(claim, {
      status: "failed",
      error: message,
      retrySafe,
    }, now);
    console.error(`Could not publish the ${phase} Facebook event announcement`, message);
    return "failed" as const;
  }
}

export async function runCalendarFacebookAutomation(now = new Date()): Promise<RunSummary> {
  const config = getConfig();
  if (!config) {
    return { configured: false, checked: 0, posted: 0, updated: 0, skipped: 0, failed: 0 };
  }

  const calendar = await readUpcomingCalendarEvents({ limit: 50 });
  if (!calendar.configured) {
    return { configured: false, checked: 0, posted: 0, updated: 0, skipped: 0, failed: 0 };
  }

  const summary: RunSummary = {
    configured: true,
    checked: calendar.events.length,
    posted: 0,
    updated: 0,
    skipped: 0,
    failed: 0,
  };

  for (const event of calendar.events) {
    try {
      summary.updated += await updateExistingPosts(config, event, now);
      const phase = dueCalendarFacebookPhase(event, now);
      if (!phase) {
        summary.skipped += 1;
        continue;
      }
      const outcome = await publishPhase(config, event, phase, now);
      summary[outcome] += 1;
    } catch (error) {
      summary.failed += 1;
      console.error("Could not synchronize a Google Calendar event with Facebook", error);
    }
  }

  return summary;
}
