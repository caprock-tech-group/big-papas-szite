import { getStore } from "@netlify/blobs";

const STORE_NAME = "big-papas-event-planner";
const STORE_KEY = "events";
const MAX_EVENTS = 80;
const MAX_ITEMS = 24;

export type EventMenuItem = {
  id: string;
  name: string;
  mix: number;
  actualSold: number | null;
  leftover: number | null;
};

export type EventPlan = {
  id: string;
  name: string;
  location: string;
  eventDate: string;
  setupTime: string;
  openTime: string;
  closeTime: string;
  attendance: number;
  captureRate: number;
  bufferRate: number;
  crewCount: number;
  batchSize: number;
  cycleMinutes: number;
  openingReady: number;
  openingCooking: number;
  notes: string;
  menu: EventMenuItem[];
  actualOrders: number | null;
  actualWaste: number | null;
  peakFifteen: number | null;
  reviewNotes: string;
  paceLog: string[][];
  productionLog: string[][];
  tempLog: string[][];
  createdAt: string;
  updatedAt: string;
};

export type EventPlannerState = {
  version: 1;
  revision: number;
  updatedAt: string;
  events: EventPlan[];
};

const defaultMenu = [
  ["big-hoss", "The Big Hoss", 30],
  ["taco-tater", "Taco Tater", 15],
  ["mac-daddy", "Mac Daddy", 15],
  ["italian-stallion", "The Italian Stallion", 10],
  ["broccoli-cheddar", "Broccoli Cheddar", 10],
  ["chicken-fried-steak-tater", "Chicken Fried Steak Tater", 15],
  ["breakfast-tater", "Breakfast Tater", 5],
] as const;

function store() {
  return getStore({ name: STORE_NAME, consistency: "strong" });
}

function cleanText(value: unknown, limit: number, fallback = "") {
  if (typeof value !== "string") return fallback;
  return value.replace(/[\u0000-\u001F\u007F]/g, " ").replace(/\s+/g, " ").trim().slice(0, limit) || fallback;
}

function cleanMultiline(value: unknown, limit: number) {
  if (typeof value !== "string") return "";
  return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, " ").trim().slice(0, limit);
}

function numberInRange(value: unknown, minimum: number, maximum: number, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(maximum, Math.max(minimum, parsed)) : fallback;
}

function optionalNumber(value: unknown, minimum: number, maximum: number) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(Math.min(maximum, Math.max(minimum, parsed))) : null;
}

function cleanId(value: unknown, fallback: string) {
  const id = cleanText(value, 64).toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");
  return id || fallback;
}

function cleanDate(value: unknown, fallback: string) {
  const text = cleanText(value, 10, fallback);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : fallback;
}

function cleanTime(value: unknown, fallback: string) {
  const text = cleanText(value, 5, fallback);
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(text) ? text : fallback;
}

function newDefaultEvent(): EventPlan {
  const now = new Date();
  const eventDate = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago" }).format(now);
  return {
    id: `event-${now.getTime().toString(36)}`,
    name: "New event",
    location: "",
    eventDate,
    setupTime: "17:00",
    openTime: "18:00",
    closeTime: "21:00",
    attendance: 300,
    captureRate: 30,
    bufferRate: 10,
    crewCount: 3,
    batchSize: 30,
    cycleMinutes: 55,
    openingReady: 60,
    openingCooking: 30,
    notes: "",
    menu: defaultMenu.map(([id, name, mix]) => ({ id, name, mix, actualSold: null, leftover: null })),
    actualOrders: null,
    actualWaste: null,
    peakFifteen: null,
    reviewNotes: "",
    paceLog: [],
    productionLog: [],
    tempLog: [],
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
}

function template2590(): EventPlan {
  const event = newDefaultEvent();
  return {
    ...event,
    id: "template-2590-food-truck-park",
    name: "2590 Food Truck Park",
    location: "2590 Food Truck Park",
    setupTime: "17:00",
    openTime: "18:00",
    closeTime: "21:00",
    attendance: 300,
    captureRate: 30,
    notes: "Opening target: 60 ready + 30 cooking. Reheat hot toppings first; once potato production starts, keep the combi dedicated to potatoes unless the PIC calls a recovery.",
  };
}

function normalizeMenu(value: unknown) {
  if (!Array.isArray(value)) return newDefaultEvent().menu;
  const used = new Set<string>();
  return value.slice(0, MAX_ITEMS).map((entry, index) => {
    const record = entry && typeof entry === "object" ? entry as Partial<EventMenuItem> : {};
    const fallback = defaultMenu[index] ?? [`item-${index + 1}`, `Menu item ${index + 1}`, 0];
    let id = cleanId(record.id, fallback[0]);
    if (used.has(id)) id = `${id}-${index + 1}`;
    used.add(id);
    return {
      id,
      name: cleanText(record.name, 70, fallback[1]),
      mix: Math.round(numberInRange(record.mix, 0, 100, fallback[2]) * 10) / 10,
      actualSold: optionalNumber(record.actualSold, 0, 10000),
      leftover: optionalNumber(record.leftover, 0, 10000),
    };
  });
}

function normalizeLog(value: unknown, columns: number) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 120).map((row) => {
    const cells = Array.isArray(row) ? row : [];
    return Array.from({ length: columns }, (_, index) => cleanText(cells[index], 140));
  });
}

