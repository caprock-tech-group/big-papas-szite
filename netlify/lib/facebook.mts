import { randomUUID } from "node:crypto";
import { getStore } from "@netlify/blobs";
import type { LiveLocation } from "./location.mjs";

const STORE_NAME = "big-papas-live-location";
const STATE_KEY = "facebook-automation";
const DEFAULT_GRAPH_API_VERSION = "v25.0";
const PENDING_LOCK_MILLISECONDS = 60_000;
const PUBLIC_TRACKER_URL = "https://bigpapastaters.com/#find-us";
const ONLINE_ORDER_URL = "https://online.skytab.com/s/bigpapastexasloadedpotatoes";

type FacebookOperation = "open" | "close";
type StoredFacebookState = {
  status: "pending" | "open" | "closed" | "failed";
  operation: FacebookOperation;
  postId: string;
  pinUpdatedAt: string;
  lockId: string;
  pendingAt: string;
  lastAttemptAt: string;
  lastSyncedAt: string;
  lastAction: "posted" | "updated" | "closed" | "";
  error: string;
  retrySafe: boolean;
};

export type FacebookAdminStatus = {
  configured: boolean;
  state: "not_configured" | "ready" | "pending" | "open" | "closed" | "failed";
  message: string;
  canRetry: boolean;
  requiresConfirmation: boolean;
  lastAction: StoredFacebookState["lastAction"];
};

type FacebookConfig = {
  pageId: string;
  accessToken: string;
  graphApiVersion: string;
};

type StateEntry = {
  state: StoredFacebookState | null;
  etag?: string;
};

type AcquiredState = {
  kind: "acquired";
  state: StoredFacebookState;
};

type UnacquiredState = {
  kind: "busy" | "closed_without_post";
  state: StoredFacebookState | null;
};

function facebookStore() {
  return getStore({ name: STORE_NAME, consistency: "strong" });
}

function cleanText(value: unknown, maximumLength: number) {
  if (typeof value !== "string") return "";
  return value.replace(/[\u0000-\u001F\u007F]/g, " ").replace(/\s+/g, " ").trim().slice(0, maximumLength);
}

function validPostId(value: unknown) {
  return typeof value === "string" && /^[0-9_]{3,100}$/.test(value) ? value : "";
}

function validIsoDate(value: unknown) {
  return typeof value === "string" && !Number.isNaN(Date.parse(value)) ? value : "";
}

function normalizeState(value: unknown): StoredFacebookState | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Partial<StoredFacebookState>;
  const status = record.status;
  const operation = record.operation;
  if (
    !status ||
    !["pending", "open", "closed", "failed"].includes(status) ||
    !operation ||
    !["open", "close"].includes(operation)
  ) {
    return null;
  }

  const lastAction = record.lastAction;
  return {
    status,
    operation,
    postId: validPostId(record.postId),
    pinUpdatedAt: validIsoDate(record.pinUpdatedAt),
    lockId: cleanText(record.lockId, 80),
    pendingAt: validIsoDate(record.pendingAt),
    lastAttemptAt: validIsoDate(record.lastAttemptAt),
    lastSyncedAt: validIsoDate(record.lastSyncedAt),
    lastAction: lastAction && ["posted", "updated", "closed"].includes(lastAction) ? lastAction : "",
    error: cleanText(record.error, 240),
    retrySafe: record.retrySafe !== false,
  };
}

async function readStateEntry(): Promise<StateEntry> {
  const entry = await facebookStore().getWithMetadata(STATE_KEY, {
    type: "json",
    consistency: "strong",
  });
  return {
    state: normalizeState(entry?.data),
    etag: entry?.etag,
  };
}

function getConfig(): FacebookConfig | null {
  const pageId = process.env.FACEBOOK_PAGE_ID?.trim() || "";
  const accessToken = process.env.FACEBOOK_PAGE_ACCESS_TOKEN?.trim() || "";
  const requestedVersion = process.env.FACEBOOK_GRAPH_API_VERSION?.trim() || DEFAULT_GRAPH_API_VERSION;
  const graphApiVersion = /^v\d+\.\d+$/.test(requestedVersion)
    ? requestedVersion
    : DEFAULT_GRAPH_API_VERSION;

  if (!/^\d{3,30}$/.test(pageId) || accessToken.length < 20) return null;
  return { pageId, accessToken, graphApiVersion };
}

