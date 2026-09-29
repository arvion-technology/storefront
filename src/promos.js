/**
 * Promo rules are data, not if-statements in the checkout. Each code has a
 * kind (percent / fixed / shipping), a minimum subtotal and an active flag.
 * Validation returns a reason a cashier could read out loud.
 */

import { formatNPR } from "./money.js";

export const PROMOS = [
  {
    code: "NEW10",
    kind: "percent",
    value: 10,
    minSubtotal: 100_000,
    description: "10% off orders over Rs 1,000",
    active: true,
  },
  {
    code: "TEA200",
    kind: "fixed",
    value: 20_000,
    minSubtotal: 150_000,
    description: "Rs 200 off orders over Rs 1,500",
    active: true,
  },
  {
    code: "FREESHIP",
    kind: "shipping",
    value: 0,
    minSubtotal: 100_000,
    description: "Free delivery over Rs 1,000",
    active: true,
  },
  {
    code: "FESTIVE15",
    kind: "percent",
    value: 15,
    maxDiscount: 50_000,
    minSubtotal: 200_000,
    description: "15% off orders over Rs 2,000, up to Rs 500",
    active: true,
  },
  {
    code: "WINTER20",
    kind: "percent",
    value: 20,
    minSubtotal: 0,
    description: "Winter offer",
    active: false,
  },
];

export function findPromo(code, promos = PROMOS) {
  const needle = String(code || "").trim().toUpperCase();
  if (!needle) return null;
  return promos.find((promo) => promo.code === needle) || null;
}

/** Discount in paisa for a valid promo. Shipping promos have no cash value. */
export function computePromoDiscount(promo, subtotal) {
  if (!promo || promo.kind === "shipping") return 0;
  if (promo.kind === "percent") {
    // Round to the nearest rupee: Nepali shop prices are whole rupees, and a
    // receipt with 50 paisa on it reads like a bug to the person paying.
    const raw = Math.round((subtotal * promo.value) / 100 / 100) * 100;
    return Math.min(raw, promo.maxDiscount ?? Number.MAX_SAFE_INTEGER, subtotal);
  }
  if (promo.kind === "fixed") {
    return Math.min(promo.value, subtotal);
  }
  return 0;
}

export function validatePromo(code, subtotal, promos = PROMOS) {
  const clean = String(code || "").trim();
  if (!clean) return { ok: false, reason: "Enter a promo code." };

  const promo = findPromo(clean, promos);
  if (!promo) return { ok: false, reason: `“${clean.toUpperCase()}” is not a valid code.` };
  if (promo.active === false) return { ok: false, reason: `${promo.code} has ended.` };

  if (subtotal < promo.minSubtotal) {
    const shortfall = promo.minSubtotal - subtotal;
    return {
      ok: false,
      reason: `Add ${formatNPR(shortfall, { decimals: true })} more to use ${promo.code}.`,
    };
  }

  return {
    ok: true,
    promo,
    discount: computePromoDiscount(promo, subtotal),
    freeShipping: promo.kind === "shipping",
  };
}
