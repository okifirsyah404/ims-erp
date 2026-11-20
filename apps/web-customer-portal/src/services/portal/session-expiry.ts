import { ApiError } from "@/api/client";
import { type PortalSource } from "@/api/portal";
import { SessionExpiredError } from "../errors";

/** Operations that run before a session exists; a 401 there is a normal auth result. */
export const SESSIONLESS: ReadonlySet<keyof PortalSource> = new Set([
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
export function withSessionExpiry(source: PortalSource): PortalSource {
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
