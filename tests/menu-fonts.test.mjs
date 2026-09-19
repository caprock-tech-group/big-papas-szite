import assert from "node:assert/strict";
import { mock, test } from "node:test";

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

test("font settings survive saving and reloading without changing menu content", async () => {
  stored = getDefaultMenuState();
  const edited = structuredClone(stored);
  edited.board.fontSizes = { names: 150, prices: 175, descriptions: 125, sides: 140, announcement: 120 };
  edited.products[0].description += ", shredded cheese";
  edited.lunchPricing = { enabled: true, reduction: "$2.00" };
  edited.drinksEnabled = false;
  const saved = await saveMenuState(edited, stored.revision);
  const reloaded = await readMenuState();
  assert.deepEqual(reloaded, saved);
  assert.deepEqual(reloaded.board.fontSizes, edited.board.fontSizes);
  assert.deepEqual(reloaded.products, edited.products);
  assert.deepEqual(reloaded.lunchPricing, edited.lunchPricing);
  assert.deepEqual(reloaded.drinks, edited.drinks);
  assert.equal(reloaded.drinksEnabled, false);
  await assert.rejects(saveMenuState(edited, 1), /MENU_CHANGED/);
});

test("older menus keep original font sizes and invalid settings are bounded", async () => {
  stored = getDefaultMenuState();
  delete stored.board.fontSizes;
  const original = getDefaultMenuState().board.fontSizes;
  assert.deepEqual((await readMenuState()).board.fontSizes, original);
  stored.board.fontSizes = { names: 900, prices: -1, descriptions: null, sides: "bad", announcement: 150.6 };
  assert.deepEqual((await readMenuState()).board.fontSizes, {
    names: 200, prices: 80, descriptions: 100, sides: 100, announcement: 151,
  });
});
