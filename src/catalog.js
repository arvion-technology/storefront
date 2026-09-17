/**
 * The seeded catalogue. Prices are paisa. `stock` is the starting on-hand
 * count; the running inventory lives in src/inventory.js so the back office can
 * adjust it without rewriting the catalogue.
 *
 * The art field is a key the demo uses to draw an inline SVG scene. There are
 * no image files and no remote assets.
 */

export const CATEGORIES = [
  "Coffee & tea",
  "Ceramics",
  "Textiles",
  "Stationery",
  "Pantry",
  "Home",
];

export const CATALOG = [
  {
    id: "tea-ilam",
    name: "Ilam Golden Tips",
    category: "Coffee & tea",
    blurb: "Hand-rolled spring leaves from Ilam, bright and floral.",
    description:
      "Picked in the first weeks of the spring flush and rolled by hand, these leaves brew light and honeyed with a long finish. A second steep is worth the wait.",
    art: "tea",
    tones: ["#f9e5c6", "#b15f1c"],
    tags: ["tea", "black tea", "loose leaf", "ilam"],
    materials: "Black tea leaves, eastern Nepal",
    care: "Store sealed, away from light and strong spices.",
    featured: true,
    variants: [
      { id: "100g", label: "100 g", price: 85000, compareAt: 99000, stock: 26 },
      { id: "250g", label: "250 g", price: 190000, compareAt: 215000, stock: 14 },
    ],
  },
  {
    id: "coffee-mustang",
    name: "Mustang Roast",
    category: "Coffee & tea",
    blurb: "A medium roast with cocoa and dried fruit, ground to order.",
    description:
      "Beans grown in the high valleys and roasted in small batches in Kathmandu. Cocoa up front, dried fruit at the end, forgiving in a moka pot.",
    art: "coffee",
    tones: ["#ecd9c2", "#6c4325"],
    tags: ["coffee", "beans", "medium roast", "mustang"],
    materials: "Arabica beans, Mustang",
    care: "Keep the bag closed and use within six weeks.",
    variants: [
      { id: "200g", label: "200 g", price: 95000, stock: 20 },
      { id: "500g", label: "500 g", price: 210000, stock: 8 },
    ],
  },
  {
    id: "ceramic-mug",
    name: "Bhaktapur Ceramic Mug",
    category: "Ceramics",
    blurb: "Thrown in Bhaktapur, glazed by hand. Holds 300 ml.",
    description:
      "A generous daily mug with a thumb-sized handle. Each glaze fires slightly differently, so two mugs from the same batch still have their own face.",
    art: "mug",
    tones: ["#f5ded0", "#ad4f34"],
    tags: ["mug", "ceramic", "handmade", "bhaktapur"],
    materials: "Stoneware clay, food-safe glaze",
    care: "Dishwasher safe; avoid sudden temperature changes.",
    featured: true,
    variants: [
      { id: "rust", label: "Rust", price: 125000, compareAt: 140000, stock: 14 },
      { id: "ash", label: "Ash", price: 125000, compareAt: 140000, stock: 9 },
      { id: "indigo", label: "Indigo", price: 135000, stock: 3 },
    ],
  },
  {
    id: "ceramic-vase",
    name: "Thimi Studio Vase",
    category: "Ceramics",
    blurb: "A quiet, heavy-base vase for branches and single stems.",
    description:
      "Thrown in Thimi and left partly unglazed at the foot. The narrow neck holds a branch without fuss; the wide body works on its own too.",
    art: "vase",
    tones: ["#e9e3cf", "#68754f"],
    tags: ["vase", "ceramic", "thimi", "home"],
    materials: "Stoneware, matte glaze",
    care: "Hand wash; the base is unglazed and will darken with water.",
    variants: [
      { id: "small", label: "Small · 18 cm", price: 220000, stock: 6 },
      { id: "tall", label: "Tall · 26 cm", price: 340000, stock: 3 },
    ],
  },
  {
    id: "textile-throw",
    name: "Palpasa Cotton Throw",
    category: "Textiles",
    blurb: "Handloom cotton, woven in two colourways, 130 × 180 cm.",
    description:
      "A light throw for the end of the bed or the back of a chair. Woven on a handloom in Palpa; the stripes run across the width, not the length.",
    art: "throw",
    tones: ["#f2e2d0", "#9f5b3b"],
    tags: ["throw", "cotton", "handloom", "palpa", "textile"],
    materials: "100% cotton, handloom woven",
    care: "Cold machine wash, line dry in shade.",
    featured: true,
    variants: [
      { id: "rust", label: "Rust stripe", price: 480000, stock: 7 },
      { id: "indigo", label: "Indigo stripe", price: 480000, stock: 4 },
    ],
  },
  {
    id: "textile-scarf",
    name: "Dhaka Weave Scarf",
    category: "Textiles",
    blurb: "Fine Dhaka weave with a short fringe, light enough for summer.",
    description:
      "The pattern is set on a traditional pit loom, so the reverse is as neat as the front. Narrow, long, and softens after the first wash.",
    art: "scarf",
    tones: ["#f0e5cd", "#a9442a"],
    tags: ["scarf", "dhaka", "weave", "textile"],
    materials: "Cotton and acrylic blend",
    care: "Hand wash cold, dry flat.",
    variants: [
      { id: "crimson", label: "Crimson", price: 265000, stock: 12 },
      { id: "natural", label: "Natural", price: 265000, stock: 8 },
    ],
  },
  {
    id: "paper-notebook",
    name: "Lokta Notebook",
    category: "Stationery",
    blurb: "Lokta paper, sewn spine, lies flat on the desk.",
    description:
      "Made from the bark of the lokta bush, which regrows after harvesting. The paper takes ink without bleeding and has a faint, uneven tooth.",
    art: "notebook",
    tones: ["#f1e8d6", "#84643c"],
    tags: ["notebook", "lokta", "paper", "stationery"],
    materials: "Lokta paper, cotton thread binding",
    care: "Keep dry; the cover softens with handling.",
    featured: true,
    variants: [
      { id: "a5", label: "A5 · dot grid", price: 48000, stock: 40 },
      { id: "a4", label: "A4 · ruled", price: 65000, stock: 22 },
    ],
  },
  {
    id: "paper-cards",
    name: "Blockprint Cards",
    category: "Stationery",
    blurb: "Six or twelve letterpress-style cards with envelopes.",
    description:
      "Printed from a carved wooden block in Patan. The registration is slightly off on every card, which is the point. Blank inside.",
    art: "cards",
    tones: ["#f7e9d9", "#ad6430"],
    tags: ["cards", "paper", "blockprint", "stationery"],
    materials: "Lokta card, cotton envelopes",
    care: "Store flat and dry.",
    variants: [
      { id: "six", label: "Pack of 6", price: 60000, stock: 18 },
      { id: "twelve", label: "Pack of 12", price: 105000, stock: 10 },
    ],
  },
  {
    id: "pantry-rice",
    name: "Jumla Red Rice",
    category: "Pantry",
    blurb: "Nutty red rice from Jumla, milled lightly and cooked like brown rice.",
    description:
      "Grown at altitude without much fuss. It takes longer to cook than white rice and rewards the wait with a firm, nutty grain that holds up in a salad.",
    art: "rice",
    tones: ["#f2e4d0", "#8a3f2c"],
    tags: ["rice", "red rice", "jumla", "pantry"],
    materials: "Red rice, Jumla",
    care: "Store in a sealed jar; soak for 30 minutes before cooking.",
    variants: [
      { id: "1kg", label: "1 kg", price: 42000, stock: 32 },
      { id: "5kg", label: "5 kg", price: 190000, stock: 11 },
    ],
  },
  {
    id: "pantry-pepper",
    name: "Timur Pepper",
    category: "Pantry",
    blurb: "Sichuan-style timur, citrus-sharp and numbing.",
    description:
      "Hand-picked and dried on the branch. Use it crushed over potatoes, in pickles, or anywhere you want a bright, tingling edge.",
    art: "pepper",
    tones: ["#efe0c6", "#7a4822"],
    tags: ["timur", "pepper", "spice", "pantry"],
    materials: "Dried timur berries",
    care: "Whole berries keep their aroma longer than ground.",
    variants: [
      { id: "50g", label: "50 g", price: 38000, stock: 36 },
      { id: "200g", label: "200 g", price: 110000, stock: 16 },
    ],
  },
  {
    id: "home-candle",
    name: "Beeswax Candle",
    category: "Home",
    blurb: "Pure beeswax, cotton wick, roughly 30 hours of light.",
    description:
      "Poured in small batches. Beeswax burns slower and warmer than paraffin; the honey smell fades after the first hour and leaves the room neutral.",
    art: "candle",
    tones: ["#f9e9ce", "#c28628"],
    tags: ["candle", "beeswax", "home"],
    materials: "Beeswax, cotton wick",
    care: "Trim the wick to 5 mm before each burn.",
    variants: [
      { id: "lokta-cedar", label: "Lokta & cedar", price: 90000, stock: 22 },
      { id: "plain", label: "Plain beeswax", price: 80000, stock: 6 },
    ],
  },
  {
    id: "home-jug",
    name: "Copper Water Jug",
    category: "Home",
    blurb: "Hand-raised copper, 1.2 litres, with a snug lid.",
    description:
      "Made by a coppersmith in Patan. It is heavier than it looks and the spout pours cleanly; the inside will patina with use, which is normal.",
    art: "jug",
    tones: ["#f1dfd0", "#9e5229"],
    tags: ["copper", "jug", "water", "home"],
    materials: "Hand-raised copper, food-safe lining",
    care: "Rinse and dry immediately; polish the outside if you like it bright.",
    variants: [{ id: "1.2l", label: "1.2 litre", price: 390000, stock: 4 }],
  },
];

