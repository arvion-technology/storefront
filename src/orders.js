/**
 * Checkout and the order state machine.
 *
 * The stock side of an order is explicit: creating an order reserves units,
 * shipping commits them, cancelling releases the reservation and refunding
 * restocks the shelf. Because those effects live next to the transition table,
 * the back office cannot move an order into a state that silently loses stock.
 */

import { availableStock, commitReservation, release, reserve, restock } from "./inventory.js";

export const ORDER_STATES = ["placed", "packed", "shipped", "delivered", "cancelled", "refunded"];

export const ORDER_TRANSITIONS = {
  placed: ["packed", "cancelled"],
  packed: ["shipped", "cancelled"],
  shipped: ["delivered", "refunded"],
  delivered: ["refunded"],
  cancelled: [],
  refunded: [],
};

export const STATUS_LABELS = {
  placed: "Placed",
  packed: "Packed",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
  refunded: "Refunded",
};

export const STATUS_TONE = {
  placed: "gold",
  packed: "blue",
  shipped: "purple",
  delivered: "green",
  cancelled: "muted",
  refunded: "red",
};

export const PAYMENT_METHODS = [
  {
    id: "cod",
    label: "Cash on delivery",
    short: "COD",
    note: "Pay the courier when the order arrives.",
  },
  {
    id: "esewa",
    label: "eSewa",
    short: "eSewa",
    note: "Mock wallet adapter. No money leaves the page.",
  },
  {
    id: "khalti",
    label: "Khalti",
    short: "Khalti",
    note: "Mock wallet adapter. No money leaves the page.",
  },
];

const DAY = 24 * 60 * 60 * 1000;

export function findPaymentMethod(id) {
  return PAYMENT_METHODS.find((method) => method.id === id) || PAYMENT_METHODS[0];
}

/** A deterministic stand-in for a wallet redirect / COD intent. */
export function mockPayment(methodId, amount, now = Date.now()) {
  const method = findPaymentMethod(methodId);
  const isCod = method.id === "cod";
  const reference = isCod ? null : `${method.short.toUpperCase()}-${(now % 100_000_000).toString(36).toUpperCase()}`;
  return {
    method: method.id,
    label: method.label,
    amount,
    status: isCod ? "pending" : "paid",
    reference,
    createdAt: now,
  };
}

export function canTransition(from, to) {
  return Array.isArray(ORDER_TRANSITIONS[from]) && ORDER_TRANSITIONS[from].includes(to);
}

export function allowedTransitions(status) {
  return [...(ORDER_TRANSITIONS[status] || [])];
}

export function isClosedStatus(status) {
  return status === "cancelled" || status === "refunded";
}

export function nextOrderNumber(orders, now = Date.now()) {
  const year = new Date(now).getUTCFullYear();
  const prefix = `BST-${year}-`;
  const highest = orders.reduce((max, order) => {
    const number = String(order.orderNumber || order.id || "");
    if (!number.startsWith(prefix)) return max;
    const sequence = Number(number.slice(prefix.length));
    return Number.isFinite(sequence) ? Math.max(max, sequence) : max;
  }, 1000);
  return `${prefix}${highest + 1}`;
}

function snapshotItems(items) {
  return (items || []).map((item) => ({
    key: item.key,
    productId: item.productId,
    variantId: item.variantId,
    name: item.name,
    variantLabel: item.variantLabel,
    unitPrice: Math.round(Number(item.unitPrice) || 0),
    qty: Math.max(1, Math.floor(Number(item.qty) || 1)),
    lineTotal: Math.round(Number(item.lineTotal) || 0),
  }));
}

/**
 * Create a placed order and reserve its stock. All-or-nothing: if any line
 * cannot be reserved, no order is created and no stock is held.
 */
export function createOrder({ items, customer, payment, totals, inventory, now = Date.now(), orderNumber } = {}) {
  const snapshot = snapshotItems(items);
  if (!snapshot.length) return { ok: false, reason: "empty", message: "The cart is empty." };

  for (const line of snapshot) {
    if (availableStock(inventory, line.key) < line.qty) {
      return {
        ok: false,
        reason: "stock",
        key: line.key,
        message: "One of the items sold out while you were checking out.",
      };
    }
  }

  const reservation = reserve(
    inventory,
    snapshot.map((line) => ({ key: line.key, qty: line.qty }))
  );
  if (!reservation.ok) {
    return {
      ok: false,
      reason: reservation.reason,
      key: reservation.key,
      message: "One of the items sold out while you were checking out.",
    };
  }

  const number = orderNumber || nextOrderNumber([], now);
  const paymentRecord = typeof payment === "string" ? mockPayment(payment, totals?.total || 0, now) : payment;
  const order = {
    id: number,
    orderNumber: number,
    status: "placed",
    createdAt: now,
    updatedAt: now,
    customer: { ...customer },
    items: snapshot,
    totals: {
      subtotal: Math.round(Number(totals?.subtotal) || 0),
      discount: Math.round(Number(totals?.discount) || 0),
      saleDiscount: Math.round(Number(totals?.saleDiscount) || 0),
      promoDiscount: Math.round(Number(totals?.promoDiscount) || 0),
      shipping: Math.round(Number(totals?.shipping) || 0),
      total: Math.round(Number(totals?.total) || 0),
      itemCount: snapshot.reduce((sum, line) => sum + line.qty, 0),
    },
    promo: totals?.promo ? { code: totals.promo.code, description: totals.promo.description } : null,
    payment: paymentRecord,
    timeline: [{ status: "placed", at: now }],
  };

  return { ok: true, order, reservation };
}

/**
 * Move an order to its next state and apply the stock effect that belongs to
 * that move. Illegal transitions are refused by name, not silently ignored.
 */
export function transitionOrder(order, to, inventory, options = {}) {
  const now = options.now ?? Date.now();
  if (!ORDER_STATES.includes(to)) {
    return { ok: false, reason: "unknown", message: `Unknown status “${to}”.` };
  }
  if (!canTransition(order.status, to)) {
    return {
      ok: false,
      reason: "transition",
      message: `An order that is ${STATUS_LABELS[order.status].toLowerCase()} cannot be ${STATUS_LABELS[to].toLowerCase()}.`,
    };
  }

  if (to === "shipped") commitReservation(inventory, order.items);
  else if (to === "cancelled") release(inventory, order.items);
  else if (to === "refunded") restock(inventory, order.items);

  order.status = to;
  order.updatedAt = now;
  order.timeline.push({ status: to, at: now });

  if (to === "delivered" && order.payment?.method === "cod") {
    order.payment.status = "paid";
    order.payment.paidAt = now;
  }
  if (to === "cancelled" && order.payment?.status === "paid") {
    order.payment.status = "refunded";
    order.payment.refundedAt = now;
  }
  if (to === "refunded") {
    order.payment.status = "refunded";
    order.payment.refundedAt = now;
  }

  return { ok: true, order };
}

/** Walk several transitions at once; used by the seeded order history. */
export function advanceOrder(order, statuses, inventory, options = {}) {
  const step = options.stepMs ?? DAY;
  let timestamp = options.now ?? order.createdAt;
  for (const status of statuses) {
    timestamp += step;
    const result = transitionOrder(order, status, inventory, { now: timestamp });
    if (!result.ok) return result;
  }
  return { ok: true, order };
}

export function orderItemCount(order) {
  return order.items.reduce((sum, line) => sum + line.qty, 0);
}

/** Newest first, which is the order a back office actually wants. */
export function sortOrders(orders) {
  return [...orders].sort((a, b) => b.createdAt - a.createdAt);
}
