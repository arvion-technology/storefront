import test from "node:test";
import assert from "node:assert/strict";

import {
  CATALOG,
  categories,
  defaultVariant,
  filterCatalog,
  findProduct,
  findVariant,
  highestPrice,
  isOnSale,
  listVariants,
  lowestPrice,
  priceRange,
  salePercent,
  searchProducts,
  sortProducts,
  variantKey,
  variantOf,
} from "../src/catalog.js";

test("lookup by product, variant and composite key", () => {
  const mug = findProduct(CATALOG, "ceramic-mug");
  assert.equal(mug.name, "Bhaktapur Ceramic Mug");
  assert.equal(findVariant(mug, "ash").label, "Ash");
  assert.equal(findProduct(CATALOG, "nope"), null);
  assert.equal(findVariant(mug, "nope"), null);

  const found = variantOf(CATALOG, "ceramic-mug", "ash");
  assert.equal(found.key, variantKey("ceramic-mug", "ash"));
  assert.equal(found.variant.price, 125000);
  assert.equal(variantOf(CATALOG, "ceramic-mug", "nope"), null);
});

test("search looks through names, tags and categories", () => {
  assert.deepEqual(searchProducts(CATALOG, "tea").map((product) => product.id), ["tea-ilam", "coffee-mustang"]);
  assert.deepEqual(searchProducts(CATALOG, "ilam").map((product) => product.id), ["tea-ilam"]);
  assert.deepEqual(searchProducts(CATALOG, "lokta").map((product) => product.id), ["paper-notebook", "paper-cards"]);
  assert.equal(searchProducts(CATALOG, "CERAMIC").length, 2);
  assert.equal(searchProducts(CATALOG, "").length, CATALOG.length);
  assert.deepEqual(searchProducts(CATALOG, "sold out thing"), []);
});

test("filtering combines category, query and sort", () => {
  const ceramics = filterCatalog(CATALOG, { category: "Ceramics" });
  assert.deepEqual(ceramics.map((product) => product.id), ["ceramic-mug", "ceramic-vase"]);

  const cheapFirst = filterCatalog(CATALOG, { category: "Ceramics", sort: "price-asc" });
  assert.deepEqual(cheapFirst.map((product) => product.id), ["ceramic-mug", "ceramic-vase"]);

  const searched = filterCatalog(CATALOG, { query: "paper", sort: "name" });
  assert.deepEqual(searched.map((product) => product.id), ["paper-cards", "paper-notebook"]);

  const featured = sortProducts(CATALOG, "featured");
  assert.equal(featured[0].featured, true);
});

test("price helpers read the variants", () => {
  const tea = findProduct(CATALOG, "tea-ilam");
  assert.equal(lowestPrice(tea), 85000);
  assert.equal(highestPrice(tea), 190000);
  assert.deepEqual(priceRange(tea), { low: 85000, high: 190000, single: false });
  assert.deepEqual(priceRange(findProduct(CATALOG, "home-jug")), { low: 390000, high: 390000, single: true });

  const first = defaultVariant(tea);
  assert.equal(first.id, "100g");
  assert.equal(isOnSale(first), true);
  assert.equal(salePercent(first), 14);
  assert.equal(isOnSale(findVariant(tea, "250g")), true);
  assert.equal(isOnSale(findVariant(findProduct(CATALOG, "home-jug"), "1.2l")), false);
});

test("categories and variant listing stay in sync with the catalogue", () => {
  assert.equal(categories()[0], "All");
  assert.ok(categories().includes("Pantry"));
  const variants = listVariants();
  assert.equal(variants.length, CATALOG.reduce((sum, product) => sum + product.variants.length, 0));
  assert.ok(variants.every((row) => row.product.id && row.variant.id && row.key.includes(":")));
});