function statusFromState(configured: boolean, state: StoredFacebookState | null): FacebookAdminStatus {
  if (!configured) {
    return {
      configured: false,
      state: "not_configured",
      message: "Connect the Facebook Page in Netlify to turn on automatic posts.",
      canRetry: false,
      requiresConfirmation: false,
      lastAction: "",
    };
  }
  if (!state) {
    return {
      configured: true,
      state: "ready",
      message: "Connected — the next live pin will post automatically.",
      canRetry: false,
      requiresConfirmation: false,
      lastAction: "",
    };
  }
  if (state.status === "pending") {
    return {
      configured: true,
      state: "pending",
      message: "Facebook is still processing this update.",
      canRetry: false,
      requiresConfirmation: false,
      lastAction: state.lastAction,
    };
  }
  if (state.status === "open") {
    const message = state.lastAction === "updated"
      ? "The existing Facebook post was updated with this stop."
      : "The live-location post is published on Facebook.";
    return {
      configured: true,
      state: "open",
      message,
      canRetry: false,
      requiresConfirmation: false,
      lastAction: state.lastAction,
    };
  }
  if (state.status === "closed") {
    return {
      configured: true,
      state: "closed",
      message: "The previous Facebook post is marked closed.",
      canRetry: false,
      requiresConfirmation: false,
      lastAction: state.lastAction,
    };
  }
  return {
    configured: true,
    state: "failed",
    message: state.error || "Facebook could not be updated. Check the connection and try again.",
    canRetry: true,
    requiresConfirmation: !state.retrySafe,
    lastAction: state.lastAction,
  };
}

export async function getFacebookAdminStatus(): Promise<FacebookAdminStatus> {
  const config = getConfig();
  if (!config) return statusFromState(false, null);
  try {
    const { state } = await readStateEntry();
    return statusFromState(true, state);
  } catch (error) {
    console.error("Could not read the Facebook automation state", error);
    return {
      configured: true,
      state: "failed",
      message: "Facebook status is temporarily unavailable.",
      canRetry: true,
      requiresConfirmation: false,
      lastAction: "",
    };
  }
}

function formatExpiration(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "later today";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function buildOpenFacebookMessage(location: LiveLocation) {
  const lines = ["📍 BIG PAPA’S IS OPEN!"];
  lines.push(
    location.locationName
      ? `We’re parked at ${location.locationName}.`
      : "We’re parked and serving — tap below for our live location.",
  );
  if (location.hours) lines.push(`⏰ ${location.hours}`);
  if (location.note) lines.push(location.note);
  lines.push(`Live location available until ${formatExpiration(location.expiresAt)}.`);
  lines.push("", `Live map + directions: ${PUBLIC_TRACKER_URL}`);
  lines.push(`Order ahead: ${ONLINE_ORDER_URL}`);
  return lines.join("\n");
}

export function buildClosedFacebookMessage() {
  return [
    "Big Papa’s is closed for this stop.",
    "Thanks for coming out! Follow our Page for the next stop and watch our live tracker for the next pin.",
    "",
    `Latest location: ${PUBLIC_TRACKER_URL}`,
  ].join("\n");
}

function facebookError(error: unknown, retryIsIdempotent: boolean) {
  if (error instanceof Error && error.name === "TimeoutError") {
    return {
      message: "Facebook took too long to respond. Check the Page before republishing so a post is not duplicated.",
      retrySafe: retryIsIdempotent,
    };
  }
  const message = error instanceof Error ? cleanText(error.message, 210) : "Facebook could not be updated.";
  return { message: message || "Facebook could not be updated.", retrySafe: true };
}

async function graphPost(config: FacebookConfig, path: string, fields: Record<string, string>) {
  const url = new URL(`https://graph.facebook.com/${config.graphApiVersion}/${path}`);
  const body = new URLSearchParams({ ...fields, access_token: config.accessToken });
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
    },
    body,
    signal: AbortSignal.timeout(12_000),
  });

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
    throw new Error(detail ? `Facebook rejected the update: ${detail}` : "Facebook rejected the update.");
  }
  return result;
}

