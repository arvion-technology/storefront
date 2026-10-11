/**
 * Bazaar Store — demo application.
 *
 * src/ owns pricing, stock, promos, the order state machine and revenue.
 * This file routes between the storefront and the back office and renders the
 * two sides from the same in-memory shop state.
 */

import {
  CATALOG,
  categories,
  filterCatalog,
  findProduct,
  findVariant,
  isOnSale,
  priceRange,
  salePercent,
  variantKey,
} from "../src/catalog.js";
import { formatDiscount, formatNPR } from "../src/money.js";
import { validatePromo } from "../src/promos.js";
import {
  addLine,
  cartCount,
  changeLineQty,
  emptyCart,
  findLine,
  priceCart,
  removeLine,
  stockIssues,
  toOrderItems,
} from "../src/cart.js";
import {
  adjust,
  availableStock,
  createInventory,
  inventoryRows,
  lowStock,
  reconcile,
} from "../src/inventory.js";
import {
  PAYMENT_METHODS,
  STATUS_LABELS,
  allowedTransitions,
  createOrder,
  findPaymentMethod,
  nextOrderNumber,
  sortOrders,
  transitionOrder,
} from "../src/orders.js";
import { revenueSummary } from "../src/revenue.js";
import { productArt } from "./art.js";
import { seedShop } from "./seed.js";

const $ = A.$;
const el = A.el;
const fmt = A.fmt;
const toast = A.toast;

const STORAGE_KEY = "bazaar.store.v1";
const DELIVERY_ESTIMATE = "2–4 working days inside Nepal";
const CITIES = ["Kathmandu", "Lalitpur", "Bhaktapur", "Pokhara", "Dharan", "Other"];

const ICONS = {
  bag: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 8h12l1 12H5L6 8z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/></svg>',
  check: '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12 4.5 4.5L19 6.5"/></svg>',
  arrow: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h13M13 6l6 6-6 6"/></svg>',
  search: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/></svg>',
};

const DEFAULT_CHECKOUT = {
  name: "Asha Shrestha",
  phone: "9801234567",
  email: "asha.shrestha@example.com",
  address: "Jhamsikhel, Lalitpur",
  city: "Lalitpur",
  notes: "",
  payment: "cod",
};

const state = {
  inventory: createInventory(CATALOG),
  orders: [],
  cart: emptyCart(),
  promoCode: null,
  route: { name: "shop" },
  filter: { category: "All", query: "", sort: "featured" },
  variantSelection: {},
  detailQty: {},
  checkout: { ...DEFAULT_CHECKOUT },
  cartOpen: false,
  adminStatus: "all",
  lastOrderId: null,
  processing: false,
  saveTimer: null,
};

/* ------------------------------------------------------------- persistence -- */

function probeStorage() {
  try {
    const key = "__bazaar_probe__";
    window.localStorage.setItem(key, "1");
    window.localStorage.removeItem(key);
    return window.localStorage;
  } catch {
    return null;
  }
}

const storage = probeStorage();

function sanitiseInventory(raw) {
  const inventory = createInventory(CATALOG);
  if (!raw || typeof raw !== "object") return inventory;
  for (const [key, entry] of Object.entries(raw)) {
    if (!inventory[key] || !entry || typeof entry !== "object") continue;
    const onHand = Number(entry.onHand);
    const reserved = Number(entry.reserved);
    inventory[key] = {
      onHand: Number.isFinite(onHand) ? Math.max(0, Math.floor(onHand)) : inventory[key].onHand,
      reserved: Number.isFinite(reserved) ? Math.max(0, Math.floor(reserved)) : 0,
    };
    inventory[key].reserved = Math.min(inventory[key].reserved, inventory[key].onHand);
  }
  return reconcile(inventory, CATALOG);
}

function sanitiseOrders(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (order) =>
      order &&
      typeof order === "object" &&
      typeof order.orderNumber === "string" &&
      Number.isFinite(order.createdAt) &&
      Array.isArray(order.items) &&
      order.totals &&
      Number.isFinite(order.totals.total)
  );
}

function sanitiseCart(raw) {
  const cart = emptyCart();
  if (!raw || !Array.isArray(raw.lines)) return cart;
  for (const line of raw.lines) {
    if (!line) continue;
    const product = findProduct(CATALOG, line.productId);
    if (!product || !findVariant(product, line.variantId)) continue;
    const available = availableStock(state.inventory, variantKey(line.productId, line.variantId));
    addLine(cart, line.productId, line.variantId, Math.max(1, Number(line.qty) || 1), available);
  }
  return cart;
}

function loadShop() {
  let parsed = null;
  if (storage) {
    try {
      const raw = storage.getItem(STORAGE_KEY);
      if (raw) parsed = JSON.parse(raw);
    } catch {
      parsed = null;
    }
  }

  if (!parsed || parsed.version !== 1) {
    const seeded = seedShop();
    state.inventory = seeded.inventory;
    state.orders = seeded.orders;
    state.cart = emptyCart();
    state.promoCode = null;
    persistNow();
    return;
  }

  state.inventory = sanitiseInventory(parsed.inventory);
  state.orders = sanitiseOrders(parsed.orders);
  state.cart = sanitiseCart(parsed.cart);
  state.promoCode = typeof parsed.promoCode === "string" ? parsed.promoCode : null;

  if (!state.orders.length) {
    const seeded = seedShop();
    state.inventory = seeded.inventory;
    state.orders = seeded.orders;
  }
  persistSoon();
}

function persistNow() {
  if (!storage) return false;
  try {
    storage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: 1,
        savedAt: Date.now(),
        inventory: state.inventory,
        orders: state.orders,
        cart: state.cart,
        promoCode: state.promoCode,
      })
    );
    return true;
  } catch {
    return false;
  }
}

function persistSoon() {
  clearTimeout(state.saveTimer);
  state.saveTimer = setTimeout(persistNow, 180);
}

/* ------------------------------------------------------------------ routes -- */