const byId = new Map(CATALOG.map((product) => [product.id, product]));

export function variantKey(productId, variantId) {
  return `${productId}:${variantId}`;
}

export function findProduct(catalog, id) {
  if (catalog === CATALOG) return byId.get(id) || null;
  return catalog.find((product) => product.id === id) || null;
}

export function findVariant(product, variantId) {
  if (!product) return null;
  return product.variants.find((variant) => variant.id === variantId) || null;
}

export function variantOf(catalog, productId, variantId) {
  const product = findProduct(catalog, productId);
  const variant = findVariant(product, variantId);
  if (!product || !variant) return null;
  return { product, variant, key: variantKey(productId, variantId) };
}

/** Every product/variant pair, for inventory screens and stock tests. */
export function listVariants(catalog = CATALOG) {
  const rows = [];
  for (const product of catalog) {
    for (const variant of product.variants) {
      rows.push({ product, variant, key: variantKey(product.id, variant.id) });
    }
  }
  return rows;
}

export function searchProducts(catalog, query) {
  const needle = String(query || "").trim().toLowerCase();
  if (!needle) return catalog;
  const tokens = needle.split(/\s+/);
  return catalog.filter((product) => {
    const haystack = `${product.name} ${product.category} ${product.blurb} ${product.description} ${product.materials} ${product.tags.join(" ")}`.toLowerCase();
    return tokens.every((token) => haystack.includes(token));
  });
}

