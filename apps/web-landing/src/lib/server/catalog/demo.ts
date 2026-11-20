import { type CatalogListQuery, type CatalogProduct, type CatalogSort, type CatalogSource } from "@/api/catalog";
import { catalogCategories, products } from "../../../data/catalog";
import { platforms } from "../../../data/solutions";

/**
 * DEMO CATALOG SOURCE — sample products from `src/data/catalog.ts`, used when
 * WEB_DATA_SOURCE=demo (the development default). Labelled as sample data in the UI.
 * Implements the same `CatalogSource` contract as the ERP adapter.
 */

const terms = (q: string) => q.toLowerCase().split(/\s+/).filter(Boolean);

function matches(product: CatalogProduct, query: CatalogListQuery): boolean {
  if (query.q) {
    const haystack = `${product.name} ${product.specs} ${product.category}`.toLowerCase();
    if (!terms(query.q).every((term) => haystack.includes(term))) return false;
  }
  if (query.categories.length && !query.categories.includes(product.categorySlug)) return false;
  if (query.availability.length && !query.availability.includes(product.stock)) return false;
  if (query.applications.length && !query.applications.some((a) => product.applications.includes(a))) return false;
  if (product.price !== null) {
    if (query.minPrice !== null && product.price < query.minPrice) return false;
    if (query.maxPrice !== null && product.price > query.maxPrice) return false;
  }
  return true;
}

const sorters: Record<CatalogSort, (a: CatalogProduct, b: CatalogProduct) => number> = {
  popular: (a, b) => a.popularity - b.popularity,
  newest: (a, b) => b.listedAt.localeCompare(a.listedAt),
  "price-asc": (a, b) => (a.price ?? Number.MAX_SAFE_INTEGER) - (b.price ?? Number.MAX_SAFE_INTEGER),
  "price-desc": (a, b) => (b.price ?? -1) - (a.price ?? -1),
};

const categoryCounts = () => {
  const counts: Record<string, number> = {};
  for (const p of products) counts[p.categorySlug] = (counts[p.categorySlug] ?? 0) + 1;
  return counts;
};

const solutions = () => platforms.map((p) => ({ slug: p.slug, name: p.name, description: p.description, tags: p.tags }));

export const demoCatalogSource: CatalogSource = {
  async listProducts(query) {
    const filtered = products.filter((p) => matches(p, query)).sort(sorters[query.sort]);
    const totalPages = Math.ceil(filtered.length / query.limit);
    const page = Math.min(query.page, Math.max(1, totalPages));
    return {
      items: filtered.slice((page - 1) * query.limit, page * query.limit),
      pagination: { page, limit: query.limit, total: filtered.length, totalPages },
    };
  },
  async getProduct(slug) {
    return products.find((p) => p.slug === slug) ?? null;
  },
  async listCategories() {
    const counts = categoryCounts();
    return catalogCategories.map((c) => ({ slug: c.slug, name: c.name, productCount: counts[c.slug] ?? 0 }));
  },
  async getFacets() {
    const availability: Record<string, number> = {};
    for (const p of products) availability[p.stock] = (availability[p.stock] ?? 0) + 1;
    return { total: products.length, categories: categoryCounts(), availability };
  },
  async getStock(slugs) {
    return products.filter((p) => slugs.includes(p.slug)).map((p) => ({ slug: p.slug, status: p.stock }));
  },
  async getPricing(slugs) {
    return products.filter((p) => slugs.includes(p.slug)).map((p) => ({ slug: p.slug, price: p.price, currency: "IDR" as const }));
  },
  async listSolutions() {
    return solutions();
  },
  async search(q, limit) {
    const t = terms(q);
    const hit = (...fields: string[]) => t.length > 0 && t.every((term) => fields.join(" ").toLowerCase().includes(term));
    const counts = categoryCounts();
    return {
      products: products
        .filter((p) => hit(p.name, p.category, p.specs))
        .sort((a, b) => a.popularity - b.popularity)
        .slice(0, limit)
        .map(({ slug, name, category, price, image }) => ({ slug, name, category, price, image })),
      categories: catalogCategories
        .filter((c) => hit(c.name, c.chipLabel))
        .slice(0, limit)
        .map((c) => ({ slug: c.slug, name: c.name, productCount: counts[c.slug] ?? 0 })),
      solutions: solutions()
        .filter((s) => hit(s.name, s.description, s.tags.join(" ")))
        .slice(0, limit),
    };
  },
  async priceCart(lines) {
    const priced = lines.map((line) => {
      const product = products.find((p) => p.slug === line.productSlug);
      const unitPrice = product?.price ?? null;
      return {
        productSlug: line.productSlug,
        quantity: line.quantity,
        unitPrice,
        lineTotal: (unitPrice ?? 0) * line.quantity,
        available: Boolean(product && product.stock !== "out"),
      };
    });
    return { lines: priced, subtotal: priced.reduce((sum, l) => sum + l.lineTotal, 0) };
  },
};
