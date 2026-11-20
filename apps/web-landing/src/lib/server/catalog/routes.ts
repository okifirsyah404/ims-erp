import type { CatalogRoutes } from "@/api/catalog";

/**
 * ERP public catalog endpoints, relative to ERP_API_BASE_URL (backend:
 * `apps/backend/src/app/inventory/controllers/public-catalog.controller.ts`).
 * Server-to-server with the website API key (`Authorization: Bearer ewk_…`).
 * Money is whole rupiah and bodies are wrapped as `{ data }`.
 */
export const catalogRoutes: CatalogRoutes = {
  listProducts: "/inventory/public/v1/catalog/products",
  getProduct: "/inventory/public/v1/catalog/products/:slug",
  listCategories: "/inventory/public/v1/catalog/categories",
  getFacets: "/inventory/public/v1/catalog/facets",
  getStock: "/inventory/public/v1/catalog/stock",
  getPricing: "/inventory/public/v1/catalog/pricing",
  listSolutions: "/inventory/public/v1/catalog/solutions",
  search: "/inventory/public/v1/catalog/search",
  priceCart: "/inventory/public/v1/catalog/cart/price",
};
