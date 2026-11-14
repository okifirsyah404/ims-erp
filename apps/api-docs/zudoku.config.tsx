import type { ZudokuConfig } from "zudoku";

/**
 * API reference for the website repo (`entragate-platform`): the customer portal
 * (`/portal/v1`) and the public website forms (`/public/v1`); and the license API
 * (`/licensing/v1`) for the company's own applications (M03). The OpenAPI files
 * are curated by hand; `apps/backend/test/unit/api-docs-drift.test.ts` fails when
 * they no longer match the mounted routes.
 */
const config: ZudokuConfig = {
  site: {
    title: "Entragate ERP API",
  },
  navigation: [
    {
      type: "category",
      label: "Guide",
      items: ["introduction", "authentication", "conventions", "website-setup"],
    },
    { type: "link", to: "api", label: "API Reference" },
    {
      type: "category",
      label: "Own applications",
      items: ["licensing-integration", { type: "link", to: "licensing-api", label: "License API Reference" }],
    },
  ],
  redirects: [{ from: "/", to: "/introduction" }],
  apis: [
    {
      type: "file",
      input: "./openapi/website.yaml",
      path: "/api",
    },
    {
      type: "file",
      input: "./openapi/licensing.yaml",
      path: "/licensing-api",
    },
  ],
  docs: {
    files: "/pages/**/*.{md,mdx}",
  },
};

export default config;
