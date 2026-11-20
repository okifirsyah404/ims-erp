import type { CatalogRoutes } from "@/api/catalog";

/**
 * ERP public catalog endpoints, relative to ERP_API_BASE_URL (backend:
 * `apps/backend/src/app/product/controllers/public-catalog.controller.ts`, ADR-0026).
 * Server-to-server with the website API key (`Authorization: Bearer ewk_…`).
 * Money is whole rupiah and bodies are wrapped as `{ data }`.
 */
export const catalogRoutes: CatalogRoutes = {
  listProducts: "/products/public/v1/catalog/products",
  getProduct: "/products/public/v1/catalog/products/:slug",
  listCategories: "/products/public/v1/catalog/categories",
  getFacets: "/products/public/v1/catalog/facets",
  getStock: "/products/public/v1/catalog/stock",
  getPricing: "/products/public/v1/catalog/pricing",
  listSolutions: "/products/public/v1/catalog/solutions",
  search: "/products/public/v1/catalog/search",
  priceCart: "/products/public/v1/catalog/cart/price",
};
