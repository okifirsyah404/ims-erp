// @ts-check
import { defineConfig, envField } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';

import node from '@astrojs/node';

// `astro dev` serves http://localhost, where a Secure cookie would be dropped by some browsers.
const isDevServer = Boolean(/** @type {any} */ (globalThis).process?.argv?.includes("dev"));

// https://astro.build/config
export default defineConfig({
  site: "https://entragate.com",

  adapter: node({
    mode: "standalone",
  }),

  env: {
    schema: {
      ERP_API_BASE_URL: envField.string({
        context: "server",
        access: "secret",
        optional: true,
      }),
      ERP_API_TOKEN: envField.string({
        context: "server",
        access: "secret",
        optional: true,
      }),
      // "demo" accepts form submissions locally and serves sample tracking data; "erp" uses
      // the ERP (routes in src/lib/server/website/erp-routes.ts). Defaults to demo in development.
      WEB_DATA_SOURCE: envField.enum({ context: "server", access: "secret", values: ["demo", "erp"], optional: true }),
      ERP_API_TIMEOUT_MS: envField.number({ context: "server", access: "secret", optional: true, int: true, min: 1000, max: 60000 }),
      ERP_RESPONSE_ENVELOPE: envField.enum({ context: "server", access: "secret", values: ["none", "data"], optional: true }),
      // International format without "+", e.g. 6281280002020 (09.02 Contact).
      PUBLIC_WHATSAPP_NUMBER: envField.string({ context: "client", access: "public", default: "6281280002020" }),
      // Optional override of the RFQ route (default /projects/public/v1/rfq in website/routes.ts).
      ERP_RFQ_PATH: envField.string({
        context: "server",
        access: "secret",
        optional: true,
      }),
      // Origins of this site and the Customer Portal. Unset = local dev servers in
      // development (4321 / 4322) and the live domains in production (src/lib/urls.ts).
      PUBLIC_WEB_URL: envField.string({ context: "client", access: "public", optional: true }),
      PUBLIC_CUSTOMER_URL: envField.string({ context: "client", access: "public", optional: true }),
      // Server-to-server URL of the portal for the sign-in hand-off (defaults to PUBLIC_CUSTOMER_URL).
      CUSTOMER_INTERNAL_URL: envField.string({ context: "server", access: "secret", optional: true }),
      // Shared secret for the portal sign-in hand-off; must match the portal's WEB_HANDOFF_SECRET.
      WEB_HANDOFF_SECRET: envField.string({ context: "server", access: "secret", optional: true }),
    },
  },

  // Checkout sessions (customer identity from the portal hand-off) — server-side store,
  // only an opaque httpOnly cookie in the browser. Named apart from the portal's
  // `eg_session`, because localhost cookies are shared across ports.
  session: {
    cookie: { name: "eg_web_session", sameSite: "lax", secure: !isDevServer },
    ttl: 60 * 60 * 8,
  },

  security: { checkOrigin: true },

  vite: {
    plugins: [tailwindcss()],
  },

  server: {
    port: 4321,
  },
});
