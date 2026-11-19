import { createErpCatalogSource, type CatalogRoutes, type CatalogSource } from "@/api/catalog";
import { ERP_API_BASE_URL, ERP_API_TIMEOUT_MS, ERP_API_TOKEN, ERP_RESPONSE_ENVELOPE } from "astro:env/server";
import { websiteMode } from "../website";
import { demoCatalogSource } from "./demo";

/**
 * ERP catalog endpoints, relative to ERP_API_BASE_URL (`/public/v1/catalog`, authenticated
 * with the website API key `ERP_API_TOKEN`). Unmapped operations raise
 * CatalogNotConfiguredError, which the catalog and search show as "unavailable".
 */
export const catalogRoutes: CatalogRoutes = {
  listProducts: "/public/v1/catalog/products",
  getProduct: "/public/v1/catalog/products/:slug",
  listCategories: "/public/v1/catalog/categories",
  getFacets: "/public/v1/catalog/facets",
  getStock: "/public/v1/catalog/stock",
  getPricing: "/public/v1/catalog/pricing",
  listSolutions: "/public/v1/catalog/solutions",
  search: "/public/v1/catalog/search",
  priceCart: "/public/v1/catalog/cart/price",
};

function createSource(): CatalogSource {
  if (websiteMode === "demo") return demoCatalogSource;
  if (!ERP_API_BASE_URL) throw new Error("WEB_DATA_SOURCE=erp requires ERP_API_BASE_URL.");
  return createErpCatalogSource({
    baseUrl: ERP_API_BASE_URL,
    token: ERP_API_TOKEN,
    routes: catalogRoutes,
    timeoutMs: ERP_API_TIMEOUT_MS,
    unwrap: ERP_RESPONSE_ENVELOPE === "data" ? (body) => (body as { data?: unknown } | undefined)?.data : undefined,
    defaultHeaders: { "X-Client": "entragate-website" },
  });
}

/** `true` while catalog data comes from the labelled sample (demo mode). */
export const catalogIsSample = websiteMode === "demo";

let source: CatalogSource | undefined;
/** Lazy so builds and prerendered pages don't need ERP secrets. */
export const catalogSource: CatalogSource = new Proxy({} as CatalogSource, {
  get: (_target, key) => Reflect.get((source ??= createSource()), key),
});
