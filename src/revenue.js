/**
 * Revenue reporting for the back office.
 *
 * Policy, stated once: an order counts toward revenue from the moment it is
 * placed until it is cancelled or refunded. A refund is not netted against the
 * day it was refunded; the order simply stops counting. That keeps the daily
 * series easy to explain and easy to test.
 */

import { PAYMENT_METHODS } from "./orders.js";

export const DAY_MS = 24 * 60 * 60 * 1000;

export function startOfUTCDay(timestamp) {
  const date = new Date(timestamp);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

export function dayKey(timestamp) {
  return new Date(timestamp).toISOString().slice(0, 10);
}

export function isRevenueOrder(order) {
  return Boolean(order) && order.status !== "cancelled" && order.status !== "refunded";
}

/**
 * Dense daily series: days with no orders are present with zero, so a chart
 * does not silently compress quiet weeks.
 */
export function revenueByDay(orders, options = {}) {
  const days = Math.max(1, Math.floor(options.days ?? 30));
  const now = options.now ?? Date.now();
  const today = startOfUTCDay(now);
  const start = today - (days - 1) * DAY_MS;

  const buckets = [];
  const index = new Map();
  for (let i = 0; i < days; i += 1) {
    const stamp = start + i * DAY_MS;
    const date = dayKey(stamp);
    index.set(date, i);
    buckets.push({ date, timestamp: stamp, revenue: 0, orders: 0 });
  }

  for (const order of orders) {
    if (!isRevenueOrder(order)) continue;
    const timestamp = order.createdAt;
    if (!Number.isFinite(timestamp) || timestamp < start || timestamp >= today + DAY_MS) continue;
    const slot = index.get(dayKey(timestamp));
    if (slot === undefined) continue;
    buckets[slot].revenue += Math.round(Number(order.totals?.total) || 0);
    buckets[slot].orders += 1;
  }

  return buckets;
}

export function revenueSummary(orders, options = {}) {
  const series = revenueByDay(orders, options);
  const revenue = series.reduce((sum, day) => sum + day.revenue, 0);
  const orderCount = series.reduce((sum, day) => sum + day.orders, 0);

  const inRange = orders.filter((order) => {
    if (!isRevenueOrder(order)) return false;
    const timestamp = order.createdAt;
    return Number.isFinite(timestamp) && timestamp >= series[0].timestamp && timestamp < series[0].timestamp + series.length * DAY_MS;
  });

  const paymentSplit = PAYMENT_METHODS.map((method) => {
    const matching = inRange.filter((order) => order.payment?.method === method.id);
    return {
      method: method.id,
      label: method.label,
      count: matching.length,
      amount: matching.reduce((sum, order) => sum + (order.totals?.total || 0), 0),
    };
  });

  const productTotals = new Map();
  for (const order of inRange) {
    for (const line of order.items) {
      const entry = productTotals.get(line.productId) || { productId: line.productId, name: line.name, qty: 0, revenue: 0 };
      entry.qty += line.qty;
      entry.revenue += line.lineTotal;
      productTotals.set(line.productId, entry);
    }
  }

  return {
    days: series.length,
    revenue,
    orderCount,
    averageOrder: orderCount ? Math.round(revenue / orderCount) : 0,
    series,
    paymentSplit,
    topProducts: [...productTotals.values()].sort((a, b) => b.qty - a.qty || b.revenue - a.revenue),
    refundedCount: orders.filter((order) => order.status === "refunded").length,
    cancelledCount: orders.filter((order) => order.status === "cancelled").length,
    refundedAmount: orders
      .filter((order) => order.status === "refunded")
      .reduce((sum, order) => sum + (order.totals?.total || 0), 0),
  };
}
