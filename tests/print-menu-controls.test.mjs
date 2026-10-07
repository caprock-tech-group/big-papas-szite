import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import { printableMenu } from "../public/command/print-menu-model.js";

const source = (await readFile(new URL("../public/command/print-menu.js", import.meta.url), "utf8"))
  .replace(/^import .*;\n/, "");

async function page({ userAgent = "iPhone", platform = "iPhone", standalone = false, printError = false } = {}) {
  const nodes = new Map();
  const element = () => ({
    disabled: false, hidden: false, open: false, textContent: "", clientWidth: 390,
    clientHeight: 979, scrollHeight: 979, dataset: {}, listeners: {},
    classList: { add() {}, remove() {}, toggle() {} }, style: { setProperty() {} },
    append() {}, replaceChildren() {}, querySelectorAll: () => [],
    addEventListener(type, handler) { this.listeners[type] = handler; },
  });
  const qs = (selector) => { if (!nodes.has(selector)) nodes.set(selector, element()); return nodes.get(selector); };
  const calls = [];
  let inTap = false;
  vm.runInNewContext(source, {
    printableMenu, Intl, Date, URLSearchParams, AbortController, setTimeout, clearTimeout,
    navigator: { userAgent, platform, maxTouchPoints: userAgent === "Desktop" ? 0 : 5, standalone },
    window: { matchMedia: () => ({ matches: standalone }), addEventListener() {}, print() {
      calls.push({ inTap });
      if (printError) throw new Error("Printing unsupported");
    } },
    document: { querySelector: qs, createElement: element, documentElement: element(), body: element(), fonts: { ready: Promise.resolve() } },
    location: { search: "?autoprint=1" }, requestAnimationFrame: (callback) => callback(),
    fetch: async () => ({ ok: true, json: async () => ({ board: {}, products: [] }) }),
  });
  await new Promise(setImmediate);
  return { qs, calls, tap() { inTap = true; qs("[data-print]").listeners.click(); inTap = false; } };
}

test("iPhone and iPad wait for a direct tap instead of printing after async loading", async () => {
  for (const device of [{}, { userAgent: "Macintosh", platform: "MacIntel" }]) {
    const p = await page(device);
    assert.equal(p.qs("[data-print]").disabled, false);
    assert.equal(p.qs("[data-print-help]").open, true);
    assert.equal(p.calls.length, 0);
    p.tap();
    assert.deepEqual(p.calls, [{ inTap: true }]);
    assert.match(p.qs("[data-status]").textContent, /If no print dialog/);
  }
});

test("Home Screen mode skips automatic printing; regular desktop keeps it", async () => {
  assert.equal((await page({ userAgent: "Desktop", platform: "Win32", standalone: true })).calls.length, 0);
  assert.equal((await page({ userAgent: "Desktop", platform: "Win32" })).calls.length, 1);
});

test("unsupported printing leaves visible native-print instructions", async () => {
  const p = await page({ printError: true });
  p.tap();
  assert.equal(p.qs("[data-print-help]").open, true);
  assert.match(p.qs("[data-status]").textContent, /Safari’s Share → Print/);
});
