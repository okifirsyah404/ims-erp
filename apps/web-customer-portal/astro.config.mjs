import { defineConfig, envField } from "astro/config";
import node from "@astrojs/node";
import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";
import AstroPWA from "@vite-pwa/astro";

// `astro dev` (even when launched with NODE_ENV=production) serves plain http on localhost.
const isDevServer = process.argv.includes("dev");

export default defineConfig({
  site: "https://customer.entragate.com",

  output: "server",

  adapter: node({
    mode: "standalone",
  }),

  // Server-side sessions: only an opaque id travels in the cookie; user + ERP tokens
  // stay on the server. Swap the driver (e.g. Redis) when running multiple instances.
  session: {
    cookie: {
      name: "eg_session",
      sameSite: "lax",
      secure: !isDevServer,
    },
    ttl: 60 * 60 * 24 * 30,
  },

  security: {
    checkOrigin: true,
    // Trust X-Forwarded-Host only for the production host (reverse proxy / CDN).
    allowedDomains: [{ hostname: "customer.entragate.com", protocol: "https" }],
    // Support tickets accept up to 5 photos/videos of 25 MB each (08.02).
    actionBodySizeLimit: 5 * 25 * 1024 * 1024 + 1024 * 1024,
  },

  env: {
    schema: {
      // External NestJS ERP API root, e.g. https://erp.entragate.com/api/v1 (server-side only;
      // the browser never talks to the ERP). Route paths live in src/lib/server/portal/erp-routes.ts.
      ERP_API_BASE_URL: envField.string({ context: "server", access: "secret", optional: true, url: true }),
      ERP_API_TIMEOUT_MS: envField.number({ context: "server", access: "secret", optional: true, int: true, min: 1000, max: 60000 }),
      // "data" when the ERP wraps success bodies as { data: … } (common NestJS interceptor).
      ERP_RESPONSE_ENVELOPE: envField.enum({ context: "server", access: "secret", values: ["none", "data"], optional: true }),
      // Extra origins allowed to serve images (CSP img-src), comma separated, e.g. https://files.entragate.com.
      ERP_ASSET_ORIGINS: envField.string({ context: "server", access: "secret", optional: true }),
      // "demo" serves the design's fixture data; "erp" talks to the ERP. Defaults to
      // demo in development and erp in production (see src/lib/server/portal/index.ts).
      PORTAL_DATA_SOURCE: envField.enum({ context: "server", access: "secret", values: ["demo", "erp"], optional: true }),
      // Public website origin. Unset = http://localhost:4321 in development, https://entragate.com in production (src/lib/urls.ts).
      PUBLIC_WEB_URL: envField.string({ context: "client", access: "public", optional: true }),
      // Shared secret for the website sign-in hand-off (/api/connect/token); must match the website's WEB_HANDOFF_SECRET.
      WEB_HANDOFF_SECRET: envField.string({ context: "server", access: "secret", optional: true }),
      // International format without "+", e.g. 6281234567890. The WhatsApp channel is disabled when unset.
      PUBLIC_SUPPORT_WHATSAPP: envField.string({ context: "client", access: "public", optional: true }),
      // Support hotline for the call button on ticket conversations, e.g. +622150001234.
      PUBLIC_SUPPORT_PHONE: envField.string({ context: "client", access: "public", optional: true }),
    },
  },

  integrations: [
    react(),

    AstroPWA({
      // A waiting service worker only takes over when the user accepts the update prompt
      // (src/components/app/PwaStatus.astro), so in-progress forms are never reloaded away.
      registerType: "prompt",
      injectRegister: false,

      manifest: {
        id: "/",
        name: "Entragate Customer Portal",
        short_name: "Entragate",
        description: "Track orders, approve quotations, pay invoices and get support from Entragate.",
        lang: "en",
        dir: "ltr",
        start_url: "/",
        scope: "/",
        display: "standalone",
        display_override: ["standalone", "minimal-ui"],
        orientation: "portrait",
        categories: ["business", "productivity"],
        background_color: "#0A1A3F",
        theme_color: "#0A1A3F",
        prefer_related_applications: false,
        launch_handler: { client_mode: ["navigate-existing", "auto"] },
        icons: [
          { src: "/icons/pwa-64.png", sizes: "64x64", type: "image/png", purpose: "any" },
          { src: "/icons/pwa-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "/icons/pwa-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "/icons/pwa-maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
          { src: "/icons/pwa-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
        shortcuts: [
          { name: "Orders", url: "/orders", icons: [{ src: "/icons/pwa-192.png", sizes: "192x192", type: "image/png" }] },
          { name: "Live tracking", short_name: "Tracking", url: "/tracking", icons: [{ src: "/icons/pwa-192.png", sizes: "192x192", type: "image/png" }] },
          { name: "New support ticket", short_name: "New ticket", url: "/support/new", icons: [{ src: "/icons/pwa-192.png", sizes: "192x192", type: "image/png" }] },
          { name: "Invoices & payments", short_name: "Payments", url: "/payments", icons: [{ src: "/icons/pwa-192.png", sizes: "192x192", type: "image/png" }] },
        ],
        screenshots: [
          { src: "/screenshots/welcome.png", sizes: "780x1688", type: "image/png", form_factor: "narrow", label: "Welcome to the Entragate Customer Portal" },
          { src: "/screenshots/home.png", sizes: "780x1688", type: "image/png", form_factor: "narrow", label: "Orders, projects and support at a glance" },
        ],
      },

      workbox: {
        // Precache only the static, user-agnostic shell: hashed build assets, icons and the
        // prerendered offline page (precached as "/offline"). Fonts: Latin subsets only.
        globPatterns: ["_astro/**/*.{js,css}", "_astro/**/*-latin-*.woff2", "icons/*.png", "favicon.{svg,ico}", "offline/index.html"],
        globIgnores: ["**/*-ext-*.woff2"],
        dontCacheBustURLsMatching: /^_astro\//,
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        // Portal pages are personalised SSR responses: never serve them from a cache. All
        // navigations go to the network; only when that fails is the offline page shown.
        navigateFallback: null,
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.mode === "navigate",
            handler: "NetworkOnly",
            options: { precacheFallback: { fallbackURL: "/offline" } },
          },
        ],
      },

      devOptions: { enabled: false },
    }),
  ],

  vite: {
    plugins: [tailwindcss()],
  },

  server: {
    port: 4322,
  },
});
