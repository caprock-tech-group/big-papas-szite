import { getStore } from "@netlify/blobs";

const STORE_NAME = "big-papas-menu-board";
const STORE_KEY = "current";
const MAX_PRODUCTS = 24;
const MAX_SMALL_ITEMS = 24;

export type BoardOrientation = "auto" | "landscape" | "portrait";
export type MenuAccent = "red" | "blue" | "gold";

export type BoardProduct = {
  id: string;
  name: string;
  eyebrow: string;
  price: string;
  description: string;
  accent: MenuAccent;
  isNew: boolean;
  available: boolean;
  visible: boolean;
};

export type BoardSmallItem = {
  id: string;
  name: string;
  price: string;
  available: boolean;
  visible: boolean;
};

export type MenuBoardState = {
  version: 1;
  revision: number;
  updatedAt: string;
  board: {
    orientation: BoardOrientation;
    headline: string;
    subheadline: string;
    announcement: string;
    showDescriptions: boolean;
  };
  products: BoardProduct[];
  addOns: BoardSmallItem[];
  drinks: BoardSmallItem[];
  combo: {
    enabled: boolean;
    label: string;
    description: string;
    price: string;
  };
};

const defaultState: MenuBoardState = {
  version: 1,
  revision: 1,
  updatedAt: "2026-08-08T00:00:00.000Z",
  board: {
    orientation: "auto",
    headline: "Texas Loaded Potatoes",
    subheadline: "Bold flavor. Texas style. Big portions.",
    announcement: "",
    showDescriptions: true,
  },
  products: [
    {
      id: "big-hoss",
      name: "The Big Hoss",
      eyebrow: "Signature potato",
      price: "$18.99",
      description: "Smoked brisket, smoked queso, bacon, butter, sour cream, green onions, jalapeños, BBQ drizzle.",
      accent: "red",
      isNew: false,
      available: true,
      visible: true,
    },
    {
      id: "pulled-pork-papa",
      name: "Pulled Pork Papa",
      eyebrow: "Slow-cooked favorite",
      price: "$15.99",
      description: "Pulled pork, cheddar, butter, sour cream, jalapeños, crispy onions, BBQ sauce.",
      accent: "blue",
      isNew: false,
      available: true,
      visible: true,
    },
    {
      id: "taco-tater",
      name: "Taco Tater",
      eyebrow: "Tex-Mex favorite",
      price: "$14.99",
      description: "Seasoned taco meat, queso, cheddar, lettuce, pico, sour cream, jalapeños, tortilla strips.",
      accent: "gold",
      isNew: false,
      available: true,
      visible: true,
    },
    {
      id: "mac-daddy",
      name: "Mac Daddy",
      eyebrow: "Comfort on comfort",
      price: "$13.99",
      description: "Mac & cheese, cheddar, bacon, sour cream, green onions.",
      accent: "red",
      isNew: false,
      available: true,
      visible: true,
    },
    {
      id: "pepperoni-pizza-potato",
      name: "Pepperoni Pizza Potato",
      eyebrow: "Pizza night, reloaded",
      price: "$13.99",
      description: "Marinara, mozzarella, pepperoni, parmesan.",
      accent: "blue",
      isNew: false,
      available: true,
      visible: true,
    },
    {
      id: "broccoli-cheddar",
      name: "Broccoli Cheddar",
      eyebrow: "A classic combination",
      price: "$12.99",
      description: "Broccoli, cheddar cheese sauce, cheddar, butter, sour cream.",
      accent: "gold",
      isNew: false,
      available: true,
      visible: true,
    },
    {
      id: "chicken-fried-steak-tater",
      name: "Chicken Fried Steak Tater",
      eyebrow: "Country comfort",
      price: "$15.99",
      description: "Chicken fried steak, country gravy, shredded cheese.",
      accent: "red",
      isNew: true,
      available: true,
      visible: true,
    },
    {
      id: "breakfast-tater",
      name: "Breakfast Tater",
      eyebrow: "Breakfast, loaded",
      price: "$14.99",
      description: "Sausage, bacon, egg, country gravy, shredded cheese.",
      accent: "blue",
      isNew: true,
      available: true,
      visible: true,
    },
  ],
  addOns: [
    { id: "extra-meat", name: "Extra meat", price: "$3.00", available: true, visible: true },
    { id: "extra-cheese", name: "Extra cheese", price: "$1.00", available: true, visible: true },
    { id: "bacon", name: "Bacon", price: "$1.50", available: true, visible: true },
    { id: "jalapenos", name: "Jalapeños", price: "$0.75", available: true, visible: true },
    { id: "sour-cream", name: "Sour cream", price: "$0.75", available: true, visible: true },
    { id: "bbq-sauce", name: "BBQ sauce", price: "$0.75", available: true, visible: true },
    { id: "ranch", name: "Ranch", price: "$0.75", available: true, visible: true },
    { id: "green-onions", name: "Green onions", price: "$0.50", available: true, visible: true },
  ],
  drinks: [
    { id: "water", name: "Water", price: "$2.00", available: true, visible: true },
    { id: "lemonade", name: "Lemonade", price: "$3.00", available: true, visible: true },
    { id: "soda", name: "Soda", price: "$3.00", available: true, visible: true },
    { id: "sweet-tea", name: "Sweet tea", price: "$3.00", available: true, visible: true },
  ],
  combo: {
    enabled: true,
    label: "Add a combo",
    description: "Add any drink + cookie",
    price: "$4.00",
  },
};

