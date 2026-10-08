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

test("existing menus gain the new meat add-ons once without disturbing staff changes", async () => {
  stored = getDefaultMenuState();
  stored.version = 3;
  stored.addOns = stored.addOns.filter(({ id }) => id !== "add-brisket" && id !== "add-pulled-pork");
  stored.addOns[0].price = "$3.25";
  stored.addOns.at(-1).visible = false;

  const migrated = await readMenuState();
  assert.equal(migrated.version, 4);
  assert.equal(migrated.addOns.find(({ id }) => id === "add-brisket").price, "$7.00");
  assert.equal(migrated.addOns.find(({ id }) => id === "add-pulled-pork").price, "$5.00");
  assert.equal(migrated.addOns.find(({ id }) => id === "extra-meat").price, "$3.25");
  assert.equal(migrated.addOns.find(({ id }) => id === "green-onions").visible, false);
});

test("staff can add and remove add-ons after migration", async () => {
  stored = getDefaultMenuState();
  stored.addOns.push({ id: "avocado", name: "Add avocado", price: "$2.00", available: true, visible: true });
  stored.addOns = stored.addOns.filter(({ id }) => id !== "extra-meat");

  const saved = await saveMenuState(stored, stored.revision);
  const reloaded = await readMenuState();
  assert.deepEqual(reloaded.addOns, saved.addOns);
  assert.equal(reloaded.addOns.some(({ id }) => id === "extra-meat"), false);
  assert.equal(reloaded.addOns.find(({ id }) => id === "avocado").price, "$2.00");
});
