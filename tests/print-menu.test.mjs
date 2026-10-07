import assert from "node:assert/strict";
import { test } from "node:test";
import { printableMenu } from "../public/command/print-menu-model.js";

const example = () => ({
  board: { headline: "Texas Loaded Potatoes", announcement: "Come hungry!", tatersCooking: false, cookingMessage: "" },
  products: [
    { name: "The Big Hoss", price: "$18.99", description: "Brisket, queso, shredded cheese", available: true, visible: true },
    { name: "Taco Tater", price: "$14.99", available: false, visible: true },
    { name: "Hidden special", price: "$12.99", visible: false },
  ],
  lunchPricing: { enabled: true, reduction: "$2.00" },
  drinksEnabled: true,
  drinks: [{ name: "Lemonade", price: "$3.00", available: false }, { name: "Hidden drink", price: "$2.00", visible: false }],
  addOns: [{ name: "Bacon", price: "$1.50", visible: true }],
  combo: { enabled: true, label: "Combo", description: "Drink + brownie", price: "$4.00" },
});

test("printed lunch prices affect potatoes only and hidden items stay off paper", () => {
  const menu = example();
  const before = structuredClone(menu);
  const result = printableMenu(menu);
  assert.equal(result.products.length, 2);
  assert.deepEqual(result.products.map((item) => item.printPrice), ["$16.99", "$12.99"]);
  assert.equal(result.products[0].description, "Brisket, queso, shredded cheese");
  assert.equal(result.products[1].status, "Sold out");
  assert.equal(result.drinks.length, 1);
  assert.equal(result.drinks[0].price, "$3.00");
  assert.equal(result.drinks[0].available, false);
  assert.equal(result.addOns[0].price, "$1.50");
  assert.deepEqual(result.combo, menu.combo);
  assert.deepEqual(menu, before);
});

test("drinks-off, temporary potato outage, and normal service preserve their meanings", () => {
  const menu = example();
  menu.drinksEnabled = false;
  menu.board.tatersCooking = true;
  menu.board.cookingMessage = "Next batch at 1 PM";
  const paused = printableMenu(menu);
  assert.deepEqual(paused.drinks, []);
  assert.equal(paused.combo, null);
  assert.match(paused.products[0].status, /Taters cooking/);
  assert.equal(paused.products[1].status, "Sold out");
  assert.equal(paused.board.cookingMessage, "Next batch at 1 PM");
  menu.board.tatersCooking = false;
  menu.lunchPricing.enabled = false;
  const regular = printableMenu(menu);
  assert.equal(regular.products[0].status, "");
  assert.equal(regular.products[1].status, "Sold out");
  assert.deepEqual(regular.products.map((item) => item.printPrice), ["$18.99", "$14.99"]);
});

test("print data rejects missing menus and does not produce negative lunch prices", () => {
  assert.throws(() => printableMenu(null), /could not be loaded/);
  const menu = example();
  menu.lunchPricing.reduction = "$25.00";
  assert.equal(printableMenu(menu).products[0].printPrice, "$0.00");
});
