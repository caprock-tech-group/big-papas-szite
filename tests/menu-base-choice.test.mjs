import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const page = readFileSync(new URL("../public/menu-board/index.html", import.meta.url), "utf8");
const script = readFileSync(new URL("../public/menu-board/board.js", import.meta.url), "utf8");
const styles = readFileSync(new URL("../public/menu-board/board.css", import.meta.url), "utf8");

test("TV menu makes baked potato versus loaded fries visible", () => {
  assert.match(page, /CHOOSE YOUR BASE!/);
  assert.match(page, /data-potato-option[\s\S]*BAKED POTATO/);
  assert.match(page, /data-fries-option[\s\S]*LOADED FRIES/);
  assert.match(page, /SAME TOPPINGS\. SAME PRICE\./);
  assert.match(page, /board\.css\?v=20/);
  assert.match(page, /board\.js\?v=20/);
});

test("base choices respond to stop-level fries and cooking switches", () => {
  assert.match(script, /friesOption\.hidden = !friesEnabled/);
  assert.match(script, /baseChoiceOr\.hidden = !friesEnabled/);
  assert.match(script, /potatoStatus\.hidden = !potatoCooking/);
  assert.match(script, /POTATOES COOKING\. ANY FAVORITE ON FRIES\./);
  assert.match(script, /FRIES AVAILABLE NOW!/);
});

test("base choices have legible portrait and landscape menu layouts", () => {
  assert.match(styles, /grid-template-rows: 10\.4dvh minmax\(0, 1fr\)/);
  assert.match(styles, /grid-template-rows: 9\.4dvh minmax\(0, 1fr\)/);
  assert.match(styles, /\[data-fries-enabled="false"\] \.base-choice__options/);
  assert.match(styles, /\[data-cooking-mode="fries"\] \.base-choice__option--potato/);
});