export function sortProducts(products, sort = "featured") {
  const sorted = [...products];
  switch (sort) {
    case "price-asc":
      return sorted.sort((a, b) => lowestPrice(a) - lowestPrice(b));
    case "price-desc":
      return sorted.sort((a, b) => lowestPrice(b) - lowestPrice(a));
    case "name":
      return sorted.sort((a, b) => a.name.localeCompare(b.name));
    default:
      return sorted.sort((a, b) => Number(Boolean(b.featured)) - Number(Boolean(a.featured)));
  }
}

export function filterCatalog(catalog, { category = "All", query = "", sort = "featured" } = {}) {
  const searched = searchProducts(catalog, query);
  const filtered = category && category !== "All" ? searched.filter((product) => product.category === category) : searched;
  return sortProducts(filtered, sort);
}

export function lowestPrice(product) {
  return Math.min(...product.variants.map((variant) => variant.price));
}

export function highestPrice(product) {
  return Math.max(...product.variants.map((variant) => variant.price));
}

export function priceRange(product) {
  const low = lowestPrice(product);
  const high = highestPrice(product);
  return low === high ? { low, high, single: true } : { low, high, single: false };
}

export function isOnSale(variant) {
  return Boolean(variant.compareAt && variant.compareAt > variant.price);
}

export function salePercent(variant) {
  if (!isOnSale(variant)) return 0;
  return Math.round(((variant.compareAt - variant.price) / variant.compareAt) * 100);
}

export function defaultVariant(product) {
  if (!product) return null;
  return product.variants[0] || null;
}

export function categories(catalog = CATALOG) {
  return ["All", ...CATEGORIES.filter((category) => catalog.some((product) => product.category === category))];
}
