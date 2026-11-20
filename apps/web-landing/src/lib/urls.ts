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

/**
 * Where the website may return after signing in or out: any same-site path (the page the
 * visitor was on), never another origin and never the sign-in routes themselves.
 */
export function safeReturnPath(value: string | null | undefined, fallback = "/"): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return fallback;
  const path = value.split(/[?#]/)[0]!;
  if (path === "/auth" || path.startsWith("/auth/") || path.startsWith("/_actions")) return fallback;
  return value.slice(0, 300);
}
