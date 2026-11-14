import type { ZudokuConfig } from "zudoku";

/**
 * API reference for the website repo (`entragate-platform`): the customer portal
 * (`/portal/v1`) and the public website forms (`/public/v1`). The OpenAPI file is
 * curated by hand; `apps/backend/test/unit/api-docs-drift.test.ts` fails when it no
 * longer matches the mounted routes.
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
  ],
  redirects: [{ from: "/", to: "/introduction" }],
  apis: {
    type: "file",
    input: "./openapi/website.yaml",
    path: "/api",
  },
  docs: {
    files: "/pages/**/*.{md,mdx}",
  },
};

export default config;
