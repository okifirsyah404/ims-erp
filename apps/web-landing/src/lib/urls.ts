import { PUBLIC_CUSTOMER_URL, PUBLIC_WEB_URL } from "astro:env/client";

/**
 * Origins of the two apps. Set PUBLIC_WEB_URL / PUBLIC_CUSTOMER_URL per environment;
 * without them development uses the local dev servers (web 4321, portal 4322) and
 * production uses the live domains. MODE (not DEV): the preview tooling may run
 * `astro dev` with NODE_ENV=production.
 */
const isDevelopment = import.meta.env.MODE === "development";

const origin = (value: string | undefined, devFallback: string, prodFallback: string) =>
  (value?.trim() || (isDevelopment ? devFallback : prodFallback)).replace(/\/+$/, "");

export const webUrl = origin(PUBLIC_WEB_URL, "http://localhost:4321", "https://entragate.com");
export const customerUrl = origin(PUBLIC_CUSTOMER_URL, "http://localhost:4322", "https://customer.entragate.com");

/** Same-site, path-only destinations the website may return to after signing in. */
const RETURN_PATHS = ["/checkout", "/cart", "/quote"];

export function safeReturnPath(value: string | null | undefined, fallback = "/checkout"): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return fallback;
  const path = value.split(/[?#]/)[0]!;
  return RETURN_PATHS.some((p) => path === p || path.startsWith(`${p}/`)) ? value.slice(0, 300) : fallback;
}