function parseRoute(hash = window.location.hash) {
  const clean = String(hash || "").replace(/^#\/?/, "");
  const parts = clean.split("/").filter(Boolean);
  if (!parts.length || parts[0] === "shop") return { name: "shop" };
  if (parts[0] === "product" && parts[1]) return { name: "product", productId: parts[1] };
  if (parts[0] === "checkout") return { name: "checkout" };
  if (parts[0] === "confirmation" && parts[1]) return { name: "confirmation", orderId: parts[1] };
  if (parts[0] === "admin") return { name: "admin", tab: parts[1] === "inventory" ? "inventory" : "orders" };
  return { name: "shop" };
}

function navigate(hash) {
  if (window.location.hash === hash) {
    state.route = parseRoute(hash);
    state.cartOpen = false;
    render();
    window.scrollTo(0, 0);
    return;
  }
  window.location.hash = hash;
}

window.addEventListener("hashchange", () => {
  state.route = parseRoute();
  state.cartOpen = false;
  render();
  window.scrollTo(0, 0);
});

/* ----------------------------------------------------------------- helpers -- */

const money = (paisa) => formatNPR(paisa);
const paymentMethod = (id) => findPaymentMethod(id);
const productAvailable = (product) =>
  product.variants.reduce(
    (sum, variant) => sum + availableStock(state.inventory, variantKey(product.id, variant.id)),
    0
  );
const selectedVariantId = (product) => {
  const selected = state.variantSelection[product.id];
  if (selected && findVariant(product, selected)) return selected;
  return product.variants[0]?.id || null;
};

function orderById(id) {
  return state.orders.find((order) => order.orderNumber === id || order.id === id) || null;
}

function plural(count, one) {
  return `${count} ${count === 1 ? one : `${one}s`}`;
}

function navigateToProduct(productId) {
  window.location.hash = `#product/${productId}`;
}

function scrollToGrid() {
  const grid = $("#shop-grid");
  if (grid) grid.scrollIntoView({ behavior: "smooth", block: "start" });
}

function setCategory(category) {
  state.filter.category = category;
  if (state.route.name !== "shop") {
    navigate("#shop");
    return;
  }
  renderShopResults();
}

function renderShopResults() {
  const grid = $("#shop-grid");
  if (!grid) return;
  const products = filterCatalog(CATALOG, state.filter);
  grid.replaceChildren(...products.map((product) => productCard(product)));
  const count = $("#result-count");
  if (count) count.textContent = `${products.length} ${products.length === 1 ? "item" : "items"}`;
  for (const chip of document.querySelectorAll("[data-category]")) {
    chip.classList.toggle("active", chip.dataset.category === state.filter.category);
  }
  if (!products.length) {
    grid.replaceChildren(
      el(
        "div",
        { class: "empty-page", style: "grid-column:1/-1" },
        el("h1", { text: "Nothing matches that search" }),
        el("p", { text: "Try a different word, or browse everything in the shop." }),
        el("button", { class: "btn primary", "data-category": "All", text: "Show all products" })
      )
    );
  }
}

/* --------------------------------------------------------------- storefront -- */

function navLink(label, href, active) {
  return el("a", { href, "data-nav": href, class: active ? "active" : "", text: label });
}

function topbar() {
  const count = cartCount(state.cart);
  const bar = el(
    "header",
    { class: "shop-bar" },
    el(
      "a",
      { class: "shop-brand", href: "#shop", "data-nav": "#shop", "aria-label": "Bazaar Store home" },
      el("span", { class: "brand-mark", text: "B" }),
      el(
        "span",
        {},
        el("span", { class: "brand-word", text: "Bazaar Store" }),
        el("span", { class: "brand-sub", text: "Kathmandu" })
      )
    ),
    el(
      "nav",
      { class: "shop-nav", "aria-label": "Shop" },
      navLink("Shop", "#shop", ["shop", "product"].includes(state.route.name)),
      navLink("Back office", "#admin", false)
    )
  );

  if (state.route.name === "shop") {
    bar.append(el("span", { class: "bar-note", text: "Free delivery over Rs 2,500" }));
    bar.append(
      el(
        "div",
        { class: "shop-search" },
        el("span", { class: "search-ico", html: ICONS.search }),
        el("input", {
          class: "input",
          id: "shop-search",
          type: "search",
          placeholder: "Search the shop",
          "aria-label": "Search products",
          value: state.filter.query,
        })
      )
    );
  } else {
    bar.append(el("span", { class: "spacer" }));
  }

  bar.append(
    el(
      "div",
      { class: "shop-actions" },
      el(
        "button",
        {
          class: "btn primary cart-button",
          type: "button",
          "data-cart-open": "true",
          "aria-label": `Shopping bag, ${count} items`,
        },
        el("span", { html: ICONS.bag }),
        el("span", { text: "Bag" }),
        el("span", { class: "cart-count", text: String(count) })
      )
    )
  );
  return bar;
}

function heroCollage() {
  const ids = ["ceramic-mug", "textile-throw", "paper-notebook"];
  const classes = ["tile-a", "tile-b", "tile-c"];
  const tiles = ids.map((id, index) =>
    el("div", { class: `hero-tile ${classes[index]}`, html: productArt(findProduct(CATALOG, id)) })
  );
  return el(
    "div",
    { class: "hero-collage" },
    ...tiles,
    el(
      "span",
      { class: "hero-stamp" },
      el("span", { class: "dot" }),
      el("span", { text: "Small batch, made in Nepal" })
    )
  );
}

function heroSection() {
  return el(
    "section",
    { class: "shop-hero" },
    el(
      "div",
      {},
      el("div", { class: "eyebrow-orange", text: "Small-batch goods · Kathmandu" }),
      el("h1", { text: "Good things, made close to home." }),
      el(
        "p",
        { class: "hero-lede" },
        "A dozen useful objects from Nepali makers: hand-thrown ceramics, handloom cotton, lokta paper and pantry staples. Pick a variant, add it to the bag, pay on delivery or with a wallet."
      ),
      el(
        "div",
        { class: "hero-actions" },
        el(
          "button",
          { class: "btn primary lg", type: "button", "data-scroll": "grid" },
          el("span", { text: "Shop the collection" }),
          el("span", { html: ICONS.arrow })
        ),
        el("span", { class: "hero-note" }, el("span", { class: "dot" }), el("span", { text: "Free delivery over Rs 2,500" }))
      )
    ),
    heroCollage()
  );
}

function toolbar() {
  const chips = categories(CATALOG).map((category) =>
    el("button", {
      class: `chip${state.filter.category === category ? " active" : ""}`,
      type: "button",
      "data-category": category,
      text: category,
    })
  );
  const products = filterCatalog(CATALOG, state.filter);

  return el(
    "div",
    { class: "shop-toolbar" },
    el("div", { class: "chips", role: "group", "aria-label": "Filter by category" }, ...chips),
    el(
      "div",
      { class: "toolbar-right" },
      el("span", { class: "result-count", id: "result-count", text: `${products.length} items` }),
      el(
        "select",
        { class: "select sort-select", id: "sort-select", "aria-label": "Sort products" },
        el("option", { value: "featured", selected: state.filter.sort === "featured" }, "Featured"),
        el("option", { value: "price-asc", selected: state.filter.sort === "price-asc" }, "Price: low to high"),
        el("option", { value: "price-desc", selected: state.filter.sort === "price-desc" }, "Price: high to low"),
        el("option", { value: "name", selected: state.filter.sort === "name" }, "Name")
      )
    )
  );
}

function productCard(product) {
  const range = priceRange(product);
  const available = productAvailable(product);
  const lowest = product.variants.reduce((best, variant) => (variant.price < best.price ? variant : best), product.variants[0]);
  const flag = available === 0 ? "Sold out" : available <= 5 ? `Only ${available} left` : "";
  const flagClass = available === 0 ? "out" : available <= 5 ? "low" : "";

  const card = el("article", {
    class: "product-card",
    tabindex: "0",
    role: "link",
    "data-product": product.id,
    "aria-label": `View ${product.name}`,
  });

  const art = el("div", { class: "product-art", html: productArt(product) });
  if (flag) art.append(el("span", { class: `stock-flag ${flagClass}`, text: flag }));

  const priceBox = el("span", { class: "price" });
  if (isOnSale(lowest)) priceBox.append(el("span", { class: "was", text: money(lowest.compareAt) }));
  priceBox.append(el("span", { text: `${range.single ? "" : "From "}${money(range.low)}` }));

  card.append(
    art,
    el(
      "div",
      { class: "product-body" },
      el("span", { class: "product-cat", text: product.category }),
      el("h3", { class: "product-name", text: product.name }),
      el("p", { class: "product-blurb", text: product.blurb }),
      el(
        "div",
        { class: "product-foot" },
        priceBox,
        el("button", {
          class: "add-mini",
          type: "button",
          "data-add-product": product.id,
          "aria-label": `Add ${product.name} to bag`,
          disabled: available === 0,
          text: "+",
        })
      )
    )
  );
  return card;
}

function shopView() {
  return el(
    "main",
    { class: "shop-main" },
    heroSection(),
    toolbar(),
    el(
      "div",
      { class: "product-grid", id: "shop-grid", "aria-label": "Products" },
      ...filterCatalog(CATALOG, state.filter).map(productCard)
    ),
    el(
      "footer",
      { class: "shop-footer" },
      el("span", { text: "Seeded demo · no real payments" }),
      el("span", { class: "sep" }),
      el("span", { text: "12 products, 24 variants" }),
      el("span", { class: "sep" }),
      el("span", { text: "Cart, stock and orders live in this browser" })
    )
  );
}

function breadcrumbs(parts) {
  const nodes = [];
  parts.forEach((part, index) => {
    if (index) nodes.push(el("span", { class: "crumb-sep", text: "/" }));
    if (part.href) nodes.push(el("a", { href: part.href, "data-nav": part.href, text: part.label }));
    else nodes.push(el("span", { text: part.label }));
  });
  return el("nav", { class: "breadcrumbs", "aria-label": "Breadcrumb" }, ...nodes);
}

function priceLine(variant) {
  const line = el("div", { class: "detail-price" }, el("span", { class: "now", text: money(variant.price) }));
  if (isOnSale(variant)) {
    line.append(
      el("span", { class: "was", text: money(variant.compareAt) }),
      el("span", { class: "off", text: `${salePercent(variant)}% off` })
    );
  }
  return line;
}

function productView(product) {
  const variantId = selectedVariantId(product);
  const variant = findVariant(product, variantId);
  const available = availableStock(state.inventory, variantKey(product.id, variantId));
  const qty = Math.min(Math.max(1, state.detailQty[product.id] || 1), Math.max(1, Math.min(10, available)));
  state.detailQty[product.id] = qty;

  const variantChips = product.variants.map((option) => {
    const stock = availableStock(state.inventory, variantKey(product.id, option.id));
    const chip = el("button", {
      class: `variant-chip${option.id === variantId ? " active" : ""}`,
      type: "button",
      "data-variant": option.id,
      "data-variant-product": product.id,
      disabled: stock === 0,
    });
    chip.append(
      el("span", { text: option.label }),
      el("small", { text: stock === 0 ? "sold out" : stock <= 5 ? `${stock} left` : "in stock" })
    );
    return chip;
  });

  const related = CATALOG.filter((item) => item.id !== product.id)
    .sort((a, b) => Number(b.category === product.category) - Number(a.category === product.category))
    .slice(0, 3);

  const stockLine = el(
    "div",
    { class: `stock-line${available === 0 ? " out" : available <= 5 ? " low" : ""}` },
    el("span", { class: "dot" }),
    el("span", {
      text:
        available === 0
          ? "Sold out — check back soon"
          : available <= 5
            ? `Only ${available} left in stock`
            : "In stock, ready to ship",
    })
  );

  return el(
    "main",
    { class: "shop-main" },
    el(
      "div",
      { class: "product-detail" },
      el("div", { class: "detail-art", html: productArt(product) }),
      el(
        "div",
        { class: "detail-copy" },
        breadcrumbs([
          { label: "Shop", href: "#shop" },
          { label: product.category, href: "#shop" },
          { label: product.name },
        ]),
        el("div", { class: "detail-cat", text: product.category }),
        el("h1", { text: product.name }),
        priceLine(variant),
        el("p", { class: "detail-blurb", text: product.description }),
        el(
          "div",
          { class: "option-label" },
          el("span", { text: "Choose a variant" }),
          el("span", { text: product.variants.length === 1 ? "one size" : `${product.variants.length} options` })
        ),
        el("div", { class: "variant-row", role: "group", "aria-label": "Variants" }, ...variantChips),
        stockLine,
        el(
          "div",
          { class: "buy-row" },
          el(
            "div",
            { class: "qty-stepper", "aria-label": "Quantity" },
            el(
              "button",
              {
                type: "button",
                "data-detail-qty": "-1",
                "data-qty-product": product.id,
                "aria-label": "Decrease quantity",
                disabled: qty <= 1,
              },
              "−"
            ),
            el("span", { text: String(qty) }),
            el(
              "button",
              {
                type: "button",
                "data-detail-qty": "1",
                "data-qty-product": product.id,
                "aria-label": "Increase quantity",
                disabled: qty >= Math.min(10, available),
              },
              "+"
            )
          ),
          el(
            "button",
            {
              class: "btn primary",
              type: "button",
              "data-action": "add-to-cart",
              "data-product": product.id,
              disabled: available === 0,
            },
            el("span", { html: ICONS.bag }),
            el("span", { text: available === 0 ? "Sold out" : `Add to bag · ${money(variant.price * qty)}` })
          )
        ),
        el(
          "div",
          { class: "delivery-note" },
          el("div", {}, el("strong", { text: "Delivery " }), "Rs 150 flat, free over Rs 2,500. ", DELIVERY_ESTIMATE, "."),
          el("div", {}, el("strong", { text: "Payment " }), "Cash on delivery, eSewa or Khalti — the wallet adapters are mocked."),
          el("div", {}, el("strong", { text: "Returns " }), "Unused items can come back within seven days; we pay the return courier.")
        ),
        el(
          "dl",
          { class: "spec-list" },
          el("div", { class: "spec-row" }, el("dt", { text: "Materials" }), el("dd", { text: product.materials })),
          el("div", { class: "spec-row" }, el("dt", { text: "Care" }), el("dd", { text: product.care }))
        )
      )
    ),
    el(
      "section",
      {},
      el(
        "div",
        { class: "related-head" },
        el("h2", { text: "More from the shelf" }),
        el("span", { class: "small muted", text: "Three things that pair well" })
      ),
      el("div", { class: "product-grid related" }, ...related.map(productCard))
    ),
    el(
      "div",
      { class: "shop-footer" },
      el("span", { text: "Seeded demo · no real payments" }),
      el("span", { class: "sep" }),
      el("span", { text: "Variant stock is reserved when an order is placed" })
    )
  );
}

/* ------------------------------------------------------------------- cart -- */

function summaryRows(priced, options = {}) {
  const rows = [];
  rows.push(el("div", { class: "summary-row" }, el("span", { class: "label", text: "Subtotal" }), el("span", { text: money(priced.subtotal) })));
  if (priced.saleDiscount > 0) {
    rows.push(el("div", { class: "summary-row discount" }, el("span", { class: "label", text: "Sale savings" }), el("span", { text: formatDiscount(priced.saleDiscount) })));
  }
  if (priced.promoDiscount > 0) {
    rows.push(el("div", { class: "summary-row discount" }, el("span", { class: "label", text: `Promo ${priced.promo?.code || ""}` }), el("span", { text: formatDiscount(priced.promoDiscount) })));
  }
  rows.push(
    el(
      "div",
      { class: "summary-row" },
      el("span", { class: "label", text: "Delivery" }),
      el("span", { text: priced.shippingFree ? "Free" : money(priced.shipping) })
    )
  );
  rows.push(el("div", { class: "summary-row total" }, el("span", { class: "label", text: "Total" }), el("span", { text: money(priced.total) })));
  if (options.note) rows.push(el("div", { class: "promo-hint", text: options.note }));
  return rows;
}

function renderOverlay() {
  const root = $("#overlay-root");
  root.replaceChildren();
  if (!state.cartOpen) return;

  const priced = priceCart(state.cart, CATALOG, { promoCode: state.promoCode });
  const drawer = el("aside", { class: "cart-drawer", role: "dialog", "aria-modal": "true", "aria-label": "Shopping bag" });
  drawer.append(
    el(
      "div",
      { class: "cart-head" },
      el(
        "div",
        {},
        el("h2", { text: "Your bag" }),
        el("div", { class: "cart-head-sub", text: `${plural(priced.itemCount, "item")} · ${money(priced.subtotal)}` })
      ),
      el("button", { class: "btn ghost sm", type: "button", "data-cart-close": "true", "aria-label": "Close bag" }, "Close")
    )
  );

  const body = el("div", { class: "cart-body" });
  if (!priced.lines.length) {
    body.append(
      el(
        "div",
        { class: "cart-empty" },
        el("h3", { text: "The bag is empty" }),
        el("p", { text: "Add something handmade and come back." }),
        el("button", { class: "btn primary", type: "button", "data-cart-close": "true", text: "Browse the shop" })
      )
    );
    drawer.append(body, el("div", { class: "cart-foot" }, el("div", { class: "cart-foot-note", text: "Delivery is Rs 150, free over Rs 2,500." })));
  } else {
    for (const line of priced.lines) {
      body.append(
        el(
          "div",
          { class: "cart-line" },
          el("div", { class: "cart-thumb", html: productArt(line.product) }),
          el(
            "div",
            {},
            el("div", { class: "cart-line-name", text: line.product.name }),
            el("div", { class: "cart-line-variant", text: line.variant.label }),
            el(
              "div",
              { class: "cart-line-bottom" },
              el(
                "div",
                { class: "qty-stepper sm", "aria-label": `Quantity for ${line.product.name}` },
                el("button", { type: "button", "data-cart-qty": "-1", "data-product": line.productId, "data-variant": line.variantId, "aria-label": "Decrease quantity" }, "−"),
                el("span", { text: String(line.qty) }),
                el("button", { type: "button", "data-cart-qty": "1", "data-product": line.productId, "data-variant": line.variantId, "aria-label": "Increase quantity" }, "+")
              )
            )
          ),
          el(
            "div",
            {},
            el("div", { class: "cart-line-total", text: money(line.total) }),
            el("button", { class: "cart-remove", type: "button", "data-cart-remove": "true", "data-product": line.productId, "data-variant": line.variantId, text: "Remove" })
          )
        )
      );
    }

    const promo = el("div", { class: "cart-promo" });
    if (priced.promo) {
      promo.append(
        el(
          "div",
          { class: "promo-applied" },
          el("span", {}, el("strong", { text: priced.promo.code }), ` · ${priced.promo.description}`),
          el("button", { class: "btn ghost sm", type: "button", "data-action": "remove-promo", text: "Remove" })
        )
      );
    } else {
      promo.append(
        el(
          "div",
          { class: "promo-row" },
          el("input", { class: "input", id: "promo-input", placeholder: "Promo code", "aria-label": "Promo code", autocomplete: "off", spellcheck: "false" }),
          el("button", { class: "btn", type: "button", "data-action": "apply-promo", text: "Apply" })
        ),
        el("div", { class: "promo-hint", text: priced.promoError || "Try NEW10, TEA200 or FREESHIP." })
      );
    }
    body.append(promo);

    const progress = Math.min(100, Math.round((priced.subtotal / 250000) * 100));
    body.append(
      el(
        "div",
        { class: "ship-meter" },
        el(
          "div",
          { class: "ship-label" },
          priced.shippingFree
            ? el("strong", { text: "Free delivery included" })
            : el("span", {}, `${money(priced.freeShippingRemaining)} away from free delivery`),
          el("span", { text: priced.shippingFree ? money(0) : money(priced.shipping) })
        ),
        el("div", { class: "progress orange" }, el("i", { style: `width:${priced.shippingFree ? 100 : progress}%` })),
        el("div", { class: "ship-note", text: "Free delivery starts at Rs 2,500. Flat Rs 150 below that." })
      )
    );

    body.append(el("div", { class: "cart-summary" }, ...summaryRows(priced)));
    drawer.append(body);
    drawer.append(
      el(
        "div",
        { class: "cart-foot" },
        el(
          "button",
          { class: "btn primary lg", type: "button", "data-action": "go-checkout" },
          el("span", { text: "Checkout" }),
          el("span", { html: ICONS.arrow })
        ),
        el("div", { class: "cart-foot-note", text: "Mock checkout — cash on delivery, eSewa or Khalti." })
      )
    );
  }

  root.append(el("div", { class: "cart-backdrop", "data-cart-close": "true", "aria-hidden": "true" }), drawer);
}

/* --------------------------------------------------------------- checkout -- */

function checkoutView() {
  const priced = priceCart(state.cart, CATALOG, { promoCode: state.promoCode });
  if (!priced.lines.length) {
    return el(
      "main",
      { class: "shop-main" },
      el(
        "div",
        { class: "empty-page" },
        el("h1", { text: "Your bag is empty" }),
        el("p", { text: "The checkout needs something in the bag first." }),
        el("button", { class: "btn primary", "data-nav": "#shop", text: "Back to the shop" })
      )
    );
  }

  const form = el("form", { class: "checkout-form", novalidate: true });
  const field = (name, label, inputNode, span = false) =>
    el(
      "label",
      { class: `field${span ? " span-2" : ""}`, "data-field": name },
      el("span", { text: label }),
      inputNode,
      el("span", { class: "field-error", "data-error-for": name })
    );

  const contact = el(
    "div",
    { class: "form-grid" },
    field("name", "Full name", el("input", { class: "input", name: "name", value: state.checkout.name, "data-checkout-field": "name", autocomplete: "name" })),
    field("phone", "Phone", el("input", { class: "input", name: "phone", value: state.checkout.phone, "data-checkout-field": "phone", inputmode: "tel", autocomplete: "tel" })),
    field("email", "Email (optional)", el("input", { class: "input", name: "email", type: "email", value: state.checkout.email, "data-checkout-field": "email", autocomplete: "email" }), true)
  );

  const delivery = el(
    "div",
    { class: "form-grid" },
    field("address", "Street address", el("input", { class: "input", name: "address", value: state.checkout.address, "data-checkout-field": "address", autocomplete: "street-address" }), true),
    field(
      "city",
      "City",
      el("select", { class: "select", name: "city", "data-checkout-field": "city" }, ...CITIES.map((city) => el("option", { value: city, selected: state.checkout.city === city }, city)))
    ),
    field("notes", "Delivery note (optional)", el("input", { class: "input", name: "notes", value: state.checkout.notes, "data-checkout-field": "notes", placeholder: "Landmark, floor, delivery window" }), true)
  );

  const payCards = PAYMENT_METHODS.map((method) =>
    el(
      "button",
      { class: `pay-card${state.checkout.payment === method.id ? " active" : ""}`, type: "button", "data-payment": method.id },
      el("span", { class: "pay-mark", text: method.short }),
      el("span", { class: "pay-copy" }, el("strong", { text: method.label }), el("small", { text: method.note })),
      el("span", { class: "pay-check" })
    )
  );

  form.append(
    el("div", { id: "checkout-errors", "aria-live": "polite" }),
    el("h2", { class: "panel-heading" }, el("span", { class: "step", text: "1" }), "Contact"),
    contact,
    el("h2", { class: "panel-heading" }, el("span", { class: "step", text: "2" }), "Delivery"),
    delivery,
    el("h2", { class: "panel-heading" }, el("span", { class: "step", text: "3" }), "Payment"),
    el("div", { class: "pay-list" }, ...payCards),
    el("div", { class: "checkout-note", text: "COD is collected by the courier. eSewa and Khalti are mock adapters: pressing pay runs a short fake redirect and returns a reference code. No money moves." })
  );

  const summary = el(
    "div",
    { class: "card panel-card checkout-summary" },
    el("h2", { class: "panel-heading" }, "Order summary"),
    ...priced.lines.map((line) =>
      el(
        "div",
        { class: "cart-mini-line" },
        el("div", { class: "cart-mini-thumb", html: productArt(line.product) }),
        el("div", {}, el("div", { class: "cart-mini-name", text: line.product.name }), el("div", { class: "cart-mini-meta", text: `${line.variant.label} · ×${line.qty}` })),
        el("span", { class: "cart-mini-price", text: money(line.total) })
      )
    ),
    ...summaryRows(priced),
    el(
      "button",
      { class: "btn primary lg place-order", type: "submit", "data-action": "place-order", disabled: state.processing },
      state.processing ? "Contacting the payment adapter…" : `Place order · ${money(priced.total)}`
    ),
    el("div", { class: "cart-foot-note", text: "Stock is reserved when the order is placed." })
  );

  return el(
    "main",
    { class: "shop-main" },
    breadcrumbs([{ label: "Shop", href: "#shop" }, { label: "Checkout" }]),
    el(
      "div",
      { class: "admin-head" },
      el("div", {}, el("h1", { text: "Checkout" }), el("p", { text: "Three steps, no account required. This is a seeded demo." }))
    ),
    el("div", { class: "checkout-page" }, el("div", { class: "card panel-card" }, form), summary)
  );
}

/* ----------------------------------------------------------- confirmation -- */

function confirmationView(order) {
  if (!order) {
    return el(
      "main",
      { class: "shop-main" },
      el(
        "div",
        { class: "empty-page" },
        el("h1", { text: "Order not found" }),
        el("p", { text: "That order is not in this browser's history." }),
        el("button", { class: "btn primary", "data-nav": "#shop", text: "Back to the shop" })
      )
    );
  }

  const timeline = el("ul", { class: "timeline" });
  for (const status of ["placed", "packed", "shipped", "delivered"]) {
    const entry = order.timeline.find((item) => item.status === status);
    const li = el("li", { class: entry ? "" : "pending" }, el("span", { class: "tl-dot" }));
    li.append(
      el(
        "div",
        {},
        el("span", { class: "tl-label", text: STATUS_LABELS[status] }),
        el("span", { class: "tl-time", text: entry ? A.fmt.date(entry.at, "long") : "not yet" })
      )
    );
    timeline.append(li);
  }
  if (order.status === "cancelled" || order.status === "refunded") {
    const last = order.timeline[order.timeline.length - 1];
    timeline.append(
      el(
        "li",
        {},
        el("span", { class: "tl-dot" }),
        el("div", {}, el("span", { class: "tl-label", text: STATUS_LABELS[order.status] }), el("span", { class: "tl-time", text: A.fmt.date(last.at, "long") }))
      )
    );
  }

  return el(
    "main",
    { class: "shop-main" },
    el(
      "div",
      { class: "confirm-wrap" },
      el("div", { class: "success-mark", html: ICONS.check }),
      el("h1", { text: "Order placed" }),
      el("p", { class: "confirm-sub", text: `Thanks, ${order.customer.name.split(" ")[0]}. We have your order and the stock is held for it.` }),
      el("div", { class: "order-number" }, el("span", { text: "Order" }), el("strong", { text: order.orderNumber })),
      el(
        "div",
        { class: "confirm-grid" },
        el(
          "div",
          { class: "card confirm-card" },
          el("h2", { class: "panel-heading", text: "Progress" }),
          timeline,
          el("h2", { class: "panel-heading", style: "margin-top:18px", text: "Items" }),
          el(
            "div",
            { class: "confirm-items" },
            ...order.items.map((item) =>
              el(
                "div",
                { class: "confirm-item" },
                el("span", { class: "qty", text: `×${item.qty}` }),
                el("span", { class: "name", text: item.name }),
                el("span", { class: "muted", text: item.variantLabel }),
                el("span", { class: "price", text: money(item.lineTotal) })
              )
            )
          ),
          el("div", { class: "promo-hint", text: `Delivery: ${DELIVERY_ESTIMATE}` })
        ),
        el(
          "div",
          { class: "card confirm-card" },
          el("h2", { class: "panel-heading", text: "Receipt" }),
          ...summaryRows(
            {
              subtotal: order.totals.subtotal,
              saleDiscount: order.totals.saleDiscount,
              promoDiscount: order.totals.promoDiscount,
              promo: order.promo,
              shippingFree: order.totals.shipping === 0,
              shipping: order.totals.shipping,
              total: order.totals.total,
            },
            { note: order.promo ? `${order.promo.code} · ${order.promo.description}` : "" }
          ),
          el("div", {
            class: "promo-hint",
            text: `${paymentMethod(order.payment.method).label} · ${order.payment.status === "paid" ? "paid" : "pay on delivery"}${order.payment.reference ? ` · ${order.payment.reference}` : ""}`,
          })
        )
      ),
      el(
        "div",
        { class: "confirm-actions" },
        el("button", { class: "btn primary", "data-nav": "#shop", text: "Continue shopping" }),
        el("button", { class: "btn", "data-nav": "#admin" }, el("span", { text: "Open the back office" }), el("span", { html: ICONS.arrow }))
      ),
      el("div", { class: "shop-footer", style: "margin-top:28px" }, el("span", { text: "This order was created in your browser. Nothing was charged." }))
    )
  );
}

/* ---------------------------------------------------------------- admin UI -- */

function adminSidebar() {
  const low = lowStock(state.inventory, CATALOG, 5);
  const activeOrders = state.route.tab !== "inventory";
  return el(
    "aside",
    { class: "sidebar admin-sidebar", "aria-label": "Back office navigation" },
    el(
      "a",
      { class: "brand admin-brand", href: "#admin", "data-nav": "#admin" },
      el("span", { class: "brand-mark", text: "B" }),
      el(
        "span",
        {},
        el("span", { class: "brand-word", text: "BAZAAR STORE" }),
        el("span", { class: "brand-sub", style: "display:block", text: "Back office" })
      )
    ),
    el("div", { class: "nav-label" }, "Manage"),
    el(
      "nav",
      { class: "admin-nav", "aria-label": "Manage" },
      el("a", { class: `nav-item${activeOrders ? " active" : ""}`, href: "#admin", "data-nav": "#admin" }, el("span", { class: "nav-dot" }), el("span", { text: "Orders" })),
      el("a", { class: `nav-item${state.route.tab === "inventory" ? " active" : ""}`, href: "#admin/inventory", "data-nav": "#admin/inventory" }, el("span", { class: "nav-dot" }), el("span", { text: "Inventory" }))
    ),
    el(
      "div",
      { class: "sidebar-summary" },
      el("div", { class: "label", text: "Low stock" }),
      el("div", { class: "value", text: String(low.length) }),
      el("div", { class: "sub", text: "variants at or below 5 units" })
    ),
    el(
      "div",
      { class: "sidebar-links" },
      el("a", { href: "#shop", "data-nav": "#shop" }, el("span", { text: "View storefront" }), el("span", { style: "margin-left:auto", text: "↗" })),
      el("button", { type: "button", "data-action": "reset-demo" }, el("span", { text: "Reset demo data" }))
    )
  );
}

function adminTopbar() {
  return el(
    "header",
    { class: "admin-topbar" },
    el("div", { class: "admin-crumbs" }, el("span", { text: "Bazaar Store" }), el("span", { class: "crumb-sep", text: "/" }), el("strong", { text: "Back office" })),
    el(
      "div",
      { class: "admin-mobile-nav" },
      el("a", { class: "chip", href: "#admin", "data-nav": "#admin", text: "Orders" }),
      el("a", { class: "chip", href: "#admin/inventory", "data-nav": "#admin/inventory", text: "Inventory" })
    ),
    el(
      "div",
      { class: "admin-top-actions" },
      el("span", { class: "badge", text: "Seeded demo" }),
      el("button", { class: "btn sm", "data-nav": "#shop", text: "View storefront" })
    )
  );
}

function statCard(label, value, sub, className = "") {
  return el(
    "div",
    { class: `card stat-card ${className}` },
    el("div", { class: "stat-label", text: label }),
    el("div", { class: "stat-value", text: value }),
    el("div", { class: "stat-sub", text: sub })
  );
}

function ordersPage() {
  const summary = revenueSummary(state.orders, { days: 30, now: Date.now() });
  const low = lowStock(state.inventory, CATALOG, 5);
  const orders = sortOrders(state.orders);
  const filtered = state.adminStatus === "all" ? orders : orders.filter((order) => order.status === state.adminStatus);

  const chart = A.lineChart({
    series: [{ data: summary.series.map((day) => day.revenue / 100) }],
    labels: summary.series.map((day) =>
      new Date(day.timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric" })
    ),
    height: 150,
    width: 760,
    yFormat: (value) => `Rs ${fmt.compact(value)}`,
  });

  const lowRows = low.slice(0, 3).map((row) =>
    el(
      "div",
      { class: "low-row" },
      el("div", { class: "low-name" }, el("strong", { text: row.product.name }), el("small", { text: row.variant.label })),
      el("span", { class: `low-count${row.available <= 2 ? " critical" : ""}`, text: `${row.available} left` })
    )
  );

  const select = el(
    "select",
    { class: "select", id: "order-status-filter", "aria-label": "Filter orders by status" },
    el("option", { value: "all", selected: state.adminStatus === "all" }, "All statuses"),
    ...["placed", "packed", "shipped", "delivered", "cancelled", "refunded"].map((status) =>
      el("option", { value: status, selected: state.adminStatus === status }, STATUS_LABELS[status])
    )
  );

  const bodyRows = filtered.map(orderRow);
  const ordersCard = el(
    "div",
    { class: "card orders-card" },
    el(
      "div",
      { class: "card-head-row" },
      el("h2", { text: "Orders" }),
      el("span", { class: "sub", text: "Newest first" }),
      el("span", { class: "spacer" }),
      el("span", { class: "sub", text: `${filtered.length} shown` })
    ),
    el("div", { class: "orders-toolbar" }, select, el("span", { class: "count", text: `${summary.orderCount} revenue orders · last 30 days` })),
    el(
      "div",
      { class: "table-wrap compact" },
      el(
        "table",
        { class: "table", id: "orders-table" },
        el("thead", {}, el("tr", {}, ...["Order", "Customer", "Items", "Total", "Payment", "Status", "Actions"].map((label) => el("th", { text: label })))),
        el(
          "tbody",
          {},
          ...(bodyRows.length
            ? bodyRows
            : [el("tr", {}, el("td", { colspan: "7", class: "muted", text: "No orders match this filter." }))])
        )
      )
    )
  );

  return el(
    "main",
    { class: "admin-main" },
    el(
      "div",
      { class: "admin-head" },
      el(
        "div",
        {},
        el("div", { class: "eyebrow", text: "Back office" }),
        el("h1", { text: "Orders" }),
        el("p", { text: "Move orders through packing and delivery. Stock effects follow the transition." })
      ),
      el(
        "div",
        { class: "admin-head-actions" },
        el("button", { class: "btn sm", "data-nav": "#admin/inventory", text: "Manage inventory" }),
        el("button", { class: "btn ghost sm", "data-action": "reset-demo", text: "Reset demo" })
      )
    ),
    el(
      "div",
      { class: "stat-grid" },
      statCard("Revenue · 30 days", money(summary.revenue), `${summary.orderCount} orders placed`),
      statCard("Average order", money(Math.round(summary.averageOrder / 100) * 100), "revenue-eligible orders"),
      statCard("Delivered", String(state.orders.filter((order) => order.status === "delivered").length), "orders completed"),
      statCard("Low stock", String(low.length), "variants at or below 5 units", low.length ? "warning" : "")
    ),
    el(
      "div",
      { class: "admin-grid" },
      el(
        "div",
        { class: "card chart-card" },
        el(
          "div",
          { class: "card-head-row" },
          el("h2", { text: "Revenue" }),
          el("span", { class: "sub", text: "last 30 days" }),
          el("span", { class: "spacer" }),
          el("span", { class: "chart-legend" }, el("i", {}), el("span", { text: "daily takings" }))
        ),
        el("div", { class: "revenue-chart" }, chart)
      ),
      el(
        "div",
        { class: "card low-stock-card" },
        el(
          "div",
          { class: "card-head-row" },
          el("h2", { text: "Low stock" }),
          el("span", { class: "spacer" }),
          el("span", { class: "sub", text: "≤ 5 units" })
        ),
        el("div", { class: "low-list" }, ...(lowRows.length ? lowRows : [el("div", { class: "muted small", text: "Everything is comfortably stocked." })])),
        el("button", { class: "card-link", "data-nav": "#admin/inventory", text: "Adjust inventory →" })
      )
    ),
    ordersCard
  );
}

function transitionLabel(status) {
  return {
    packed: "Pack",
    shipped: "Ship",
    delivered: "Deliver",
    cancelled: "Cancel",
    refunded: "Refund",
  }[status] || status;
}

function orderRow(order) {
  const itemCount = order.items.reduce((sum, line) => sum + line.qty, 0);
  const first = order.items[0];
  const payment = paymentMethod(order.payment.method);
  const actions = el("div", { class: "order-actions" });
  const transitions = allowedTransitions(order.status);
  if (transitions.length) {
    for (const next of transitions) {
      actions.append(
        el("button", {
          class: `btn tiny ${next === "cancelled" || next === "refunded" ? "danger" : "primary"}`,
          type: "button",
          "data-transition": next,
          "data-order": order.orderNumber,
          text: transitionLabel(next),
        })
      );
    }
  } else {
    actions.append(el("span", { class: "closed-note", text: "Closed" }));
  }

  return el(
    "tr",
    { "data-order-row": order.orderNumber },
    el(
      "td",
      {},
      el("span", { class: "order-id", text: order.orderNumber }),
      el("div", { class: "inv-variant", text: A.fmt.relative(order.createdAt) })
    ),
    el(
      "td",
      { class: "customer-cell" },
      el("strong", { text: order.customer.name }),
      el("small", { text: `${order.customer.city} · ${payment.short}` })
    ),
    el(
      "td",
      {},
      el("span", { class: "stock-num", text: String(itemCount) }),
      el("div", { class: "inv-variant", text: first ? (order.items.length > 1 ? `${first.name} +${order.items.length - 1}` : first.name) : "—" })
    ),
    el("td", {}, el("span", { class: "stock-num", text: money(order.totals.total) })),
    el("td", {}, el("span", { class: "inv-product", text: payment.short }), el("div", { class: "inv-variant", text: order.payment.status })),
    el("td", {}, el("span", { class: "status-pill", "data-status": order.status, text: STATUS_LABELS[order.status] })),
    el("td", {}, actions)
  );
}

function inventoryPage() {
  const rows = inventoryRows(state.inventory, CATALOG).sort(
    (a, b) => a.available - b.available || a.product.name.localeCompare(b.product.name)
  );
  const low = lowStock(state.inventory, CATALOG, 5);
  const totals = rows.reduce(
    (acc, row) => ({
      onHand: acc.onHand + row.onHand,
      reserved: acc.reserved + row.reserved,
      available: acc.available + row.available,
    }),
    { onHand: 0, reserved: 0, available: 0 }
  );

  const tableRows = rows.map((row) => {
    const isLow = row.available <= 5;
    return el(
      "tr",
      { "data-inventory-row": row.key },
      el("td", {}, el("div", { class: "inv-product", text: row.product.name }), el("div", { class: "inv-variant", text: row.variant.label })),
      el("td", {}, el("span", { class: "stock-num", text: money(row.variant.price) })),
      el("td", {}, el("span", { class: "stock-num", text: String(row.onHand) })),
      el("td", {}, el("span", { class: "stock-num", text: String(row.reserved) })),
      el("td", {}, el("span", { class: `stock-num${isLow ? (row.available === 0 ? " out" : " low") : ""}`, text: String(row.available) })),
      el(
        "td",
        {},
        el(
          "div",
          { class: "adjust-group" },
          el(
            "button",
            {
              class: "btn tiny",
              type: "button",
              "data-adjust": row.key,
              "data-delta": "-1",
              "aria-label": `Remove one ${row.product.name} ${row.variant.label}`,
              disabled: row.available <= 0,
            },
            "−"
          ),
          el("button", { class: "btn tiny", type: "button", "data-adjust": row.key, "data-delta": "1", "aria-label": `Add one ${row.product.name} ${row.variant.label}` }, "+"),
          el("button", { class: "btn tiny", type: "button", "data-adjust": row.key, "data-delta": "5", "aria-label": `Restock five ${row.product.name} ${row.variant.label}` }, "+5")
        )
      )
    );
  });

  return el(
    "main",
    { class: "admin-main" },
    el(
      "div",
      { class: "admin-head" },
      el(
        "div",
        {},
        el("div", { class: "eyebrow", text: "Back office" }),
        el("h1", { text: "Inventory" }),
        el("p", { text: "On-hand and reserved stock for every variant. Reserved units belong to open orders." })
      ),
      el(
        "div",
        { class: "admin-head-actions" },
        el("button", { class: "btn sm", "data-nav": "#admin", text: "Back to orders" }),
        el("button", { class: "btn ghost sm", "data-action": "reset-demo", text: "Reset demo" })
      )
    ),
    el(
      "div",
      { class: "stat-grid" },
      statCard("On hand", String(totals.onHand), "units across all variants"),
      statCard("Reserved", String(totals.reserved), "held for open orders"),
      statCard("Available", String(totals.available), "on hand minus reserved"),
      statCard("Low stock", String(low.length), "variants at or below 5 units", low.length ? "warning" : "")
    ),
    low.length
      ? el("div", { class: "inventory-note", text: `${plural(low.length, "variant")} need attention. Low-stock rows are listed first; use +5 to restock in one go.` })
      : null,
    el(
      "div",
      { class: "card inventory-card" },
      el(
        "div",
        { class: "inventory-head" },
        el("h2", { class: "panel-heading", style: "margin:0", text: "Variants" }),
        el("span", { class: "sub muted small", text: "Adjustments cannot cut into reserved units." })
      ),
      el(
        "div",
        { class: "table-wrap" },
        el(
          "table",
          { class: "table inventory-table" },
          el("thead", {}, el("tr", {}, ...["Product", "Price", "On hand", "Reserved", "Available", "Adjust"].map((label) => el("th", { text: label })))),
          el("tbody", {}, ...tableRows)
        )
      )
    )
  );
}

/* ------------------------------------------------------------------ render -- */

function renderShop() {
  const route = state.route;
  let view;
  if (route.name === "product") {
    const product = findProduct(CATALOG, route.productId);
    view = product ? productView(product) : shopView();
  } else if (route.name === "checkout") {
    view = checkoutView();
  } else if (route.name === "confirmation") {
    view = confirmationView(orderById(route.orderId) || orderById(state.lastOrderId));
  } else {
    view = shopView();
  }
  return el("div", { class: "storefront" }, topbar(), view);
}

function renderAdmin() {
  return el(
    "div",
    { class: "app shell admin-shell" },
    adminSidebar(),
    el("div", { class: "admin-workspace" }, adminTopbar(), state.route.tab === "inventory" ? inventoryPage() : ordersPage())
  );
}

function render() {
  const app = $("#app");
  if (state.route.name === "admin") state.cartOpen = false;
  app.replaceChildren(state.route.name === "admin" ? renderAdmin() : renderShop());
  renderOverlay();
  document.body.classList.toggle("cart-open", state.cartOpen && state.route.name !== "admin");
}

/* --------------------------------------------------------------- actions -- */

function quickAdd(product) {
  const selected = selectedVariantId(product);
  const variant =
    findVariant(product, selected) ||
    product.variants.find((item) => availableStock(state.inventory, variantKey(product.id, item.id)) > 0);
  if (!variant) {
    toast("That product is sold out", "error");
    return;
  }
  const available = availableStock(state.inventory, variantKey(product.id, variant.id));
  const result = addLine(state.cart, product.id, variant.id, 1, available);
  if (!result.ok) {
    toast(result.reason === "limit" ? "That is the most this line can hold" : "That variant just sold out", "error");
    return;
  }
  state.variantSelection[product.id] = variant.id;
  state.cartOpen = true;
  persistSoon();
  render();
  toast(`${product.name} added to the bag`, "success", 1600);
}

function addSelectedToCart(product) {
  const variantId = selectedVariantId(product);
  const variant = findVariant(product, variantId);
  if (!variant) return;
  const qty = Math.max(1, state.detailQty[product.id] || 1);
  const available = availableStock(state.inventory, variantKey(product.id, variantId));
  const result = addLine(state.cart, product.id, variantId, qty, available);
  if (!result.ok) {
    toast(result.reason === "limit" ? "That is the most this line can hold" : "That variant just sold out", "error");
    return;
  }
  state.cartOpen = true;
  persistSoon();
  render();
  toast(`${qty} × ${product.name} added`, "success", 1600);
}

function applyPromoCode(codeFromInput) {
  const input = $("#promo-input");
  const code = String(codeFromInput ?? input?.value ?? "").trim();
  if (!code) return;
  const priced = priceCart(state.cart, CATALOG, { promoCode: null });
  const check = validatePromo(code, priced.subtotal);
  if (!check.ok) {
    toast(check.reason, "error", 2800);
    return;
  }
  state.promoCode = check.promo.code;
  persistSoon();
  render();
  toast(`${check.promo.code} applied`, "success", 1600);
}

function removePromoCode() {
  state.promoCode = null;
  persistSoon();
  render();
  toast("Promo removed", "info", 1400);
}

function validateCheckout() {
  const errors = {};
  const { name, phone, email, address } = state.checkout;
  if (!name.trim()) errors.name = "Add a name for the delivery.";
  if (!phone.trim() || phone.replace(/\D/g, "").length < 7) errors.phone = "A phone number is needed for the courier.";
  if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) errors.email = "That email address does not look right.";
  if (!address.trim()) errors.address = "A street address is required.";
  return errors;
}

function paintCheckoutErrors(errors) {
  for (const field of document.querySelectorAll("[data-field]")) {
    const name = field.dataset.field;
    field.classList.toggle("invalid", Boolean(errors[name]));
    const target = field.querySelector(`[data-error-for="${name}"]`);
    if (target) target.textContent = errors[name] || "";
  }
}

async function placeOrder() {
  if (state.processing) return;
  const errors = validateCheckout();
  if (Object.keys(errors).length) {
    paintCheckoutErrors(errors);
    toast("Check the highlighted fields", "error", 2200);
    return;
  }

  const priced = priceCart(state.cart, CATALOG, { promoCode: state.promoCode });
  if (!priced.lines.length) {
    toast("Your bag is empty", "error");
    return;
  }
  const issues = stockIssues(state.cart, state.inventory);
  if (issues.length) {
    toast("One of those items sold out while you were checking out", "error", 3000);
    render();
    return;
  }

  state.processing = true;
  render();
  await new Promise((resolve) => setTimeout(resolve, 650));

  const result = createOrder({
    items: toOrderItems(priced),
    customer: { ...state.checkout },
    payment: state.checkout.payment,
    totals: priced,
    inventory: state.inventory,
    now: Date.now(),
    orderNumber: nextOrderNumber(state.orders),
  });

  state.processing = false;
  if (!result.ok) {
    toast(result.message || "Could not place the order", "error", 2800);
    render();
    return;
  }

  state.orders.push(result.order);
  state.lastOrderId = result.order.orderNumber;
  state.cart = emptyCart();
  state.promoCode = null;
  state.cartOpen = false;
  persistNow();
  toast("Order placed", "success", 1800);
  window.location.hash = `#confirmation/${result.order.orderNumber}`;
}

function transitionOrderAction(orderNumber, to) {
  const order = orderById(orderNumber);
  if (!order) return;
  const result = transitionOrder(order, to, state.inventory, { now: Date.now() });
  if (!result.ok) {
    toast(result.message || "That transition is not allowed", "error", 2600);
    return;
  }
  persistNow();
  render();
  toast(`${order.orderNumber} · ${STATUS_LABELS[to]}`, "success", 1600);
}

function adjustStock(key, delta) {
  const result = adjust(state.inventory, key, Number(delta));
  if (!result.ok) {
    toast(
      result.reason === "reserved"
        ? `Only ${result.maxDecrease} can be removed — the rest is reserved for open orders.`
        : "That adjustment is not possible",
      "error",
      2800
    );
    return;
  }
  persistNow();
  render();
  const row = inventoryRows(state.inventory, CATALOG).find((item) => item.key === key);
  toast(`${row ? row.product.name : "Stock"} · ${row ? row.available : ""} available`, "success", 1500);
}

function resetDemo() {
  if (state.processing) return;
  try {
    storage?.removeItem(STORAGE_KEY);
  } catch {
    /* storage can be unavailable; the in-memory reset still works */
  }
  const seeded = seedShop();
  state.inventory = seeded.inventory;
  state.orders = seeded.orders;
  state.cart = emptyCart();
  state.promoCode = null;
  state.cartOpen = false;
  state.lastOrderId = null;
  state.checkout = { ...DEFAULT_CHECKOUT };
  state.filter = { category: "All", query: "", sort: "featured" };
  persistNow();
  render();
  toast("Demo data reset", "success", 1600);
}

/* ---------------------------------------------------------------- events -- */

document.addEventListener("click", (event) => {
  const target = event.target;

  const nav = target.closest("[data-nav]");
  if (nav) {
    event.preventDefault();
    navigate(nav.dataset.nav);
    return;
  }

  if (target.closest("[data-cart-open]")) {
    state.cartOpen = true;
    renderOverlay();
    document.body.classList.add("cart-open");
    return;
  }

  if (target.closest("[data-cart-close]")) {
    state.cartOpen = false;
    renderOverlay();
    document.body.classList.remove("cart-open");
    return;
  }

  if (target.closest("[data-scroll]")) {
    scrollToGrid();
    return;
  }

  const addQuick = target.closest("[data-add-product]");
  if (addQuick) {
    event.stopPropagation();
    const product = findProduct(CATALOG, addQuick.dataset.addProduct);
    if (product) quickAdd(product);
    return;
  }

  const category = target.closest("[data-category]");
  if (category) {
    setCategory(category.dataset.category);
    return;
  }

  const action = target.closest("[data-action]");
  if (action) {
    const type = action.dataset.action;
    if (type === "apply-promo") {
      applyPromoCode();
      return;
    }
    if (type === "remove-promo") {
      removePromoCode();
      return;
    }
    if (type === "go-checkout") {
      state.cartOpen = false;
      document.body.classList.remove("cart-open");
      navigate("#checkout");
      return;
    }
    if (type === "add-to-cart") {
      const product = findProduct(CATALOG, action.dataset.product);
      if (product) addSelectedToCart(product);
      return;
    }
    if (type === "place-order") {
      event.preventDefault();
      placeOrder();
      return;
    }
    if (type === "reset-demo") {
      resetDemo();
      return;
    }
  }

  const cartQty = target.closest("[data-cart-qty]");
  if (cartQty) {
    const productId = cartQty.dataset.product;
    const variantId = cartQty.dataset.variant;
    const available = availableStock(state.inventory, variantKey(productId, variantId));
    const line = findLine(state.cart, productId, variantId);
    if (!line) return;
    if (Number(cartQty.dataset.cartQty) > 0) {
      const result = changeLineQty(state.cart, productId, variantId, 1, available);
      if (!result.ok) toast(`Only ${available} available`, "error", 1600);
    } else {
      changeLineQty(state.cart, productId, variantId, -1, available);
    }
    persistSoon();
    render();
    return;
  }

  const remove = target.closest("[data-cart-remove]");
  if (remove) {
    removeLine(state.cart, remove.dataset.product, remove.dataset.variant);
    persistSoon();
    render();
    return;
  }

  const productLink = target.closest("[data-product]");
  if (productLink) {
    navigateToProduct(productLink.dataset.product);
    return;
  }

  const variant = target.closest("[data-variant]");
  if (variant) {
    state.variantSelection[variant.dataset.variantProduct] = variant.dataset.variant;
    state.detailQty[variant.dataset.variantProduct] = 1;
    render();
    return;
  }

  const detailQty = target.closest("[data-detail-qty]");
  if (detailQty) {
    const product = findProduct(CATALOG, detailQty.dataset.qtyProduct);
    if (!product) return;
    const variantId = selectedVariantId(product);
    const available = availableStock(state.inventory, variantKey(product.id, variantId));
    const next = (state.detailQty[product.id] || 1) + Number(detailQty.dataset.detailQty);
    state.detailQty[product.id] = Math.max(1, Math.min(next, Math.min(10, available)));
    render();
    return;
  }

  const payment = target.closest("[data-payment]");
  if (payment) {
    state.checkout.payment = payment.dataset.payment;
    render();
    return;
  }

  const transition = target.closest("[data-transition]");
  if (transition) {
    transitionOrderAction(transition.dataset.order, transition.dataset.transition);
    return;
  }

  const adjustButton = target.closest("[data-adjust]");
  if (adjustButton) {
    adjustStock(adjustButton.dataset.adjust, adjustButton.dataset.delta);
  }
});

document.addEventListener("submit", (event) => {
  if (event.target.closest(".checkout-form")) {
    event.preventDefault();
    placeOrder();
  }
});

document.addEventListener("input", (event) => {
  const target = event.target;
  if (target.id === "shop-search") {
    state.filter.query = target.value;
    renderShopResults();
    return;
  }
  if (target.dataset.checkoutField) {
    state.checkout[target.dataset.checkoutField] = target.value;
    const field = target.closest("[data-field]");
    if (field) {
      field.classList.remove("invalid");
      const error = field.querySelector(".field-error");
      if (error) error.textContent = "";
    }
  }
});

document.addEventListener("change", (event) => {
  const target = event.target;
  if (target.dataset.checkoutField) {
    state.checkout[target.dataset.checkoutField] = target.value;
  }
  if (target.id === "sort-select") {
    state.filter.sort = target.value;
    renderShopResults();
    return;
  }
  if (target.id === "order-status-filter") {
    state.adminStatus = target.value;
    render();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && state.cartOpen) {
    state.cartOpen = false;
    renderOverlay();
    document.body.classList.remove("cart-open");
  }
});

/* --------------------------------------------------------------- startup -- */

function installAutomationAPI() {
  window.bazaar = {
    state: () => ({
      route: state.route,
      cart: cartCount(state.cart),
      promo: state.promoCode,
      orders: state.orders.length,
      lowStock: lowStock(state.inventory, CATALOG, 5).length,
      processing: state.processing,
    }),
    openProduct(id) {
      navigate(`#product/${id}`);
    },
    selectVariant(productId, variantId) {
      state.variantSelection[productId] = variantId;
      render();
    },
    setDetailQty(productId, qty) {
      const product = findProduct(CATALOG, productId);
      if (!product) return;
      const variantId = selectedVariantId(product);
      const available = availableStock(state.inventory, variantKey(productId, variantId));
      state.detailQty[productId] = Math.max(1, Math.min(Number(qty) || 1, Math.min(10, available)));
      render();
    },
    addToCart() {
      const product = findProduct(CATALOG, state.route.productId);
      if (product) addSelectedToCart(product);
      return Boolean(product);
    },
    openCart() {
      state.cartOpen = true;
      render();
    },
    applyPromo(code) {
      applyPromoCode(code);
    },
    checkout() {
      state.cartOpen = false;
      navigate("#checkout");
    },
    setPayment(method) {
      state.checkout.payment = method;
      render();
    },
    placeOrder: () => placeOrder(),
    goAdmin(tab = "orders") {
      navigate(tab === "inventory" ? "#admin/inventory" : "#admin");
    },
    latestOrder: () => sortOrders(state.orders)[0]?.orderNumber || null,
    advanceLatest(to) {
      const order = sortOrders(state.orders)[0];
      if (!order) return false;
      transitionOrderAction(order.orderNumber, to);
      return true;
    },
    reset: resetDemo,
  };
}

function start() {
  loadShop();
  state.route = parseRoute();
  installAutomationAPI();
  render();
}

start();
