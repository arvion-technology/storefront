import test from "node:test";
import assert from "node:assert/strict";

import { CATALOG, variantKey } from "../src/catalog.js";
import { addLine, emptyCart, priceCart, toOrderItems } from "../src/cart.js";
import { availableStock, createInventory, stockOf } from "../src/inventory.js";
import {
  advanceOrder,
  allowedTransitions,
  canTransition,
  createOrder,
  nextOrderNumber,
  ORDER_TRANSITIONS,
  transitionOrder,
} from "../src/orders.js";

const CUSTOMER = {
  name: "Asha Shrestha",
  phone: "9801234567",
  email: "asha@example.com",
  address: "Jhamsikhel, Lalitpur",
  city: "Lalitpur",
  notes: "",
};

const NOW = Date.UTC(2026, 9, 28, 9, 30);

function checkout({ productId = "tea-ilam", variantId = "100g", qty = 2, payment = "esewa", orderNumber = "BST-2026-2001" } = {}) {
  const cart = emptyCart();
  addLine(cart, productId, variantId, qty, 99);
  const priced = priceCart(cart, CATALOG);
  const inventory = createInventory(CATALOG);
  const result = createOrder({
    items: toOrderItems(priced),
    customer: CUSTOMER,
    payment,
    totals: priced,
    inventory,
    now: NOW,
    orderNumber,
  });
  return { ...result, inventory, priced };
}

test("creating an order reserves stock and snapshots the totals", () => {
  const { ok, order, inventory, priced } = checkout();
  assert.equal(ok, true);
  assert.equal(order.status, "placed");
  assert.equal(order.totals.total, priced.total);
  assert.equal(order.items[0].qty, 2);
  assert.deepEqual(order.timeline.map((entry) => entry.status), ["placed"]);
  assert.equal(availableStock(inventory, variantKey("tea-ilam", "100g")), 24);
  assert.equal(order.payment.status, "paid", "wallet payments are treated as captured");
  assert.match(order.payment.reference, /^ESEWA-/);
});

test("cash on delivery starts unpaid", () => {
  const { order } = checkout({ payment: "cod" });
  assert.equal(order.payment.status, "pending");
  assert.equal(order.payment.reference, null);
});

test("an order that cannot reserve stock is not created", () => {
  const cart = emptyCart();
  addLine(cart, "home-jug", "1.2l", 2, 10);
  const priced = priceCart(cart, CATALOG);
  const inventory = createInventory(CATALOG);
  inventory[variantKey("home-jug", "1.2l")] = { onHand: 1, reserved: 0 };

  const result = createOrder({
    items: toOrderItems(priced),
    customer: CUSTOMER,
    payment: "cod",
    totals: priced,
    inventory,
    now: NOW,
    orderNumber: "BST-2026-2001",
  });

  assert.equal(result.ok, false);
  assert.equal(result.reason, "stock");
  assert.equal(stockOf(inventory, variantKey("home-jug", "1.2l")).reserved, 0);
});

test("the happy path commits stock at shipping and collects COD at delivery", () => {
  const { order, inventory } = checkout({ payment: "cod" });
  const key = variantKey("tea-ilam", "100g");

  assert.equal(transitionOrder(order, "packed", inventory, { now: NOW + 1 }).ok, true);
  assert.equal(stockOf(inventory, key).reserved, 2);

  assert.equal(transitionOrder(order, "shipped", inventory, { now: NOW + 2 }).ok, true);
  assert.deepEqual(stockOf(inventory, key), { onHand: 24, reserved: 0, available: 24 });

  assert.equal(transitionOrder(order, "delivered", inventory, { now: NOW + 3 }).ok, true);
  assert.equal(order.status, "delivered");
  assert.equal(order.payment.status, "paid");
  assert.equal(order.timeline.length, 4);
});

test("cancelling an unshipped order releases the reservation", () => {
  const { order, inventory } = checkout();
  const key = variantKey("tea-ilam", "100g");
  assert.equal(stockOf(inventory, key).reserved, 2);

  const result = transitionOrder(order, "cancelled", inventory, { now: NOW + 1 });
  assert.equal(result.ok, true);
  assert.deepEqual(stockOf(inventory, key), { onHand: 26, reserved: 0, available: 26 });
  assert.equal(order.payment.status, "refunded", "the wallet capture is marked refunded");
});

test("illegal transitions are refused with a readable reason", () => {
  const { order, inventory } = checkout();
  assert.equal(transitionOrder(order, "delivered", inventory).ok, false);
  assert.equal(order.status, "placed");
  assert.equal(transitionOrder(order, "shipped", inventory).ok, false);

  transitionOrder(order, "packed", inventory);
  transitionOrder(order, "shipped", inventory);
  assert.equal(transitionOrder(order, "cancelled", inventory).reason, "transition");
  assert.equal(transitionOrder(order, "nonsense", inventory).reason, "unknown");
});

test("a refund returns stock to the shelf", () => {
  const { order, inventory } = checkout({ payment: "khalti" });
  const key = variantKey("tea-ilam", "100g");
  transitionOrder(order, "packed", inventory);
  transitionOrder(order, "shipped", inventory);
  transitionOrder(order, "delivered", inventory);
  assert.equal(stockOf(inventory, key).onHand, 24);

  const refunded = transitionOrder(order, "refunded", inventory, { now: NOW + 10 });
  assert.equal(refunded.ok, true);
  assert.deepEqual(stockOf(inventory, key), { onHand: 26, reserved: 0, available: 26 });
  assert.equal(order.status, "refunded");
  assert.equal(order.payment.status, "refunded");
});

test("the transition table is closed at both ends", () => {
  assert.deepEqual(allowedTransitions("placed"), ["packed", "cancelled"]);
  assert.deepEqual(allowedTransitions("delivered"), ["refunded"]);
  assert.deepEqual(allowedTransitions("cancelled"), []);
  assert.equal(canTransition("shipped", "delivered"), true);
  assert.equal(canTransition("refunded", "placed"), false);
  assert.deepEqual(Object.keys(ORDER_TRANSITIONS).sort(), [
    "cancelled",
    "delivered",
    "packed",
    "placed",
    "refunded",
    "shipped",
  ]);
});

test("order numbers increment inside the current year", () => {
  assert.equal(nextOrderNumber([], NOW), "BST-2026-1001");
  assert.equal(
    nextOrderNumber([{ orderNumber: "BST-2026-1004" }, { orderNumber: "BST-2026-1012" }, { orderNumber: "BST-2025-1200" }], NOW),
    "BST-2026-1013"
  );
});

test("advanceOrder walks a path with stock effects", () => {
  const { order, inventory } = checkout();
  const result = advanceOrder(order, ["packed", "shipped"], inventory, { now: NOW });
  assert.equal(result.ok, true);
  assert.equal(order.status, "shipped");
  assert.equal(availableStock(inventory, variantKey("tea-ilam", "100g")), 24);
});
