import { ApiError } from "@/api/client";
import { createErpPortalSource, type PortalSource } from "@/api/portal";
import {
  ERP_API_BASE_URL,
  ERP_API_TIMEOUT_MS,
  ERP_RESPONSE_ENVELOPE,
  PORTAL_DATA_SOURCE,
} from "astro:env/server";
import { SessionExpiredError } from "../errors";
import { demoSource } from "./demo";
import { erpRoutes } from "./erp-routes";

// MODE (not DEV): the preview tooling may run `astro dev` with NODE_ENV=production.
export const portalMode: "demo" | "erp" = PORTAL_DATA_SOURCE ?? (import.meta.env.MODE === "development" ? "demo" : "erp");

/** Operations that run before a session exists; a 401 there is a normal auth result. */
const SESSIONLESS: ReadonlySet<keyof PortalSource> = new Set([
  "login",
  "register",
  "verifyEmail",
  "resendVerification",
  "requestPasswordReset",
  "resetPassword",
  "refreshSession",
  "lookupPublicOrder",
  "logout",
]);

/** Turns ERP 401s on authenticated calls into SessionExpiredError (handled by the middleware). */
function withSessionExpiry(source: PortalSource): PortalSource {
  return new Proxy(source, {
    get(target, key, receiver) {
      const value = Reflect.get(target, key, receiver);
      if (typeof value !== "function" || SESSIONLESS.has(key as keyof PortalSource)) return value;
      return async (...args: unknown[]) => {
        try {
          return await value.apply(target, args);
        } catch (error) {
          if (error instanceof ApiError && error.status === 401) throw new SessionExpiredError();
          throw error;
        }
      };
    },
  });
}

function createSource(): PortalSource {
  if (portalMode === "demo") return demoSource;
  if (!ERP_API_BASE_URL) {
    throw new Error("PORTAL_DATA_SOURCE=erp requires ERP_API_BASE_URL.");
  }
  return withSessionExpiry(
    createErpPortalSource({
      baseUrl: ERP_API_BASE_URL,
      routes: erpRoutes,
      timeoutMs: ERP_API_TIMEOUT_MS,
      unwrap: ERP_RESPONSE_ENVELOPE === "data" ? (body) => (body as { data?: unknown } | undefined)?.data : undefined,
      defaultHeaders: { "X-Client": "entragate-customer-portal" },
    }),
  );
}

/**
 * Created on first use rather than at import, so builds (which prerender /offline) don't
 * need production secrets. A missing ERP configuration surfaces on the first request.
 */
let source: PortalSource | undefined;
export const portal: PortalSource = new Proxy({} as PortalSource, {
  get: (_target, key) => Reflect.get((source ??= createSource()), key),
});

/**
 * Whether an operation can reach the ERP: always in demo mode; in ERP mode only when
 * erp-routes.ts maps it (the ERP ships the portal in stages).
 */
export function isConnected(operation: keyof PortalSource): boolean {
  return portalMode === "demo" || Boolean(erpRoutes[operation]);
}
