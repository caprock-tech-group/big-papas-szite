import assert from "node:assert/strict";
import { mock, test } from "node:test";
import { readFileSync } from "node:fs";

let stored = null;
mock.module("@netlify/blobs", {
  namedExports: {
    getStore: () => ({
      get: async () => structuredClone(stored),
      setJSON: async (_key, value) => { stored = structuredClone(value); },
    }),
  },
});

const { getDefaultMenuState, readMenuState, saveMenuState } = await import("../netlify/lib/menu.mts");

test("existing v5 menu gains Frito Bandito draft and priced chili and Fritos without losing customizations", async () => {
  stored = getDefaultMenuState();
  stored.version = 5;
  stored.products = stored.products.filter(({ id }) => id !== "frito-bandito");
  stored.addOns = stored.addOns.filter(({ id }) => id !== "chili" && id !== "fritos");
  stored.products[0].price = "$19.75";
  stored.products[0].visible = false;
  stored.addOns[0].price = "$3.75";
  stored.board.fontSizes.names = 165;
  const next = await readMenuState();

  assert.equal(next.version, 7);
  assert.equal(next.products[0].price, "$19.75");
  assert.equal(next.products[0].visible, false);
  assert.equal(next.board.fontSizes.names, 165);
  assert.equal(next.addOns[0].price, "$3.75");
  const bandito = next.products.find(({ id }) => id === "frito-bandito");
  assert.equal(bandito?.name, "Frito Bandito");
  assert.equal(bandito?.description, "Chili, shredded cheddar jack cheese, diced onions, jalapeños, and crushed Fritos.");
  assert.equal(bandito?.visible, false);
  assert.equal(bandito?.price, "$0.00");
  assert.equal(next.addOns.find(({ id }) => id === "chili")?.price, "$2.00");
  assert.equal(next.addOns.find(({ id }) => id === "fritos")?.price, "$1.00");

  const saved = await saveMenuState(next, next.revision);
  assert.equal(saved.version, 7);
  assert.equal((await readMenuState()).products.filter(({ id }) => id === "frito-bandito").length, 1);
  const edited = structuredClone(saved);
  edited.addOns = edited.addOns.filter(({ id }) => id !== "fritos");
  edited.products = edited.products.filter(({ id }) => id !== "frito-bandito");
  const removed = await saveMenuState(edited, saved.revision);
  assert.equal((await readMenuState()).addOns.some(({ id }) => id === "fritos"), false);
  assert.equal((await readMenuState()).products.some(({ id }) => id === "frito-bandito"), false);
  assert.equal(removed.version, 7);
});

test("migration does not duplicate manually created potato or extras", async () => {
  stored = getDefaultMenuState();
  stored.version = 5;
  stored.products.find(({ id }) => id === "frito-bandito").price = "$16.99";
  stored.products.find(({ id }) => id === "frito-bandito").visible = true;
  stored.addOns.find(({ id }) => id === "chili").price = "$2.50";
  const next = await readMenuState();
  assert.equal(next.products.filter(({ id }) => id === "frito-bandito").length, 1);
  assert.equal(next.products.find(({ id }) => id === "frito-bandito").price, "$16.99");
  assert.equal(next.addOns.filter(({ id }) => id === "chili").length, 1);
  assert.equal(next.addOns.find(({ id }) => id === "chili").price, "$2.50");
});

test("staff can add and remove products and only publish those with prices", async () => {
  stored = getDefaultMenuState();
  const draft = structuredClone(stored);
  draft.products.push({
    id: "test-special",
    name: "Test special",
    eyebrow: "Special",
    price: "$0.00",
    description: "Test toppings",
    accent: "gold",
    isNew: true,
    available: true,
    visible: false,
  });
  const saved = await saveMenuState(draft, draft.revision);
  const shown = structuredClone(saved);
  shown.products.find(({ id }) => id === "test-special").visible = true;
  await assert.rejects(saveMenuState(shown, saved.revision), /VISIBLE_PRODUCT_NEEDS_PRICE/);
  shown.products.find(({ id }) => id === "test-special").price = "$14.99";
  const published = await saveMenuState(shown, saved.revision);
  assert.equal(published.products.find(({ id }) => id === "test-special").visible, true);
  const removed = structuredClone(published);
  removed.products = removed.products.filter(({ id }) => id !== "test-special");
  await saveMenuState(removed, published.revision);
  assert.equal((await readMenuState()).products.some(({ id }) => id === "test-special"), false);
});

test("Command Center provides add and remove potato controls", () => {
  const html = readFileSync(new URL("../public/command/index.html", import.meta.url), "utf8");
  const script = readFileSync(new URL("../public/command/command.js", import.meta.url), "utf8");
  assert.match(html, /data-add-potato/);
  assert.match(script, /function addNewPotato/);
  assert.match(script, /visible: false, \/\/ Keep drafts off customer-facing menus/);
  assert.match(script, /Remove potato/);
  assert.match(script, /Every visible potato needs a price above/);
});
