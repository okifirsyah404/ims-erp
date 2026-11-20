import { createErpCatalogSource, type CatalogSource } from "@/api/catalog";
import { ERP_API_BASE_URL, ERP_API_TIMEOUT_MS, ERP_API_TOKEN, ERP_RESPONSE_ENVELOPE } from "astro:env/server";
import { unwrapEnvelope } from "../envelope";
import { websiteMode } from "../website";
import { demoCatalogSource } from "./demo";
import { catalogRoutes } from "./routes";

// ERP catalog endpoints live in ./routes (unmapped operations raise
// CatalogNotConfiguredError, which the catalog and search show as "unavailable").
export { catalogRoutes };

function createSource(): CatalogSource {
  if (websiteMode === "demo") return demoCatalogSource;
  if (!ERP_API_BASE_URL) throw new Error("WEB_DATA_SOURCE=erp requires ERP_API_BASE_URL.");
  return createErpCatalogSource({
    baseUrl: ERP_API_BASE_URL,
    token: ERP_API_TOKEN,
    routes: catalogRoutes,
    timeoutMs: ERP_API_TIMEOUT_MS,
    // The ERP always wraps success bodies as { data }; "none" opts out.
    unwrap: ERP_RESPONSE_ENVELOPE === "none" ? undefined : unwrapEnvelope,
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