function menuStore() {
  return getStore({ name: STORE_NAME, consistency: "strong" });
}

function cleanText(value: unknown, maximumLength: number, fallback = "") {
  if (typeof value !== "string") return fallback;
  const cleaned = value
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maximumLength);
  return cleaned || fallback;
}

function cleanId(value: unknown, fallback: string) {
  const id = cleanText(value, 64)
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return id || fallback;
}

function cleanPrice(value: unknown, fallback = "$0.00") {
  const price = cleanText(value, 16, fallback);
  return /^[\$]?[0-9]{1,4}(?:\.[0-9]{1,2})?$/.test(price) ? (price.startsWith("$") ? price : `$${price}`) : fallback;
}

function booleanValue(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

function uniqueId(value: unknown, fallback: string, used: Set<string>) {
  let id = cleanId(value, fallback);
  let suffix = 2;
  while (used.has(id)) {
    id = `${cleanId(value, fallback).slice(0, 40)}-${suffix}`;
    suffix += 1;
  }
  used.add(id);
  return id;
}

function normalizeProducts(value: unknown, fallback: BoardProduct[]) {
  if (!Array.isArray(value)) return structuredClone(fallback);
  const used = new Set<string>();
  return value.slice(0, MAX_PRODUCTS).map((entry, index) => {
    const record = entry && typeof entry === "object" ? entry as Partial<BoardProduct> : {};
    const original = fallback[index] ?? fallback[0];
    const accent = record.accent === "blue" || record.accent === "gold" || record.accent === "red"
      ? record.accent
      : original.accent;
    return {
      id: uniqueId(record.id, `product-${index + 1}`, used),
      name: cleanText(record.name, 70, `Menu item ${index + 1}`),
      eyebrow: cleanText(record.eyebrow, 48, "Loaded potato"),
      price: cleanPrice(record.price, original.price),
      description: cleanText(record.description, 220),
      accent,
      isNew: booleanValue(record.isNew, false),
      available: booleanValue(record.available, true),
      visible: booleanValue(record.visible, true),
    };
  });
}

function normalizeSmallItems(value: unknown, fallback: BoardSmallItem[], prefix: string) {
  if (!Array.isArray(value)) return structuredClone(fallback);
  const used = new Set<string>();
  return value.slice(0, MAX_SMALL_ITEMS).map((entry, index) => {
    const record = entry && typeof entry === "object" ? entry as Partial<BoardSmallItem> : {};
    const original = fallback[index] ?? fallback[0];
    return {
      id: uniqueId(record.id, `${prefix}-${index + 1}`, used),
      name: cleanText(record.name, 60, `Item ${index + 1}`),
      price: cleanPrice(record.price, original.price),
      available: booleanValue(record.available, true),
      visible: booleanValue(record.visible, true),
    };
  });
}

function normalizeMenuState(value: unknown): MenuBoardState {
  if (!value || typeof value !== "object") return structuredClone(defaultState);
  const record = value as Partial<MenuBoardState>;
  const board = record.board && typeof record.board === "object" ? record.board : {};
  const combo = record.combo && typeof record.combo === "object" ? record.combo : {};
  const orientation = board.orientation === "landscape" || board.orientation === "portrait" || board.orientation === "auto"
    ? board.orientation
    : defaultState.board.orientation;
  const revision = Number.isInteger(record.revision) && Number(record.revision) > 0
    ? Number(record.revision)
    : defaultState.revision;
  const updatedAt = typeof record.updatedAt === "string" && Number.isFinite(Date.parse(record.updatedAt))
    ? record.updatedAt
    : defaultState.updatedAt;
  const headline = cleanText(board.headline, 72, defaultState.board.headline);
  const subheadline = cleanText(board.subheadline, 120, defaultState.board.subheadline);

  return {
    version: 1,
    revision,
    updatedAt,
    board: {
      orientation,
      headline: headline === "Pick your potato." ? defaultState.board.headline : headline,
      subheadline: subheadline === "Texas-sized. Fully loaded. Made to satisfy."
        ? defaultState.board.subheadline
        : subheadline,
      announcement: cleanText(board.announcement, 120),
      showDescriptions: booleanValue(board.showDescriptions, true),
    },
    products: normalizeProducts(record.products, defaultState.products),
    addOns: normalizeSmallItems(record.addOns, defaultState.addOns, "add-on"),
    drinks: normalizeSmallItems(record.drinks, defaultState.drinks, "drink"),
    combo: {
      enabled: booleanValue(combo.enabled, true),
      label: cleanText(combo.label, 48, defaultState.combo.label),
      description: cleanText(combo.description, 90, defaultState.combo.description),
      price: cleanPrice(combo.price, defaultState.combo.price),
    },
  };
}

export function getDefaultMenuState() {
  return structuredClone(defaultState);
}

export async function readMenuState() {
  const value = await menuStore().get(STORE_KEY, { type: "json", consistency: "strong" });
  return normalizeMenuState(value);
}

export async function saveMenuState(input: unknown, expectedRevision: unknown) {
  const current = await readMenuState();
  if (Number(expectedRevision) !== current.revision) {
    throw new Error("MENU_CHANGED");
  }

  const normalized = normalizeMenuState(input);
  const saved: MenuBoardState = {
    ...normalized,
    revision: current.revision + 1,
    updatedAt: new Date().toISOString(),
  };
  await menuStore().setJSON(STORE_KEY, saved);
  return saved;
}
