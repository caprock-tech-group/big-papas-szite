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

test("between-batch notice survives reload and resumes without clearing individual sellouts", async () => {
  stored = getDefaultMenuState();
  stored.products[1].available = false;
  stored.products[0].description += ", shredded cheese";
  stored.board.announcement = "Follow us on Facebook";
  stored.board.fontSizes.names = 150;
  stored.lunchPricing = { enabled: true, reduction: "$2.00" };
  stored.drinksEnabled = false;
  const before = structuredClone(stored);
  const draft = structuredClone(stored);
  draft.board.tatersCooking = true;
  draft.board.cookingMessage = "Next batch around 12:45 PM";
  const paused = await saveMenuState(draft, before.revision);
  assert.deepEqual(await readMenuState(), paused);
  assert.equal(paused.board.tatersCooking, true);
  assert.equal(paused.board.cookingMessage, draft.board.cookingMessage);
  const resumed = await saveMenuState({ ...paused, board: { ...paused.board, tatersCooking: false, cookingMessage: "" } }, paused.revision);
  assert.equal((await readMenuState()).board.tatersCooking, false);
  for (const key of ["products", "drinks", "drinksEnabled", "addOns", "combo", "lunchPricing"]) {
    assert.deepEqual(paused[key], before[key]);
    assert.deepEqual(resumed[key], before[key]);
  }
  assert.deepEqual(resumed.board, before.board);
  await assert.rejects(saveMenuState(draft, paused.revision), /MENU_CHANGED/);
});

test("older menus default to normal service and optional batch messages are bounded", async () => {
  stored = getDefaultMenuState();
  delete stored.board.tatersCooking;
  delete stored.board.cookingMessage;
  const older = await readMenuState();
  assert.equal(older.board.tatersCooking, false);
  assert.equal(older.board.cookingMessage, "");
  stored.board.tatersCooking = "true";
  stored.board.cookingMessage = "  Fresh\n\tbatch  ";
  const invalid = await readMenuState();
  assert.equal(invalid.board.tatersCooking, false);
  assert.equal(invalid.board.cookingMessage, "Fresh batch");
  stored.board.cookingMessage = "A".repeat(200);
  assert.equal((await readMenuState()).board.cookingMessage.length, 120);
});
