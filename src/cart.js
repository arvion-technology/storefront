/**
 * Cart rules live here: quantity caps, sale prices, line-level discount
 * allocation, promo validation and the shipping threshold. Nothing in this
 * module reads the DOM, so the same totals can be asserted in tests and shown
 * in the drawer.
 */

import { FREE_SHIPPING_THRESHOLD, FLAT_SHIPPING } from "./money.js";
import { findProduct, findVariant, variantKey } from "./catalog.js";
import { validatePromo } from "./promos.js";

export const MAX_LINE_QTY = 10;

export function emptyCart() {
  return { lines: [] };
}

export function findLine(cart, productId, variantId) {
  return cart.lines.find((line) => line.productId === productId && line.variantId === variantId) || null;
}

function capFor(available) {
  const n = Number(available);
  if (!Number.isFinite(n)) return MAX_LINE_QTY;
  return Math.max(0, Math.min(MAX_LINE_QTY, Math.floor(n)));
}

/**
 * Add units to a line, clamped by the per-line rule (10) and live availability.
 * Returns `limited` when the request was bigger than the cap so the UI can say
 * why the quantity did not move.
 */
export function addLine(cart, productId, variantId, qty = 1, available = MAX_LINE_QTY) {
  const cap = capFor(available);
  if (cap <= 0) return { ok: false, reason: "out-of-stock", qty: 0 };
  const line = findLine(cart, productId, variantId);
  const current = line ? line.qty : 0;
  const wanted = current + Math.max(0, Math.floor(Number(qty) || 0));
  if (current >= cap) return { ok: false, reason: "limit", qty: current, limited: true };
  const next = Math.min(wanted, cap);
  if (next <= current) return { ok: false, reason: "limit", qty: current, limited: true };
  if (line) line.qty = next;
  else cart.lines.push({ productId, variantId, qty: next });
  return { ok: true, qty: next, added: next - current, limited: wanted > next };
}

/** Directly set a line (quantity stepper). Zero removes it. */
export function setLineQty(cart, productId, variantId, qty, available = MAX_LINE_QTY) {
  const line = findLine(cart, productId, variantId);
  if (!line) return { ok: false, reason: "missing" };
  const requested = Math.floor(Number(qty) || 0);
  if (requested <= 0) {
    removeLine(cart, productId, variantId);
    return { ok: true, qty: 0, removed: true };
  }
  const cap = capFor(available);
  const next = Math.min(requested, cap);
  if (next <= 0) return { ok: false, reason: "out-of-stock", qty: 0 };
  line.qty = next;
  return { ok: true, qty: next, limited: requested > next };
}

export function changeLineQty(cart, productId, variantId, delta, available = MAX_LINE_QTY) {
  const line = findLine(cart, productId, variantId);
  if (!line) return { ok: false };
  return setLineQty(cart, productId, variantId, line.qty + delta, available);
}

export function removeLine(cart, productId, variantId) {
  const before = cart.lines.length;
  cart.lines = cart.lines.filter((line) => !(line.productId === productId && line.variantId === variantId));
  return cart.lines.length !== before;
}

export function clearCart(cart) {
  cart.lines = [];
}

export function cartCount(cart) {
  return cart.lines.reduce((sum, line) => sum + line.qty, 0);
}

/**
 * Split an integer discount across lines proportionally, with the paisa
 * remainders handed to the largest fractional parts. The shares always sum to
 * the discount exactly, which is what makes the receipt add up.
 */
export function allocateDiscount(total, weights) {
  const amount = Math.max(0, Math.floor(Number(total) || 0));
  const shares = weights.map(() => 0);
  const weightSum = weights.reduce((sum, weight) => sum + Math.max(0, weight), 0);
  if (!amount || !weightSum) return shares;

  const raw = weights.map((weight) => (amount * Math.max(0, weight)) / weightSum);
  const floors = raw.map((value) => Math.floor(value));
  let remainder = amount - floors.reduce((sum, value) => sum + value, 0);
  const order = raw
    .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort((a, b) => b.fraction - a.fraction || a.index - b.index);

  let cursor = 0;
  while (remainder > 0 && order.length) {
    floors[order[cursor % order.length].index] += 1;
    cursor += 1;
    remainder -= 1;
  }
  floors.forEach((value, index) => {
    shares[index] = value;
  });
  return shares;
}