function normalizeEvent(value: unknown, fallback = newDefaultEvent()): EventPlan {
  const record = value && typeof value === "object" ? value as Partial<EventPlan> : {};
  const now = new Date().toISOString();
  const createdAt = typeof record.createdAt === "string" && Number.isFinite(Date.parse(record.createdAt)) ? record.createdAt : now;
  const updatedAt = typeof record.updatedAt === "string" && Number.isFinite(Date.parse(record.updatedAt)) ? record.updatedAt : now;
  return {
    id: cleanId(record.id, fallback.id),
    name: cleanText(record.name, 100, fallback.name),
    location: cleanText(record.location, 140),
    eventDate: cleanDate(record.eventDate, fallback.eventDate),
    setupTime: cleanTime(record.setupTime, fallback.setupTime),
    openTime: cleanTime(record.openTime, fallback.openTime),
    closeTime: cleanTime(record.closeTime, fallback.closeTime),
    attendance: Math.round(numberInRange(record.attendance, 0, 100000, fallback.attendance)),
    captureRate: Math.round(numberInRange(record.captureRate, 0, 100, fallback.captureRate) * 10) / 10,
    bufferRate: Math.round(numberInRange(record.bufferRate, 0, 100, fallback.bufferRate) * 10) / 10,
    crewCount: Math.round(numberInRange(record.crewCount, 1, 30, fallback.crewCount)),
    batchSize: Math.round(numberInRange(record.batchSize, 1, 200, fallback.batchSize)),
    cycleMinutes: Math.round(numberInRange(record.cycleMinutes, 1, 240, fallback.cycleMinutes)),
    openingReady: Math.round(numberInRange(record.openingReady, 0, 1000, fallback.openingReady)),
    openingCooking: Math.round(numberInRange(record.openingCooking, 0, 1000, fallback.openingCooking)),
    notes: cleanMultiline(record.notes, 2000),
    menu: normalizeMenu(record.menu),
    actualOrders: optionalNumber(record.actualOrders, 0, 100000),
    actualWaste: optionalNumber(record.actualWaste, 0, 100000),
    peakFifteen: optionalNumber(record.peakFifteen, 0, 10000),
    reviewNotes: cleanMultiline(record.reviewNotes, 4000),
    paceLog: normalizeLog(record.paceLog, 5),
    productionLog: normalizeLog(record.productionLog, 5),
    tempLog: normalizeLog(record.tempLog, 5),
    createdAt,
    updatedAt,
  };
}

function normalizeState(value: unknown): EventPlannerState {
  const record = value && typeof value === "object" ? value as Partial<EventPlannerState> : {};
  const events = Array.isArray(record.events) ? record.events.slice(0, MAX_EVENTS).map((entry) => normalizeEvent(entry)) : [];
  const revision = Number.isInteger(record.revision) && Number(record.revision) > 0 ? Number(record.revision) : 1;
  return {
    version: 1,
    revision,
    updatedAt: typeof record.updatedAt === "string" && Number.isFinite(Date.parse(record.updatedAt)) ? record.updatedAt : new Date().toISOString(),
    events,
  };
}

export function createEventTemplate(kind: unknown) {
  return kind === "2590" ? template2590() : newDefaultEvent();
}

export async function readEventPlannerState() {
  const value = await store().get(STORE_KEY, { type: "json", consistency: "strong" });
  return normalizeState(value);
}

export async function saveEventPlannerState(input: unknown, expectedRevision: unknown) {
  const current = await readEventPlannerState();
  if (Number(expectedRevision) !== current.revision) throw new Error("EVENTS_CHANGED");
  const normalized = normalizeState(input);
  const now = new Date().toISOString();
  const state: EventPlannerState = {
    version: 1,
    revision: current.revision + 1,
    updatedAt: now,
    events: normalized.events.map((event) => ({ ...event, updatedAt: now })),
  };
  await store().setJSON(STORE_KEY, state);
  return state;
}
