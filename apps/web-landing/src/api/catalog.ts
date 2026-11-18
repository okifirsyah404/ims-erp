import { z } from "zod";
import { ApiError, createApiClient, type ApiClientOptions } from "./client";
import type { Money } from "./money";
import { parseOrThrow } from "./contract-schemas";

/**
 * Public catalog contract (apps/web-landing): products, categories, stock, pricing, software
 * solutions, search and server-side cart pricing. Read-only, served with the website's
 * service token. Paths come from `CatalogRoutes` once the ERP team publishes them —
 * nothing is hard-coded here, and unmapped operations throw CatalogNotConfiguredError.
 */

export type CatalogStockStatus = "ready" | "preorder" | "request" | "out";
export type CatalogSort = "popular" | "newest" | "price-asc" | "price-desc";

/** Card-level product as rendered by the catalog, search and cart. */
export type CatalogProduct = {
  slug: string;
  name: string;
  categorySlug: string;
  category: string;
  shortCategory: string;
  specs: string;
  stock: CatalogStockStatus;
  priceCaption: string;
  /** IDR list price; `null` = project pricing (RFQ). */
  price: Money | null;
  rating: number;
  applications: string[];
  popularity: number;
  listedAt: string;
  image?: string;
};

export type CatalogListQuery = {
  q: string;
  categories: string[];
  availability: CatalogStockStatus[];
  applications: string[];
  minPrice: number | null;
  maxPrice: number | null;
  sort: CatalogSort;
  page: number;
  pageSize: number;
};

export type CatalogPage = { items: CatalogProduct[]; total: number; page: number; pageCount: number };

export type CatalogCategoryInfo = { slug: string; name: string; productCount: number };

export type CatalogFacetCounts = { total: number; categories: Record<string, number>; availability: Record<string, number> };

export type StockLevel = { slug: string; status: CatalogStockStatus; quantity?: number; leadTimeLabel?: string };

export type PriceQuote = { slug: string; price: Money | null; currency: "IDR"; tiers?: { minQuantity: number; price: Money }[] };

export type SoftwareSolutionInfo = { slug: string; name: string; description: string; tags: string[] };

export type CatalogSearchResult = {
  products: Pick<CatalogProduct, "slug" | "name" | "category" | "price" | "image">[];
  categories: CatalogCategoryInfo[];
  solutions: SoftwareSolutionInfo[];
};

export type CartLineInput = { productSlug: string; quantity: number; options?: Record<string, string> };
export type PricedCart = {
  lines: { productSlug: string; quantity: number; unitPrice: Money | null; lineTotal: Money; available: boolean }[];
  subtotal: Money;
};

export interface CatalogSource {
  listProducts(query: CatalogListQuery): Promise<CatalogPage>;
  getProduct(slug: string): Promise<CatalogProduct | null>;
  listCategories(): Promise<CatalogCategoryInfo[]>;
  getFacets(): Promise<CatalogFacetCounts>;
  getStock(slugs: string[]): Promise<StockLevel[]>;
  getPricing(slugs: string[]): Promise<PriceQuote[]>;
  listSolutions(): Promise<SoftwareSolutionInfo[]>;
  search(q: string, limit: number): Promise<CatalogSearchResult>;
  priceCart(lines: CartLineInput[]): Promise<PricedCart>;
}

export type CatalogRoutes = Partial<Record<keyof CatalogSource, string>>;

export class CatalogNotConfiguredError extends Error {
  constructor(operation: string) {
    super(`ERP route for "${operation}" is not configured.`);
    this.name = "CatalogNotConfiguredError";
  }
}

const productSchema = z.object({
  slug: z.string().min(1).max(120),
  name: z.string().max(200),
  categorySlug: z.string().max(120),
  category: z.string().max(120),
  shortCategory: z.string().max(120),
  specs: z.string().max(400),
  stock: z.enum(["ready", "preorder", "request", "out"]),
  priceCaption: z.string().max(120),
  price: z.number().nonnegative().nullable(),
  rating: z.number().min(0).max(5),
  applications: z.array(z.string().max(80)),
  popularity: z.number(),
  listedAt: z.string().max(40),
  // Rendered in <img src>; only https or root-relative paths are accepted.
  image: z
    .string()
    .max(2000)
    .refine((v) => v.startsWith("/") ? !v.startsWith("//") : v.startsWith("https://"), "image must be https or root-relative")
    .optional(),
}) satisfies z.ZodType<CatalogProduct>;

const pageSchema = z.object({
  items: z.array(productSchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  pageCount: z.number().int().positive(),
}) satisfies z.ZodType<CatalogPage>;

export type ErpCatalogConfig = {
  baseUrl: string;
  routes: CatalogRoutes;
  token?: string;
  fetcher?: typeof fetch;
} & Pick<ApiClientOptions, "timeoutMs" | "retries" | "unwrap" | "defaultHeaders">;

export function createErpCatalogSource(config: ErpCatalogConfig): CatalogSource {
  const base = new URL(config.baseUrl);
  if (base.protocol !== "https:" && !["localhost", "127.0.0.1"].includes(base.hostname)) {
    throw new Error("ERP base URL must use https.");
  }
  for (const [op, template] of Object.entries(config.routes)) {
    if (template && (!template.startsWith("/") || template.startsWith("//") || template.includes("://") || template.includes(".."))) {
      throw new Error(`ERP route "${op}" must be a relative path starting with "/".`);
    }
  }
  const client = createApiClient({
    baseUrl: config.baseUrl,
    token: config.token,
    fetcher: config.fetcher,
    timeoutMs: config.timeoutMs,
    retries: config.retries,
    unwrap: config.unwrap,
    defaultHeaders: config.defaultHeaders,
  });
  const path = (op: keyof CatalogSource, params: Record<string, string> = {}) => {
    const template = config.routes[op];
    if (!template) throw new CatalogNotConfiguredError(op);
    return template.replace(/:(\w+)/g, (_, key: string) => encodeURIComponent(params[key] ?? ""));
  };

  return {
    async listProducts(query) {
      const body = await client.get(path("listProducts"), {
        query: {
          q: query.q || undefined,
          category: query.categories,
          availability: query.availability,
          application: query.applications,
          min: query.minPrice,
          max: query.maxPrice,
          sort: query.sort,
          page: query.page,
          pageSize: query.pageSize,
        },
      });
      return parseOrThrow("listProducts", pageSchema, body);
    },
    async getProduct(slug) {
      try {
        return parseOrThrow("getProduct", productSchema, await client.get(path("getProduct", { slug })));
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) return null;
        throw error;
      }
    },
    listCategories: () => client.get(path("listCategories")),
    getFacets: () => client.get(path("getFacets")),
    getStock: (slugs) => client.get(path("getStock"), { query: { slug: slugs } }),
    getPricing: (slugs) => client.get(path("getPricing"), { query: { slug: slugs } }),
    listSolutions: () => client.get(path("listSolutions")),
    search: (q, limit) => client.get(path("search"), { query: { q, limit } }),
    priceCart: (lines) => client.post(path("priceCart"), { lines }),
  };
}