async function writeConditionalState(state: StoredFacebookState, entry: StateEntry) {
  return entry.etag
    ? facebookStore().setJSON(STATE_KEY, state, { onlyIfMatch: entry.etag })
    : facebookStore().setJSON(STATE_KEY, state, { onlyIfNew: true });
}

async function acquireState(
  operation: FacebookOperation,
  pinUpdatedAt: string,
  reuseExistingPost: boolean,
): Promise<AcquiredState | UnacquiredState> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const entry = await readStateEntry();
    const current = entry.state;
    if (
      current?.status === "pending" &&
      current.pendingAt &&
      Date.parse(current.pendingAt) > Date.now() - PENDING_LOCK_MILLISECONDS
    ) {
      return { kind: "busy", state: current };
    }

    if (operation === "close" && current?.status === "closed") {
      return { kind: "closed_without_post", state: current };
    }

    const postId = operation === "close" || reuseExistingPost ? current?.postId || "" : "";
    const now = new Date().toISOString();
    if (operation === "close" && !postId) {
      const closedState: StoredFacebookState = {
        status: "closed",
        operation: "close",
        postId: "",
        pinUpdatedAt,
        lockId: "",
        pendingAt: "",
        lastAttemptAt: now,
        lastSyncedAt: now,
        lastAction: "closed",
        error: "",
        retrySafe: true,
      };
      const write = await writeConditionalState(closedState, entry);
      if (write.modified) return { kind: "closed_without_post", state: closedState };
      continue;
    }

    const pendingState: StoredFacebookState = {
      status: "pending",
      operation,
      postId,
      pinUpdatedAt,
      lockId: randomUUID(),
      pendingAt: now,
      lastAttemptAt: now,
      lastSyncedAt: current?.lastSyncedAt || "",
      lastAction: current?.lastAction || "",
      error: "",
      retrySafe: true,
    };
    const write = await writeConditionalState(pendingState, entry);
    if (write.modified) return { kind: "acquired", state: pendingState };
  }
  return { kind: "busy", state: null };
}

async function finishState(
  lockId: string,
  update: Partial<StoredFacebookState>,
): Promise<StoredFacebookState | null> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const entry = await readStateEntry();
    if (!entry.state || entry.state.lockId !== lockId || !entry.etag) return null;
    const next: StoredFacebookState = {
      ...entry.state,
      ...update,
      lockId: "",
      pendingAt: "",
    };
    const write = await facebookStore().setJSON(STATE_KEY, next, { onlyIfMatch: entry.etag });
    if (write.modified) return next;
  }
  return null;
}

function pendingStatus(state: StoredFacebookState | null): FacebookAdminStatus {
  return statusFromState(true, state || {
    status: "pending",
    operation: "open",
    postId: "",
    pinUpdatedAt: "",
    lockId: "",
    pendingAt: new Date().toISOString(),
    lastAttemptAt: new Date().toISOString(),
    lastSyncedAt: "",
    lastAction: "",
    error: "",
    retrySafe: true,
  });
}

