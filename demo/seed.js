/**
 * Seeded shop state: opening stock, a month of orders in mixed states, and the
 * inventory those orders imply. Orders are created through the same functions
 * the checkout uses, then advanced with the same state machine, so the seed
 * cannot disagree with the running logic.
 */

import { CATALOG } from "../src/catalog.js";
import { addLine, emptyCart, priceCart, toOrderItems } from "../src/cart.js";
import { createInventory } from "../src/inventory.js";
import { advanceOrder, createOrder, nextOrderNumber } from "../src/orders.js";

const DAY = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;

const CUSTOMERS = [
  { name: "Asha Shrestha", phone: "9801234567", email: "asha.shrestha@example.com", address: "Jhamsikhel, Lalitpur", city: "Lalitpur", notes: "" },
  { name: "Bikash Tamang", phone: "9812345678", email: "bikash.tamang@example.com", address: "Boudha, Kathmandu", city: "Kathmandu", notes: "" },
  { name: "Sita Gurung", phone: "9823456789", email: "sita.gurung@example.com", address: "Lakeside, Pokhara", city: "Pokhara", notes: "Leave with the guard if I am out." },
  { name: "Nabin Karki", phone: "9834567890", email: "nabin.karki@example.com", address: "Suryabinayak, Bhaktapur", city: "Bhaktapur", notes: "" },
  { name: "Rojina Maharjan", phone: "9845678901", email: "rojina.maharjan@example.com", address: "Patan Dhoka, Lalitpur", city: "Lalitpur", notes: "" },
  { name: "Prakash Adhikari", phone: "9856789012", email: "prakash.adhikari@example.com", address: "Baneshwor, Kathmandu", city: "Kathmandu", notes: "" },
  { name: "Manisha Rai", phone: "9867890123", email: "manisha.rai@example.com", address: "Bhanu Chowk, Dharan", city: "Dharan", notes: "" },
  { name: "Suraj Bajracharya", phone: "9878901234", email: "suraj.bajracharya@example.com", address: "Mangal Bazaar, Lalitpur", city: "Lalitpur", notes: "" },
  { name: "Anisha Thapa", phone: "9809876543", email: "anisha.thapa@example.com", address: "Lazimpat, Kathmandu", city: "Kathmandu", notes: "" },
  { name: "Deepak Shrestha", phone: "9810987654", email: "deepak.shrestha@example.com", address: "Thimi, Bhaktapur", city: "Bhaktapur", notes: "" },
];

/**
 * daysAgo controls the revenue chart. path is the state-machine walk applied
 * after the order is placed; an empty path leaves it placed.
 */
const ORDERS = [
  { productId: "ceramic-mug", variantId: "rust", qty: 2, daysAgo: 28, path: ["packed", "shipped", "delivered"], payment: "esewa", customer: 0, promoCode: "NEW10" },
  { productId: "tea-ilam", variantId: "250g", qty: 1, daysAgo: 26, path: ["packed", "shipped", "delivered"], payment: "khalti", customer: 2 },
  { productId: "paper-notebook", variantId: "a5", qty: 2, daysAgo: 24, path: ["packed", "shipped", "delivered"], payment: "cod", customer: 1 },
  { productId: "textile-throw", variantId: "rust", qty: 1, daysAgo: 21, path: ["packed", "shipped", "delivered"], payment: "esewa", customer: 4 },
  { productId: "pantry-rice", variantId: "5kg", qty: 1, daysAgo: 19, path: ["packed", "shipped", "delivered"], payment: "cod", customer: 5 },
  { productId: "paper-cards", variantId: "twelve", qty: 1, daysAgo: 17, path: ["packed", "shipped", "delivered"], payment: "esewa", customer: 3, promoCode: "TEA200" },
  { productId: "home-candle", variantId: "lokta-cedar", qty: 2, daysAgo: 15, path: ["packed", "shipped", "delivered"], payment: "khalti", customer: 6 },
  { productId: "pantry-pepper", variantId: "200g", qty: 1, daysAgo: 13, path: ["packed", "shipped", "delivered"], payment: "cod", customer: 7 },
  { productId: "textile-scarf", variantId: "crimson", qty: 1, daysAgo: 11, path: ["packed", "shipped", "delivered"], payment: "esewa", customer: 8, promoCode: "FESTIVE15" },
  { productId: "coffee-mustang", variantId: "500g", qty: 1, daysAgo: 9, path: ["packed", "shipped", "delivered"], payment: "khalti", customer: 9 },
  { productId: "ceramic-vase", variantId: "small", qty: 1, daysAgo: 7, path: ["packed", "shipped", "delivered"], payment: "cod", customer: 2 },
  { productId: "ceramic-mug", variantId: "ash", qty: 1, daysAgo: 6, path: ["packed", "shipped"], payment: "esewa", customer: 5 },
  { productId: "paper-notebook", variantId: "a4", qty: 1, daysAgo: 4, path: ["packed", "shipped"], payment: "cod", customer: 4 },
  { productId: "tea-ilam", variantId: "100g", qty: 2, daysAgo: 3, path: ["packed"], payment: "esewa", customer: 7 },
  { productId: "pantry-rice", variantId: "1kg", qty: 3, daysAgo: 2, path: [], payment: "cod", customer: 1 },
  { productId: "pantry-pepper", variantId: "50g", qty: 1, daysAgo: 1, path: ["cancelled"], payment: "khalti", customer: 6 },
  { productId: "home-candle", variantId: "plain", qty: 1, daysAgo: 1, path: ["packed", "shipped", "refunded"], payment: "esewa", customer: 3 },
  { productId: "ceramic-mug", variantId: "rust", qty: 1, daysAgo: 0, path: [], payment: "esewa", customer: 8 },
];

export function seedShop(options = {}) {
  const now = options.now ?? Date.now();
  const inventory = createInventory(CATALOG);
  const orders = [];

  ORDERS.forEach((spec, index) => {
    const createdAt = now - spec.daysAgo * DAY - (index % 6) * HOUR;
    const customer = CUSTOMERS[spec.customer % CUSTOMERS.length];
    const cart = emptyCart();
    addLine(cart, spec.productId, spec.variantId, spec.qty, 999);
    const priced = priceCart(cart, CATALOG, { promoCode: spec.promoCode || null });

    const result = createOrder({
      items: toOrderItems(priced),
      customer,
      payment: spec.payment,
      totals: priced,
      inventory,
      now: createdAt,
      orderNumber: nextOrderNumber(orders, createdAt),
    });
    if (!result.ok) return;
    orders.push(result.order);

    if (spec.path.length) {
      advanceOrder(result.order, spec.path, inventory, {
        now: createdAt,
        stepMs: 5 * HOUR,
      });
    }
  });

  return { inventory, orders };
}
