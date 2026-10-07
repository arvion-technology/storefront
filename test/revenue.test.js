import test from "node:test";
import assert from "node:assert/strict";

import { DAY_MS, dayKey, isRevenueOrder, revenueByDay, revenueSummary, startOfUTCDay } from "../src/revenue.js";

const NOW = Date.UTC(2026, 9, 28, 12, 0); // 28 Oct 2026

function makeOrder({ daysAgo = 0, status = "delivered", total = 100000, method = "esewa", items } = {}) {
  return {
    id: `order-${daysAgo}-${status}-${total}`,
    status,
    createdAt: NOW - daysAgo * DAY_MS,
    totals: { total },
    payment: { method },
    items: items || [{ productId: "tea-ilam", name: "Ilam Golden Tips", qty: 1, lineTotal: total }],
  };
}

test("a dense daily series includes quiet days", () => {
  const series = revenueByDay([makeOrder({ daysAgo: 0, total: 125000 })], { days: 7, now: NOW });
  assert.equal(series.length, 7);
  assert.equal(series[0].date, "2026-10-22");
  assert.equal(series[6].date, "2026-10-28");
  assert.equal(series[6].revenue, 125000);
  assert.equal(series[0].revenue, 0);
  assert.equal(series.reduce((sum, day) => sum + day.orders, 0), 1);
});

test("cancelled and refunded orders are not revenue", () => {
  assert.equal(isRevenueOrder(makeOrder({ status: "placed" })), true);
  assert.equal(isRevenueOrder(makeOrder({ status: "refunded" })), false);
  assert.equal(isRevenueOrder(makeOrder({ status: "cancelled" })), false);

  const series = revenueByDay(
    [
      makeOrder({ daysAgo: 1, total: 100000, status: "delivered" }),
      makeOrder({ daysAgo: 1, total: 999999, status: "cancelled" }),
      makeOrder({ daysAgo: 2, total: 888888, status: "refunded" }),
    ],
    { days: 7, now: NOW }
  );
  assert.equal(series.reduce((sum, day) => sum + day.revenue, 0), 100000);
});

test("orders outside the window are ignored", () => {
  const summary = revenueSummary([makeOrder({ daysAgo: 30, total: 500000 })], { days: 7, now: NOW });
  assert.equal(summary.revenue, 0);
  assert.equal(summary.orderCount, 0);
});

test("summary aggregates revenue, average and payment split", () => {
  const orders = [
    makeOrder({ daysAgo: 0, total: 120000, method: "esewa" }),
    makeOrder({ daysAgo: 2, total: 80000, method: "cod" }),
    makeOrder({ daysAgo: 4, total: 200000, method: "esewa" }),
    makeOrder({ daysAgo: 5, total: 60000, method: "khalti", status: "cancelled" }),
    makeOrder({ daysAgo: 6, total: 30000, method: "esewa", status: "refunded" }),
  ];
  const summary = revenueSummary(orders, { days: 7, now: NOW });

  assert.equal(summary.revenue, 400000);
  assert.equal(summary.orderCount, 3);
  assert.equal(summary.averageOrder, 133333);
  assert.equal(summary.refundedCount, 1);
  assert.equal(summary.cancelledCount, 1);
  assert.equal(summary.refundedAmount, 30000);

  const esewa = summary.paymentSplit.find((row) => row.method === "esewa");
  assert.equal(esewa.count, 2);
  assert.equal(esewa.amount, 320000);
  const khalti = summary.paymentSplit.find((row) => row.method === "khalti");
  assert.equal(khalti.count, 0);
});

test("top products aggregate quantities across orders", () => {
  const orders = [
    makeOrder({
      daysAgo: 1,
      total: 100000,
      items: [
        { productId: "tea-ilam", name: "Ilam Golden Tips", qty: 2, lineTotal: 60000 },
        { productId: "ceramic-mug", name: "Bhaktapur Ceramic Mug", qty: 1, lineTotal: 40000 },
      ],
    }),
    makeOrder({
      daysAgo: 2,
      total: 80000,
      items: [{ productId: "tea-ilam", name: "Ilam Golden Tips", qty: 1, lineTotal: 80000 }],
    }),
  ];
  const summary = revenueSummary(orders, { days: 7, now: NOW });
  assert.equal(summary.topProducts[0].productId, "tea-ilam");
  assert.equal(summary.topProducts[0].qty, 3);
  assert.equal(summary.topProducts[1].productId, "ceramic-mug");
});

test("day helpers are UTC-stable", () => {
  assert.equal(dayKey(NOW), "2026-10-28");
  assert.equal(startOfUTCDay(NOW + 5 * 60 * 60 * 1000), Date.UTC(2026, 9, 28));
  assert.equal(new Date(DAY_MS).getUTCHours(), 0);
});
