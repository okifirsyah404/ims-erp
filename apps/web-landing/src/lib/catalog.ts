import {
  availabilityOptions,
  catalogCategories,
  priceBounds,
  productDetails,
  products,
  sortOptions,
} from "../data/catalog";
import type { TPaginationMeta } from "@ims-erp/common";
import type { ProductDetail, ProductSummary, StockStatus } from "../types/catalog";
import { templateDetail } from "../data/product-details";
import { catalogSource } from "./server/catalog";

/**
 * Catalog query layer. Pages call these functions only, so the local sample can be
 * replaced by ERP-backed implementations without touching components.
 */

export type SortValue = (typeof sortOptions)[number]["value"];

export type CatalogQuery = {
  q: string;
  categories: string[];
  availability: StockStatus[];
  applications: string[];
  minPrice: number | null;
  maxPrice: number | null;
  sort: SortValue;
  page: number;
};

export const PAGE_SIZE = 9;

const categorySlugs = new Set(catalogCategories.map((c) => c.slug));
const availabilityValues = new Set<string>(availabilityOptions.map((a) => a.value));
const sortValues = new Set<string>(sortOptions.map((s) => s.value));

function toInt(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number.parseInt(value.replace(/\D/g, ""), 10);
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseCatalogQuery(params: URLSearchParams): CatalogQuery {
  const sort = params.get("sort") ?? "popular";
  return {
    q: (params.get("q") ?? "").trim().slice(0, 100),
    categories: params.getAll("category").filter((c) => categorySlugs.has(c)),
    availability: params.getAll("availability").filter((a): a is StockStatus => availabilityValues.has(a)),
    applications: params.getAll("application"),
    minPrice: toInt(params.get("min")),
    maxPrice: toInt(params.get("max")),
    sort: (sortValues.has(sort) ? sort : "popular") as SortValue,
    page: Math.max(1, toInt(params.get("page")) ?? 1),
  };
}

/** Serialises a query back to a URL, applying `patch` (use `null` to remove a key). */
export function catalogHref(query: CatalogQuery, patch: Partial<Record<keyof CatalogQuery, unknown>> = {}): string {
  const next = { ...query, page: 1, ...patch } as CatalogQuery;
  const params = new URLSearchParams();
  if (next.q) params.set("q", next.q);
  next.categories.forEach((c) => params.append("category", c));
  next.availability.forEach((a) => params.append("availability", a));
  next.applications.forEach((a) => params.append("application", a));
  if (next.minPrice !== null) params.set("min", String(next.minPrice));
  if (next.maxPrice !== null) params.set("max", String(next.maxPrice));
  if (next.sort !== "popular") params.set("sort", next.sort);
  if (next.page > 1) params.set("page", String(next.page));
  const search = params.toString();
  return `/products${search ? `?${search}` : ""}`;
}

export type CatalogResult = {
  items: ProductSummary[];
  pagination: TPaginationMeta;
};

/** One page of catalog results from the configured source (sample data or ERP). */
export async function listProducts(query: CatalogQuery): Promise<CatalogResult> {
  return catalogSource.listProducts({ ...query, limit: PAGE_SIZE });
}

const stockLabels: Record<StockStatus, string> = {
  ready: "Ready Stock",
  preorder: "Pre-Order · 3–4 weeks",
  request: "Project pricing",
  out: "Out of Stock",
};

export async function getProduct(slug: string): Promise<{ summary: ProductSummary; detail?: ProductDetail } | null> {
  const summary = products.find((p) => p.slug === slug);
  if (!summary) return null;
  const related = products
    .filter((p) => p.slug !== slug)
    .sort((a, b) => Number(b.categorySlug === summary.categorySlug) - Number(a.categorySlug === summary.categorySlug) || a.popularity - b.popularity)
    .slice(0, 4)
    .map((p) => p.slug);
  return { summary, detail: productDetails[slug] ?? templateDetail(summary, stockLabels[summary.stock], related) };
}

export async function getProductsBySlugs(slugs: string[]): Promise<ProductSummary[]> {
  return slugs.map((slug) => products.find((p) => p.slug === slug)).filter((p) => p !== undefined);
}

/** Related products: curated list when available, otherwise same-category then popular. */
export async function getRelatedProducts(product: ProductSummary, curated: string[] = [], limit = 4) {
  if (curated.length) return getProductsBySlugs(curated);
  return products
    .filter((p) => p.slug !== product.slug)
    .sort((a, b) => Number(b.categorySlug === product.categorySlug) - Number(a.categorySlug === product.categorySlug) || a.popularity - b.popularity)
    .slice(0, limit);
}

/** Minimal product data the cart & checkout render in the browser (prices are re-checked on the server). */
export type ClientProduct = Pick<ProductSummary, "slug" | "name" | "category" | "specs" | "price" | "stock" | "image">;

export async function getClientCatalog(): Promise<ClientProduct[]> {
  return products.map(({ slug, name, category, specs, price, stock, image }) => ({ slug, name, category, specs, price, stock, image }));
}

export type CatalogFacets = {
  total: number;
  categories: Record<string, number>;
  availability: Record<string, number>;
};

/** Catalog-wide counts for the hero copy and filter lists. */
export async function getCatalogFacets(): Promise<CatalogFacets> {
  return catalogSource.getFacets();
}

export { catalogCategories, availabilityOptions, priceBounds, sortOptions };
