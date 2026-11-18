import { createErpCatalogSource, type CatalogRoutes, type CatalogSource } from "@/api/catalog";
import { ERP_API_BASE_URL, ERP_API_TIMEOUT_MS, ERP_API_TOKEN, ERP_RESPONSE_ENVELOPE } from "astro:env/server";
import { websiteMode } from "../website";
import { demoCatalogSource } from "./demo";

/**
 * ERP catalog endpoints, relative to ERP_API_BASE_URL. Intentionally empty until the ERP
 * team publishes them (the ERP repository is not modified from here). Unmapped operations
 * raise CatalogNotConfiguredError, which the catalog and search show as "unavailable".
 *
 * Example:
 *   listProducts: "/public/catalog/products",
 *   getProduct: "/public/catalog/products/:slug",
 *   search: "/public/catalog/search",
 */
export const catalogRoutes: CatalogRoutes = {};

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
