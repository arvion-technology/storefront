/**
 * Inventory is kept as { [variantKey]: { onHand, reserved } }.
 *
 * reserved belongs to orders that have not shipped yet. available is derived.
 * Reserve is all-or-nothing across a whole order, which is what makes two
 * simultaneous checkouts for the last unit resolve to one winner and one
 * "not enough stock" instead of a negative count.
 */

import { listVariants, variantKey } from "./catalog.js";

export function createInventory(catalog) {
  const inventory = {};
  for (const { product, variant } of listVariants(catalog)) {
    inventory[variantKey(product.id, variant.id)] = {
      onHand: Math.max(0, Number(variant.stock) || 0),
      reserved: 0,
    };
  }
  return inventory;
}

export function stockOf(inventory, key) {
  const entry = inventory[key];
  if (!entry) return { onHand: 0, reserved: 0, available: 0 };
  const onHand = Math.max(0, Number(entry.onHand) || 0);
  const reserved = Math.max(0, Math.min(Number(entry.reserved) || 0, onHand));
  return { onHand, reserved, available: onHand - reserved };
}

export function availableStock(inventory, key) {
  return stockOf(inventory, key).available;
}

function normalise(items) {
  return (items || [])
    .map((item) => ({ key: item.key, qty: Math.max(0, Math.floor(Number(item.qty) || 0)) }))
    .filter((item) => item.key && item.qty > 0);
}

/**
 * Reserve every line or none of them. A failed multi-line reserve leaves the
 * inventory untouched, partial reservations are how oversells happen.
 */
export function reserve(inventory, items) {
  const lines = normalise(items);
  if (!lines.length) return { ok: false, reason: "empty", key: null };

  for (const line of lines) {
    const { available } = stockOf(inventory, line.key);
    if (available < line.qty) {
      return {
        ok: false,
        reason: "stock",
        key: line.key,
        available,
        requested: line.qty,
      };
    }
  }

  for (const line of lines) {
    if (!inventory[line.key]) inventory[line.key] = { onHand: 0, reserved: 0 };
    inventory[line.key].reserved += line.qty;
  }
  return { ok: true, reservations: lines.map((line) => ({ ...line })) };
}

/** Give reserved units back, e.g. when an unpaid order is cancelled. */
export function release(inventory, items) {
  for (const line of normalise(items)) {
    const entry = inventory[line.key];
    if (!entry) continue;
    entry.reserved = Math.max(0, entry.reserved - line.qty);
  }
}

/** Shipped means the stock has physically left: reserved becomes on-hand minus. */
export function commitReservation(inventory, items) {
  for (const line of normalise(items)) {
    const entry = inventory[line.key];
    if (!entry) continue;
    const committed = Math.min(line.qty, entry.onHand);
    entry.onHand = Math.max(0, entry.onHand - committed);
    entry.reserved = Math.max(0, entry.reserved - Math.min(line.qty, entry.reserved));
  }
}

/** Refunds and returns put units back on the shelf. */
export function restock(inventory, items) {
  for (const line of normalise(items)) {
    if (!inventory[line.key]) inventory[line.key] = { onHand: 0, reserved: 0 };
    inventory[line.key].onHand += line.qty;
  }
}

/**
 * Manual back-office adjustment. On-hand can never drop below what is already
 * reserved for open orders.
 */
export function adjust(inventory, key, delta) {
  const change = Math.trunc(Number(delta) || 0);
  if (!change) return { ok: false, reason: "no-change" };
  const entry = inventory[key] || (inventory[key] = { onHand: 0, reserved: 0 });
  const next = entry.onHand + change;
  if (next < entry.reserved) {
    return {
      ok: false,
      reason: "reserved",
      available: entry.onHand - entry.reserved,
      maxDecrease: entry.onHand - entry.reserved,
    };
  }
  if (next < 0) return { ok: false, reason: "negative" };
  entry.onHand = next;
  return { ok: true, onHand: entry.onHand, available: entry.onHand - entry.reserved };
}

/** Add missing variants (after a catalogue edit) without touching counts. */
export function reconcile(inventory, catalog) {
  for (const { product, variant } of listVariants(catalog)) {
    const key = variantKey(product.id, variant.id);
    if (!inventory[key]) inventory[key] = { onHand: variant.stock, reserved: 0 };
  }
  return inventory;
}

export function inventoryRows(inventory, catalog) {
  return listVariants(catalog).map(({ product, variant, key }) => ({
    key,
    product,
    variant,
    ...stockOf(inventory, key),
  }));
}

export function lowStock(inventory, catalog, threshold = 5) {
  return inventoryRows(inventory, catalog)
    .filter((row) => row.available <= threshold)
    .sort((a, b) => a.available - b.available || a.product.name.localeCompare(b.product.name));
}

export function inventoryTotals(inventory, catalog) {
  const rows = inventoryRows(inventory, catalog);
  return {
    variants: rows.length,
    onHand: rows.reduce((sum, row) => sum + row.onHand, 0),
    reserved: rows.reduce((sum, row) => sum + row.reserved, 0),
    available: rows.reduce((sum, row) => sum + row.available, 0),
    low: rows.filter((row) => row.available <= 5).length,
  };
}

export function itemTotals(items) {
  return normalise(items).reduce((sum, line) => sum + line.qty, 0);
}
