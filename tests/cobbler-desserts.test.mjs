import assert from "node:assert/strict";
import { mock, test } from "node:test";
import { readFileSync } from "node:fs";
import { printableMenu } from "../public/command/print-menu-model.js";

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

test("v6 saved menu gains all three $3 desserts and $5 cobbler combo without changing Frito Bandito", async () => {
  stored = getDefaultMenuState();
  stored.version = 6;
  delete stored.desserts;
  delete stored.cobblerCombo;
  stored.products.find(({ id }) => id === "frito-bandito").price = "$14.99";
  stored.products.find(({ id }) => id === "frito-bandito").visible = true;
  stored.combo.description = "Custom cookie combo";
  stored.addOns[0].price = "$4.25";
  const migrated = await readMenuState();
  assert.equal(migrated.version, 7);
  assert.deepEqual(migrated.desserts.map((item) => [item.name, item.price]), [
    ["Cherry Cobbler", "$3.00"], ["Peach Cobbler", "$3.00"], ["Apple Cobbler", "$3.00"],
  ]);
  assert.equal(migrated.cobblerCombo.price, "$5.00");
  assert.equal(migrated.combo.description, "Custom cookie combo");
  assert.equal(migrated.products.find(({ id }) => id === "frito-bandito").price, "$14.99");
  assert.equal(migrated.addOns[0].price, "$4.25");

  const saved = await saveMenuState(migrated, migrated.revision);
  const modified = structuredClone(saved);
  modified.desserts = modified.desserts.filter((item) => item.id !== "apple-cobbler");
  modified.desserts[0].price = "$3.50";
  const changed = await saveMenuState(modified, saved.revision);
  assert.equal(changed.version, 7);
  const reloaded = await readMenuState();
  assert.equal(reloaded.desserts.some(({ id }) => id === "apple-cobbler"), false);
  assert.equal(reloaded.desserts.find(({ id }) => id === "cherry-cobbler").price, "$3.50");
});

test("print model keeps standalone cobblers when drinks are disabled and hides drink combos", () => {
  const menu = getDefaultMenuState();
  let model = printableMenu(menu);
  assert.equal(model.desserts.length, 3);
  assert.equal(model.combo.price, "$4.00");
  assert.equal(model.cobblerCombo.price, "$5.00");
  menu.drinksEnabled = false;
  model = printableMenu(menu);
  assert.equal(model.drinks.length, 0);
  assert.equal(model.combo, null);
  assert.equal(model.cobblerCombo, null);
  assert.equal(model.desserts.length, 3);
});

test("cobbler combo is hidden when every dessert is sold out or invisible", () => {
  const menu = getDefaultMenuState();
  menu.desserts.forEach((item) => { item.available = false; });
  assert.equal(printableMenu(menu).cobblerCombo, null);
  menu.desserts[0].available = true;
  assert.equal(printableMenu(menu).cobblerCombo.price, "$5.00");
  menu.desserts[0].visible = false;
  assert.equal(printableMenu(menu).cobblerCombo, null);
});

test("menu board and print templates include independently controlled dessert sections", () => {
  const board = readFileSync(new URL("../public/menu-board/index.html", import.meta.url), "utf8");
  const print = readFileSync(new URL("../public/command/print-menu.html", import.meta.url), "utf8");
  const printStyles = readFileSync(new URL("../public/command/print-menu.css", import.meta.url), "utf8");
  const printScript = readFileSync(new URL("../public/command/print-menu.js", import.meta.url), "utf8");
  const command = readFileSync(new URL("../public/command/command.js", import.meta.url), "utf8");
  assert.match(board, /data-desserts/);
  assert.match(board, /data-cobbler-combo/);
  assert.match(command, /smallMenuSection\("Desserts"/);
  assert.match(print, /data-desserts-section/);
  assert.match(print, /data-cobbler-combo/);
  assert.match(printStyles, /grid-template-columns: minmax\(0, 1\.42fr\)/);
  assert.match(printStyles, /data-density="extra-compact"/);
  assert.match(printScript, /--addons-rows/);
  assert.match(printScript, /"extra-compact"/);
});
