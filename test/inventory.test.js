import test from "node:test";
import assert from "node:assert/strict";

import { CATALOG, variantKey } from "../src/catalog.js";
import {
  adjust,
  availableStock,
  commitReservation,
  createInventory,
  inventoryRows,
  inventoryTotals,
  itemTotals,
  lowStock,
  reconcile,
  release,
  reserve,
  restock,
  stockOf,
} from "../src/inventory.js";

const tea = variantKey("tea-ilam", "100g");
const mug = variantKey("ceramic-mug", "rust");

test("a fresh inventory starts at the catalogue stock", () => {
  const inventory = createInventory(CATALOG);
  assert.deepEqual(stockOf(inventory, tea), { onHand: 26, reserved: 0, available: 26 });
  assert.equal(availableStock(inventory, "missing"), 0);
  assert.equal(inventoryTotals(inventory, CATALOG).variants, inventoryRows(inventory, CATALOG).length);
});

test("two checkouts for the last unit resolve to one winner", () => {
  const inventory = createInventory(CATALOG);
  inventory[tea] = { onHand: 1, reserved: 0 };

  const first = reserve(inventory, [{ key: tea, qty: 1 }]);
  const second = reserve(inventory, [{ key: tea, qty: 1 }]);

  assert.equal(first.ok, true);
  assert.equal(second.ok, false);
  assert.equal(second.reason, "stock");
  assert.equal(second.available, 0);
  assert.deepEqual(stockOf(inventory, tea), { onHand: 1, reserved: 1, available: 0 });
});

test("a multi-line reserve is atomic", () => {
  const inventory = createInventory(CATALOG);
  inventory[tea] = { onHand: 5, reserved: 0 };
  inventory[mug] = { onHand: 0, reserved: 0 };

  const result = reserve(inventory, [
    { key: tea, qty: 2 },
    { key: mug, qty: 1 },
  ]);

  assert.equal(result.ok, false);
  assert.equal(result.key, mug);
  assert.equal(stockOf(inventory, tea).reserved, 0, "nothing is held when one line fails");
});

test("release, commit and restock move stock in the right direction", () => {
  const inventory = createInventory(CATALOG);
  inventory[tea] = { onHand: 5, reserved: 0 };

  reserve(inventory, [{ key: tea, qty: 3 }]);
  assert.equal(stockOf(inventory, tea).available, 2);

  release(inventory, [{ key: tea, qty: 2 }]);
  assert.deepEqual(stockOf(inventory, tea), { onHand: 5, reserved: 1, available: 4 });

  commitReservation(inventory, [{ key: tea, qty: 1 }]);
  assert.deepEqual(stockOf(inventory, tea), { onHand: 4, reserved: 0, available: 4 });

  restock(inventory, [{ key: tea, qty: 2 }]);
  assert.deepEqual(stockOf(inventory, tea), { onHand: 6, reserved: 0, available: 6 });
});

test("manual adjustments respect reserved units", () => {
  const inventory = createInventory(CATALOG);
  inventory[tea] = { onHand: 3, reserved: 2 };

  const tooFar = adjust(inventory, tea, -2);
  assert.equal(tooFar.ok, false);
  assert.equal(tooFar.reason, "reserved");
  assert.equal(tooFar.maxDecrease, 1);

  assert.equal(adjust(inventory, tea, -1).ok, true);
  assert.equal(stockOf(inventory, tea).onHand, 2);
  assert.equal(adjust(inventory, tea, -1).ok, false);
  assert.equal(adjust(inventory, "new-key", 4).ok, true);
  assert.equal(availableStock(inventory, "new-key"), 4);
  assert.equal(adjust(inventory, "new-key", 0).ok, false);
});

test("low-stock rows are sorted by available units", () => {
  const inventory = createInventory(CATALOG);
  inventory[tea] = { onHand: 2, reserved: 0 };
  inventory[mug] = { onHand: 6, reserved: 1 };
  inventory[variantKey("home-jug", "1.2l")] = { onHand: 0, reserved: 0 };

  const rows = lowStock(inventory, CATALOG, 4);
  const keys = rows.map((row) => row.key);
  assert.ok(keys.includes("home-jug:1.2l"));
  assert.ok(keys.includes(tea));
  assert.ok(!keys.includes(mug), "available 5 is above the threshold");
  assert.equal(rows[0].available, 0);
  assert.ok(rows.every((row) => row.available <= 4));
});

test("reconcile adds variants that are missing without resetting others", () => {
  const inventory = createInventory(CATALOG);
  delete inventory[tea];
  inventory[mug] = { onHand: 1, reserved: 0 };
  reconcile(inventory, CATALOG);
  assert.equal(stockOf(inventory, tea).onHand, 26);
  assert.equal(stockOf(inventory, mug).onHand, 1);
});

test("item totals ignore empty quantities", () => {
  assert.equal(
    itemTotals([
      { key: tea, qty: 2 },
      { key: mug, qty: 0 },
      { key: mug, qty: 1 },
    ]),
    3
  );
});
