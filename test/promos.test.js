import test from "node:test";
import assert from "node:assert/strict";

import { computePromoDiscount, findPromo, PROMOS, validatePromo } from "../src/promos.js";

test("percent promos discount the subtotal", () => {
  const result = validatePromo("NEW10", 120_000);
  assert.equal(result.ok, true);
  assert.equal(result.discount, 12_000);
  assert.equal(result.promo.code, "NEW10");
});

test("promo codes are case-insensitive and trimmed", () => {
  const result = validatePromo("  new10  ", 120_000);
  assert.equal(result.ok, true);
  assert.equal(result.discount, 12_000);
});

test("minimum spend produces a readable shortfall", () => {
  const result = validatePromo("NEW10", 60_000);
  assert.equal(result.ok, false);
  assert.match(result.reason, /Add Rs 400\.00 more/);
});

test("unknown, empty and inactive codes are rejected", () => {
  assert.equal(validatePromo("", 100_000).ok, false);
  assert.match(validatePromo("", 100_000).reason, /Enter a promo code/);
  assert.match(validatePromo("NOPE", 100_000).reason, /not a valid code/);
  assert.match(validatePromo("WINTER20", 999_999).reason, /ended/);
});

test("fixed promos never exceed the subtotal", () => {
  assert.equal(computePromoDiscount(findPromo("TEA200"), 160_000), 20_000);
  assert.equal(computePromoDiscount(findPromo("TEA200"), 5_000), 5_000);
});

test("percent promos respect a discount cap", () => {
  const festive = findPromo("FESTIVE15");
  assert.equal(computePromoDiscount(festive, 200_000), 30_000);
  assert.equal(computePromoDiscount(festive, 400_000), 50_000);
  assert.equal(computePromoDiscount(festive, 100_000), 15_000);
});

test("shipping promos carry no cash discount but free delivery", () => {
  const result = validatePromo("FREESHIP", 120_000);
  assert.equal(result.ok, true);
  assert.equal(result.discount, 0);
  assert.equal(result.freeShipping, true);
  assert.equal(validatePromo("FREESHIP", 60_000).ok, false);
});

test("the promo list is data and stays inspectable", () => {
  assert.ok(PROMOS.length >= 4);
  assert.ok(PROMOS.every((promo) => promo.code === promo.code.toUpperCase()));
});
