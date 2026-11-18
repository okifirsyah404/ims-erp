import { createErpWebsiteSource, type WebsiteSource } from "@ims-erp/api-client";
import { ERP_API_BASE_URL, ERP_API_TIMEOUT_MS, ERP_API_TOKEN, ERP_RESPONSE_ENVELOPE, WEB_DATA_SOURCE } from "astro:env/server";
import { demoWebsiteSource } from "./demo";
import { erpRoutes } from "./erp-routes";

// MODE (not DEV): the preview tooling may run `astro dev` with NODE_ENV=production.
export const websiteMode: "demo" | "erp" = WEB_DATA_SOURCE ?? (import.meta.env.MODE === "development" ? "demo" : "erp");

function createSource(): WebsiteSource {
  if (websiteMode === "demo") return demoWebsiteSource;
  if (!ERP_API_BASE_URL) throw new Error("WEB_DATA_SOURCE=erp requires ERP_API_BASE_URL.");
  return createErpWebsiteSource({
    baseUrl: ERP_API_BASE_URL,
    token: ERP_API_TOKEN,
    routes: erpRoutes,
    timeoutMs: ERP_API_TIMEOUT_MS,
    unwrap: ERP_RESPONSE_ENVELOPE === "data" ? (body) => (body as { data?: unknown } | undefined)?.data : undefined,
    defaultHeaders: { "X-Client": "entragate-website" },
  });
}

/** Created on first use so builds don't need ERP secrets. */
let source: WebsiteSource | undefined;
export const website: WebsiteSource = new Proxy({} as WebsiteSource, {
  get: (_target, key) => Reflect.get((source ??= createSource()), key),
});
