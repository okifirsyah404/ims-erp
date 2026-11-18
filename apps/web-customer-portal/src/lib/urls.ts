import { PUBLIC_WEB_URL } from "astro:env/client";

/**
 * Public website origin. PUBLIC_WEB_URL per environment; without it development uses the
 * local web dev server (4321) and production https://entragate.com. MODE (not DEV): the
 * preview tooling may run `astro dev` with NODE_ENV=production.
 */
export const webUrl = (PUBLIC_WEB_URL?.trim() || (import.meta.env.MODE === "development" ? "http://localhost:4321" : "https://entragate.com")).replace(/\/+$/, "");