export async function syncFacebookOpen(
  location: LiveLocation,
  options: { reuseExistingPost?: boolean; allowAmbiguousRetry?: boolean } = {},
): Promise<FacebookAdminStatus> {
  const config = getConfig();
  if (!config) return statusFromState(false, null);

  try {
    const initial = await readStateEntry();
    if (
      initial.state?.status === "failed" &&
      initial.state.operation === "open" &&
      !initial.state.retrySafe &&
      !initial.state.postId &&
      !options.allowAmbiguousRetry
    ) {
      return statusFromState(true, initial.state);
    }

    if (!options.reuseExistingPost) {
      if (initial.state?.postId && initial.state.status !== "closed") {
        const closeStatus = await syncFacebookClosed(location.updatedAt);
        if (closeStatus.state === "failed" || closeStatus.state === "pending") {
          return {
            ...closeStatus,
            message: "The new pin is live, but the previous Facebook post could not be closed. Retry below.",
          };
        }
      }
    }

    const acquired = await acquireState("open", location.updatedAt, Boolean(options.reuseExistingPost));
    if (acquired.kind !== "acquired") return pendingStatus(acquired.state);

    try {
      const message = buildOpenFacebookMessage(location);
      let postId = acquired.state.postId;
      let lastAction: StoredFacebookState["lastAction"] = "updated";
      if (postId) {
        await graphPost(config, postId, { message });
      } else {
        const result = await graphPost(config, `${config.pageId}/feed`, {
          message,
          link: PUBLIC_TRACKER_URL,
        });
        postId = validPostId(result.id);
        if (!postId) throw new Error("Facebook published the request but did not return a post ID.");
        lastAction = "posted";
      }

      const completed = await finishState(acquired.state.lockId, {
        status: "open",
        operation: "open",
        postId,
        pinUpdatedAt: location.updatedAt,
        lastSyncedAt: new Date().toISOString(),
        lastAction,
        error: "",
        retrySafe: true,
      });
      return statusFromState(true, completed || { ...acquired.state, status: "open", postId, lastAction });
    } catch (error) {
      const failure = facebookError(error, Boolean(acquired.state.postId));
      const failed = await finishState(acquired.state.lockId, {
        status: "failed",
        operation: "open",
        error: failure.message,
        retrySafe: failure.retrySafe,
      });
      return statusFromState(true, failed || { ...acquired.state, status: "failed", error: failure.message, retrySafe: failure.retrySafe });
    }
  } catch (error) {
    console.error("Could not synchronize the Facebook open post", error);
    return {
      configured: true,
      state: "failed",
      message: "The location is live, but Facebook could not be updated.",
      canRetry: true,
      requiresConfirmation: false,
      lastAction: "",
    };
  }
}

export async function syncFacebookClosed(pinUpdatedAt = new Date().toISOString()): Promise<FacebookAdminStatus> {
  const config = getConfig();
  if (!config) return statusFromState(false, null);

  try {
    const acquired = await acquireState("close", pinUpdatedAt, true);
    if (acquired.kind === "busy") return pendingStatus(acquired.state);
    if (acquired.kind === "closed_without_post") return statusFromState(true, acquired.state);

    try {
      await graphPost(config, acquired.state.postId, { message: buildClosedFacebookMessage() });
      const completed = await finishState(acquired.state.lockId, {
        status: "closed",
        operation: "close",
        lastSyncedAt: new Date().toISOString(),
        lastAction: "closed",
        error: "",
        retrySafe: true,
      });
      return statusFromState(true, completed || { ...acquired.state, status: "closed", lastAction: "closed" });
    } catch (error) {
      const failure = facebookError(error, true);
      const failed = await finishState(acquired.state.lockId, {
        status: "failed",
        operation: "close",
        error: failure.message,
        retrySafe: failure.retrySafe,
      });
      return statusFromState(true, failed || { ...acquired.state, status: "failed", error: failure.message, retrySafe: failure.retrySafe });
    }
  } catch (error) {
    console.error("Could not synchronize the Facebook closed post", error);
    return {
      configured: true,
      state: "failed",
      message: "The pin is closed, but Facebook could not be updated.",
      canRetry: true,
      requiresConfirmation: false,
      lastAction: "",
    };
  }
}

export async function retryFacebookAutomation(
  location: LiveLocation | null,
  expired: boolean,
  confirmedNoPost = false,
) {
  const entry = await readStateEntry().catch(() => ({ state: null } as StateEntry));
  if (!location || expired) return syncFacebookClosed(location?.updatedAt);

  if (entry.state?.status === "failed" && !entry.state.retrySafe && !confirmedNoPost) {
    return statusFromState(true, entry.state);
  }

  if (entry.state?.operation === "close") {
    const closeStatus = await syncFacebookClosed(location.updatedAt);
    if (closeStatus.state === "failed" || closeStatus.state === "pending") return closeStatus;
    return syncFacebookOpen(location, { reuseExistingPost: false });
  }

  return syncFacebookOpen(location, {
    reuseExistingPost: Boolean(entry.state?.postId && entry.state.status !== "closed"),
    allowAmbiguousRetry: confirmedNoPost,
  });
}

export function facebookCloseFinished(status: FacebookAdminStatus) {
  return status.state === "closed" || status.state === "ready" || status.state === "not_configured";
}
