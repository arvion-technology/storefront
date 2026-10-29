/**
 * Money is kept in paisa (1 rupee = 100 paisa) as integers. Rupee floats turn
 * "10% off" into rounding arguments; integer arithmetic keeps the cart, the
 * order and the revenue chart agreeing with each other.
 */

export const RUPEE = 100;
export const FREE_SHIPPING_THRESHOLD = 250_000; // Rs 2,500
export const FLAT_SHIPPING = 15_000; // Rs 150

export function rupees(amount) {
  return Math.round(Number(amount) * RUPEE);
}

export function percentOf(amount, percent) {
  return Math.round((Number(amount) * Number(percent)) / 100);
}

/** "Rs 1,250", decimals only when the amount is not a whole rupee. */
export function formatNPR(paisa, options = {}) {
  const value = Number(paisa || 0);
  const whole = value % RUPEE === 0;
  const amount = whole ? value / RUPEE : value / RUPEE;
  const digits = whole && options.decimals !== true ? 0 : 2;
  return `Rs ${new Intl.NumberFormat("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(amount)}`;
}

/** A discount reads as money removed from the total. */
export function formatDiscount(paisa) {
  const value = Math.abs(Number(paisa || 0));
  return value === 0 ? formatNPR(0) : `−${formatNPR(value)}`;
}
