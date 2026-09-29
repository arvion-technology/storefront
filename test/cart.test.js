import test from "node:test";
import assert from "node:assert/strict";

import { CATALOG, variantKey } from "../src/catalog.js";
import { createInventory } from "../src/inventory.js";
import {
  MAX_LINE_QTY,
  addLine,
  allocateDiscount,
  cartCount,
  changeLineQty,
  emptyCart,
  findLine,
  priceCart,
  removeLine,
  setLineQty,
  stockIssues,
  toOrderItems,
} from "../src/cart.js";

function cartWith(items) {
  const cart = emptyCart();
  for (const item of items) addLine(cart, item.productId, item.variantId, item.qty, item.available ?? 50);
  return cart;
}

test("quantity rules cap a line at ten and at available stock", () => {
  const cart = emptyCart();
  assert.equal(addLine(cart, "ceramic-mug", "rust", 3, 14).qty, 3);
  const big = addLine(cart, "ceramic-mug", "rust", 9, 14);
  assert.equal(big.qty, MAX_LINE_QTY);
  assert.equal(big.limited, true);
  assert.equal(addLine(cart, "ceramic-mug", "rust", 1, 14).reason, "limit");
  assert.equal(cartCount(cart), 10);

  const low = emptyCart();
  addLine(low, "home-jug", "1.2l", 1, 2);
  assert.equal(low.lines[0].qty, 1);
  assert.equal(addLine(low, "home-jug", "1.2l", 1, 2).qty, 2);
  assert.equal(addLine(low, "home-jug", "1.2l", 1, 2).ok, false);
});

test("setting, stepping and removing a line", () => {
  const cart = cartWith([{ productId: "ceramic-mug", variantId: "rust", qty: 2, available: 5 }]);
  assert.equal(setLineQty(cart, "ceramic-mug", "rust", 8, 5).qty, 5);
  assert.equal(changeLineQty(cart, "ceramic-mug", "rust", -1, 5).qty, 4);
  assert.equal(removeLine(cart, "ceramic-mug", "rust"), true);
  assert.equal(findLine(cart, "ceramic-mug", "rust"), null);
  assert.equal(cartCount(cart), 0);
});

test("pricing applies sale prices and the flat delivery fee", () => {
  const cart = cartWith([{ productId: "ceramic-mug", variantId: "rust", qty: 2 }]);
  const priced = priceCart(cart, CATALOG);

  assert.equal(priced.subtotal, 250000);
  assert.equal(priced.saleDiscount, 30000);
  assert.equal(priced.shipping, 0, "two mugs cross the free-delivery threshold");
  assert.equal(priced.total, 250000);
  assert.equal(priced.freeShippingRemaining, 0);
  assert.equal(priced.lines[0].total, 250000);
});

test("delivery is charged below the threshold and waived at it", () => {
  const under = priceCart(cartWith([{ productId: "tea-ilam", variantId: "100g", qty: 1 }]), CATALOG);
  assert.equal(under.subtotal, 85000);
  assert.equal(under.shipping, 15000);
  assert.equal(under.total, 100000);
  assert.equal(under.freeShippingRemaining, 165000);

  const at = priceCart(
    cartWith([{ productId: "tea-ilam", variantId: "100g", qty: 2 }]),
    CATALOG,
    { freeShippingThreshold: 170000 }
  );
  assert.equal(at.shipping, 0);
  assert.equal(at.shippingFree, true);
});

test("percent promos are allocated to individual lines and sum exactly", () => {
  const cart = cartWith([
    { productId: "ceramic-mug", variantId: "rust", qty: 1 },
    { productId: "ceramic-mug", variantId: "ash", qty: 1 },
  ]);
  const priced = priceCart(cart, CATALOG, { promoCode: "NEW10" });

  assert.equal(priced.promo.code, "NEW10");
  assert.equal(priced.promoDiscount, 25000);
  assert.equal(priced.discount, 55000);
  assert.equal(priced.total, 225000);
  assert.equal(priced.lines[0].promoDiscount, 12500);
  assert.equal(priced.lines.reduce((sum, line) => sum + line.promoDiscount, 0), 25000);
  assert.equal(priced.lines.reduce((sum, line) => sum + line.total, 0), 225000);
});

test("fixed promos are capped by the order value", () => {
  const priced = priceCart(cartWith([{ productId: "pantry-pepper", variantId: "50g", qty: 4 }]), CATALOG, {
    promoCode: "TEA200",
    freeShippingThreshold: 1_000_000,
  });
  assert.equal(priced.promo.code, "TEA200");
  assert.equal(priced.promoDiscount, 20000);
  assert.equal(priced.total, priced.subtotal - 20000 + priced.shipping);
});

test("shipping promos set delivery to zero", () => {
  const cart = cartWith([{ productId: "tea-ilam", variantId: "100g", qty: 2 }]);
  const priced = priceCart(cart, CATALOG, { promoCode: "FREESHIP" });
  assert.equal(priced.promo.freeShipping, true);
  assert.equal(priced.shipping, 0);
});

test("a promo that no longer qualifies is reported, not applied", () => {
  const cart = cartWith([{ productId: "tea-ilam", variantId: "100g", qty: 1 }]);
  const priced = priceCart(cart, CATALOG, { promoCode: "NEW10" });
  assert.equal(priced.promo, null);
  assert.equal(priced.promoDiscount, 0);
  assert.match(priced.promoError, /Add Rs/);
});

test("discount allocation hands out every paisa", () => {
  assert.deepEqual(allocateDiscount(100, [333, 333, 334]), [33, 33, 34]);
  assert.equal(allocateDiscount(101, [1, 1, 1]).reduce((sum, value) => sum + value, 0), 101);
  assert.deepEqual(allocateDiscount(0, [10, 20]), [0, 0]);
  assert.deepEqual(allocateDiscount(50, [0, 0]), [0, 0]);
});

test("cart snapshots the fields an order needs", () => {
  const priced = priceCart(cartWith([{ productId: "ceramic-mug", variantId: "ash", qty: 1 }]), CATALOG);
  const items = toOrderItems(priced);
  assert.equal(items.length, 1);
  assert.deepEqual(items[0], {
    key: variantKey("ceramic-mug", "ash"),
    productId: "ceramic-mug",
    variantId: "ash",
    name: "Bhaktapur Ceramic Mug",
    variantLabel: "Ash",
    unitPrice: 125000,
    qty: 1,
    lineTotal: 125000,
  });
});

test("stock issues are found against live inventory", () => {
  const cart = cartWith([{ productId: "ceramic-mug", variantId: "rust", qty: 3 }]);
  const inventory = createInventory(CATALOG);
  inventory[variantKey("ceramic-mug", "rust")] = { onHand: 2, reserved: 1 };
  const issues = stockIssues(cart, inventory);
  assert.equal(issues.length, 1);
  assert.equal(issues[0].available, 1);
  assert.equal(issues[0].requested, 3);
});