/**
 * Price the cart. `promoCode` is re-validated against the current subtotal, so
 * removing an item can drop a promo without leaving a phantom discount.
 */
export function priceCart(cart, catalog, options = {}) {
  const threshold = options.freeShippingThreshold ?? FREE_SHIPPING_THRESHOLD;
  const flatShipping = options.flatShipping ?? FLAT_SHIPPING;
  const lines = [];

  for (const raw of cart.lines) {
    const product = findProduct(catalog, raw.productId);
    const variant = findVariant(product, raw.variantId);
    if (!product || !variant) continue;
    const qty = Math.max(1, Math.min(Math.floor(Number(raw.qty) || 1), MAX_LINE_QTY));
    const unitPrice = variant.price;
    const compareAt = variant.compareAt && variant.compareAt > unitPrice ? variant.compareAt : unitPrice;
    lines.push({
      key: variantKey(product.id, variant.id),
      productId: product.id,
      variantId: variant.id,
      product,
      variant,
      qty,
      unitPrice,
      compareAt,
      subtotal: unitPrice * qty,
      saleDiscount: (compareAt - unitPrice) * qty,
    });
  }

  const subtotal = lines.reduce((sum, line) => sum + line.subtotal, 0);
  const saleDiscount = lines.reduce((sum, line) => sum + line.saleDiscount, 0);
  const promoCheck = options.promoCode ? validatePromo(options.promoCode, subtotal, options.promos) : null;
  const promo = promoCheck && promoCheck.ok ? promoCheck : null;
  const promoDiscount = promo ? Math.min(promo.discount, subtotal) : 0;

  const shares = allocateDiscount(
    promoDiscount,
    lines.map((line) => line.subtotal)
  );
  lines.forEach((line, index) => {
    line.promoDiscount = shares[index];
    line.discount = line.saleDiscount + shares[index];
    line.total = line.subtotal - shares[index];
  });

  const freeByPromo = Boolean(promo && promo.freeShipping);
  const shippingFree = subtotal > 0 && (freeByPromo || subtotal >= threshold);
  const shipping = subtotal > 0 && !shippingFree ? flatShipping : 0;
  const total = subtotal - promoDiscount + shipping;

  return {
    lines,
    subtotal,
    saleDiscount,
    promoDiscount,
    discount: saleDiscount + promoDiscount,
    shipping,
    shippingFree,
    freeShippingRemaining: Math.max(0, threshold - subtotal),
    total,
    itemCount: lines.reduce((sum, line) => sum + line.qty, 0),
    promo: promo
      ? {
          code: promo.promo.code,
          kind: promo.promo.kind,
          description: promo.promo.description,
          discount: promoDiscount,
          freeShipping: promo.freeShipping,
        }
      : null,
    promoError: promoCheck && !promoCheck.ok ? promoCheck.reason : null,
  };
}

/** Compact snapshot for the order, with just enough to render a receipt. */
export function toOrderItems(priced) {
  return priced.lines.map((line) => ({
    key: line.key,
    productId: line.productId,
    variantId: line.variantId,
    name: line.product.name,
    variantLabel: line.variant.label,
    unitPrice: line.unitPrice,
    qty: line.qty,
    lineTotal: line.total,
  }));
}

/** Lines that no longer fit current stock, for the checkout guard. */
export function stockIssues(cart, inventory) {
  const issues = [];
  for (const line of cart.lines) {
    const key = variantKey(line.productId, line.variantId);
    const entry = inventory[key];
    const available = entry ? Math.max(0, entry.onHand - entry.reserved) : 0;
    if (available < line.qty) {
      issues.push({ key, productId: line.productId, variantId: line.variantId, requested: line.qty, available });
    }
  }
  return issues;
}
